"""분석 작업 1건 처리(계약: tasks/task-006-contract.md 5장).

메시지는 job_id만 믿고 DB에서 다시 읽는다. 차감은 start_analyze가 이미 했다 → 워커는 실패 시 환불만.
매 단계 시작·완료 때 jobs를 잠그고 running인지 다시 확인한다(취소되면 즉시 멈추고 메시지만 archive).
"""

from __future__ import annotations

import logging
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from uuid import UUID

from . import errors, media
from .errors import StepError
from .llm import AnalysisOutput, build_user_content, to_edit_state
from .repo import Context, Job, QueueMessage, source_path_ok

log = logging.getLogger(__name__)

PROXY_NAME = "proxy.mp4"  # {uid}/{project_id}/proxy.mp4 (원본과 같은 폴더, 본인 select 정책으로 읽힌다)


class Aborted(Exception):
    """작업이 더 이상 running이 아니다(취소 등). 상태를 건드리지 않고 멈춘다."""


class Repo(Protocol):
    def archive(self, msg_id: int) -> None: ...
    def extend(self, msg_id: int, vt: int) -> None: ...
    def claim(self, job_id: UUID, read_ct: int) -> Job | None: ...
    def lock_for_max_attempts(self, job_id: UUID) -> Job | None: ...
    def load_context(self, job: Job) -> Context: ...
    def begin_step(self, job_id: UUID, step_no: int) -> bool: ...
    def finish_step(self, job_id: UUID, step_no: int) -> bool: ...
    def record_source(self, job: Job, sha256: str) -> bool: ...
    def complete(self, job: Job, edit_state: dict[str, Any]) -> bool: ...
    def fail(self, job: Job, step_no: int | None, code: str) -> bool: ...


class Store(Protocol):
    def download(self, path: str, dest: Path) -> str: ...
    def upload(self, path: str, src: Path, content_type: str = ...) -> None: ...


class Media:
    """미디어 처리 묶음(테스트에서 가짜로 바꾼다)."""

    def __init__(self, whisper_model: str) -> None:
        self.whisper_model = whisper_model

    def probe(self, path: Path) -> media.ProbeResult:
        return media.judge_probe(media.ffprobe(path))

    def cropdetect(self, path: Path) -> tuple[int, int, int, int] | None:
        return media.cropdetect(path)

    def scenes(self, path: Path, duration: float) -> list[tuple[float, float]]:
        return media.detect_scenes(path, duration)

    def frame(self, path: Path, at: float, out: Path) -> Path:
        return media.extract_frame(path, at, out)

    def transcribe(self, path: Path) -> list[dict]:
        return media.transcribe(path, self.whisper_model)

    def proxy(self, path: Path, out: Path) -> Path:
        return media.make_proxy(path, out)


# generate(duration, build_content(retry_note) -> content) -> AnalysisOutput
Generate = Callable[[float, Callable[[str | None], list[dict]]], AnalysisOutput]


@dataclass
class Pipeline:
    repo: Repo
    storage: Store
    media: Any
    generate: Generate
    vt_seconds: int = 300
    max_read_ct: int = 3
    work_dir: str | None = None

    def handle(self, msg: QueueMessage) -> str:
        """반환값은 결과 요약(로그·테스트용): invalid · dropped · max_attempts · canceled · done · failed"""
        try:
            job_id = UUID(str(msg.body.get("job_id")))
        except ValueError:
            self.repo.archive(msg.msg_id)
            return "invalid"

        if msg.read_ct > self.max_read_ct:
            job = self.repo.lock_for_max_attempts(job_id)
            if job is not None:
                self.repo.fail(job, None, errors.MAX_ATTEMPTS)
            self.repo.archive(msg.msg_id)
            log.warning("job %s exceeded read_ct %d", job_id, msg.read_ct)
            return "max_attempts"

        job = self.repo.claim(job_id, msg.read_ct)
        if job is None:  # 없음·analyze 아님·이미 canceled/done/failed
            self.repo.archive(msg.msg_id)
            return "dropped"

        progress = _Progress()
        try:
            with tempfile.TemporaryDirectory(dir=self.work_dir) as tmp:
                edit_state = self._run(job, msg, Path(tmp), progress)
        except Aborted:
            self.repo.archive(msg.msg_id)
            log.info("job %s stopped: no longer running", job.id)
            return "canceled"
        except StepError as e:
            log.info("job %s failed at step %d: %s", job.id, progress.step, e.code)
            return self._fail(job, msg, progress.step, e.code)
        except Exception:
            log.exception("job %s internal error at step %d", job.id, progress.step)
            return self._fail(job, msg, progress.step, errors.INTERNAL_ERROR)

        if not self.repo.complete(job, edit_state):
            self.repo.archive(msg.msg_id)
            return "canceled"
        self.repo.archive(msg.msg_id)
        log.info("job %s done", job.id)
        return "done"

    def _fail(self, job: Job, msg: QueueMessage, step_no: int, code: str) -> str:
        # fail()은 running·queued일 때만 바꾸고 환불한다. 그 사이 취소됐으면 아무것도 하지 않는다.
        changed = self.repo.fail(job, step_no, code)
        self.repo.archive(msg.msg_id)
        return "failed" if changed else "canceled"

    def _begin(self, job: Job, msg: QueueMessage, progress: _Progress, step_no: int) -> None:
        progress.step = step_no
        if not self.repo.begin_step(job.id, step_no):
            raise Aborted
        self.repo.extend(msg.msg_id, self.vt_seconds)

    def _finish(self, job: Job, step_no: int) -> None:
        if not self.repo.finish_step(job.id, step_no):
            raise Aborted

    def _run(self, job: Job, msg: QueueMessage, tmp: Path, progress: _Progress) -> dict[str, Any]:
        # ---- 1. 영상 확인: 승인·작업물·권리·경로 재검증 → 원본(SHA-256) → ffprobe 판정 → 반복 원본 ----
        self._begin(job, msg, progress, 1)
        ctx = self.repo.load_context(job)
        if not ctx.approved:
            raise StepError(errors.NOT_APPROVED)
        if not ctx.project_found or not source_path_ok(ctx.source_path, job.user_id, job.project_id):
            raise StepError(errors.INVALID_SOURCE)
        if not ctx.rights_confirmed:
            raise StepError(errors.RIGHTS_NOT_CONFIRMED)
        src = tmp / "source"  # 확장자를 쓰지 않는다: 형식은 내용(ffprobe)으로만 판정
        sha = self.storage.download(ctx.source_path, src)
        probe = self.media.probe(src)
        if self.repo.record_source(job, sha):
            log.info("job %s repeat_source flagged", job.id)
        self._finish(job, 1)

        # ---- 2. 장면 분석: 장면 경계·대표 프레임(≤12)·기존 틀/여백·받아쓰기 ----
        self._begin(job, msg, progress, 2)
        crop = media.crop_box(self.media.cropdetect(src), probe.width, probe.height)
        scenes = self.media.scenes(src, probe.duration)
        frames = [
            (at, self.media.frame(src, at, tmp / f"frame_{i:02d}.jpg"))
            for i, at in enumerate(media.pick_frame_times(scenes))
        ]
        transcript = self.media.transcribe(src) if probe.has_audio else []
        self._finish(job, 2)

        # ---- 3. 제목·대본 생성: begin_step(3) 커밋 뒤에만 LLM 호출(이후 취소 불가) ----
        self._begin(job, msg, progress, 3)

        def build(note: str | None) -> list[dict]:
            return build_user_content(
                frames=frames, transcript=transcript, project_type=ctx.project_type, lang=ctx.lang,
                length_preset=ctx.length_preset, duration=probe.duration, scenes=scenes, crop=crop,
                vertical=probe.vertical, retry_note=note,
            )

        output = self.generate(probe.duration, build)
        self._finish(job, 3)

        # ---- 4. 편집 마무리: 컷 경계 정리 + 미리보기 프록시 ----
        self._begin(job, msg, progress, 4)
        state = to_edit_state(output)
        for script in state["scripts"]:
            script["cuts"] = media.normalize_cuts(script["cuts"], probe.duration)
            if not script["cuts"]:
                raise StepError(errors.LLM_SCHEMA_INVALID, "no usable cuts after normalization")
        proxy = self.media.proxy(src, tmp / PROXY_NAME)
        self.storage.upload(f"{job.user_id}/{job.project_id}/{PROXY_NAME}", proxy)
        self._finish(job, 4)
        return state


@dataclass
class _Progress:
    step: int = 1
