"""분석 작업 1건 처리(계약: tasks/task-006-contract.md 5장).

메시지는 job_id만 믿고 DB에서 다시 읽는다. 차감은 start_analyze가 이미 했다 → 워커는 실패 시 환불만.
매 단계 시작·완료 때 jobs와 큐 메시지(lease)를 잠가 다시 확인한다.
- 취소 등으로 running이 아니면(inactive) 즉시 멈추고 메시지만 archive(상태·환불 손대지 않음).
- lease를 잃으면(lost) 아무것도 쓰지 않고 archive도 하지 않는다(새 소유 워커가 처리).
"""

from __future__ import annotations

import contextlib
import logging
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol
from uuid import UUID

from . import errors, media
from .errors import StepError
from .llm import AnalysisOutput, build_user_content, to_edit_state, validate_output
from .repo import Context, Job, QueueMessage, Status, source_path_ok

log = logging.getLogger(__name__)

PROXY_NAME = "proxy.mp4"  # {uid}/{project_id}/proxy.mp4 (원본과 같은 폴더, 본인 select 정책으로 읽힌다)


class Aborted(Exception):
    """작업을 더 진행하지 않는다. reason: inactive(취소 등) | lost(lease 상실)."""

    def __init__(self, reason: Status) -> None:
        super().__init__(reason)
        self.reason = reason


class Repo(Protocol):
    def archive(self, lease: QueueMessage) -> bool: ...
    def claim(self, job_id: UUID, lease: QueueMessage) -> Job | None: ...
    def lock_for_max_attempts(self, job_id: UUID, lease: QueueMessage) -> Job | None: ...
    def load_context(self, job: Job) -> Context: ...
    def begin_step(self, job: Job, lease: QueueMessage, step_no: int) -> Status: ...
    def finish_step(self, job: Job, lease: QueueMessage, step_no: int) -> Status: ...
    def record_source(self, job: Job, lease: QueueMessage, sha256: str) -> tuple[Status, bool]: ...
    def complete(self, job: Job, lease: QueueMessage, edit_state: dict[str, Any]) -> Status: ...
    def fail(self, job: Job, lease: QueueMessage, step_no: int | None, code: str) -> Status: ...


class Store(Protocol):
    def download(self, path: str, dest: Path) -> str: ...
    def upload(self, path: str, src: Path, content_type: str = ...) -> None: ...
    def delete(self, path: str) -> None: ...


class Media:
    """미디어 처리 묶음(테스트에서 가짜로 바꾼다)."""

    def __init__(self, whisper_model: str, scenes_timeout: float = 180, transcribe_timeout: float = 300) -> None:
        self.whisper_model = whisper_model
        self.scenes_timeout = scenes_timeout
        self.transcribe_timeout = transcribe_timeout

    def probe(self, path: Path) -> media.ProbeResult:
        return media.judge_probe(media.ffprobe(path))

    def cropdetect(self, path: Path, demuxer: str) -> tuple[int, int, int, int] | None:
        return media.cropdetect(path, demuxer)

    def scenes(self, path: Path, duration: float) -> list[tuple[float, float]]:
        return media.run_with_timeout(media.detect_scenes, (path, duration), self.scenes_timeout)

    def frame(self, path: Path, demuxer: str, at: float, out: Path) -> Path:
        return media.extract_frame(path, demuxer, at, out)

    def transcribe(self, path: Path, demuxer: str) -> list[dict]:
        pcm = media.decode_audio(path, demuxer, path.with_name("audio.f32"))
        return media.run_with_timeout(media.transcribe_pcm, (str(pcm), self.whisper_model), self.transcribe_timeout)

    def proxy(self, path: Path, demuxer: str, out: Path) -> Path:
        return media.make_proxy(path, demuxer, out)


# generate(duration, build_content(retry_note) -> content) -> AnalysisOutput
Generate = Callable[[float, Callable[[str | None], list[dict]]], AnalysisOutput]
LeaseFactory = Callable[[QueueMessage], contextlib.AbstractContextManager[Any]]


def finalize_edit_state(output: AnalysisOutput, duration: float) -> dict[str, Any]:
    """4단계 컷 정리 → comments.cut 재매핑(기본안 scripts[0] 기준) → 최종 재검증."""
    state = to_edit_state(output)
    mappings = []
    for script in state["scripts"]:
        script["cuts"], mapping = media.normalize_cuts(script["cuts"], duration)
        mappings.append(mapping)
    base = mappings[0]
    state["comments"] = [{**c, "cut": base[c["cut"]]} for c in state["comments"] if c["cut"] in base]
    try:
        validate_output(state, duration)
    except ValueError as e:
        raise StepError(errors.LLM_SCHEMA_INVALID, "invalid after normalization") from e
    return state


@dataclass
class _Progress:
    step: int = 1
    proxy_path: str | None = None


@dataclass
class Pipeline:
    repo: Repo
    storage: Store
    media: Any
    generate: Generate
    max_read_ct: int = 3
    work_dir: str | None = None
    lease_factory: LeaseFactory = field(default=lambda _msg: contextlib.nullcontext())

    def handle(self, msg: QueueMessage) -> str:
        """반환값은 결과 요약(로그·테스트용): invalid · dropped · max_attempts · canceled · lost · done · failed"""
        try:
            job_id = UUID(str(msg.body.get("job_id")))
        except ValueError:
            self.repo.archive(msg)
            return "invalid"

        if msg.read_ct > self.max_read_ct:
            job = self.repo.lock_for_max_attempts(job_id, msg)
            if job is not None and self.repo.fail(job, msg, None, errors.MAX_ATTEMPTS) == "lost":
                return "lost"
            self.repo.archive(msg)
            log.warning("job %s exceeded read_ct %d", job_id, msg.read_ct)
            return "max_attempts"

        job = self.repo.claim(job_id, msg)
        if job is None:  # 없음·analyze 아님·이미 canceled/done/failed·lease 상실
            self.repo.archive(msg)  # 내 메시지가 아니면 archive는 아무것도 하지 않는다
            return "dropped"

        progress = _Progress()
        with self.lease_factory(msg):
            try:
                with tempfile.TemporaryDirectory(dir=self.work_dir) as tmp:
                    edit_state = self._run(job, msg, Path(tmp), progress)
                status = self.repo.complete(job, msg, edit_state)
                if status != "ok":
                    raise Aborted(status)
            except Aborted as a:
                return self._stopped(job, msg, progress, a.reason)
            except StepError as e:
                log.info("job %s failed at step %d: %s", job.id, progress.step, e.code)
                return self._fail(job, msg, progress, e.code)
            except Exception:
                log.exception("job %s internal error at step %d", job.id, progress.step)
                return self._fail(job, msg, progress, errors.INTERNAL_ERROR)
        self.repo.archive(msg)
        log.info("job %s done", job.id)
        return "done"

    def _stopped(self, job: Job, msg: QueueMessage, progress: _Progress, reason: Status) -> str:
        if reason == "lost":
            log.warning("job %s lease lost at step %d; leaving to new owner", job.id, progress.step)
            return "lost"
        self._cleanup_proxy(progress)
        self.repo.archive(msg)
        log.info("job %s stopped: no longer running", job.id)
        return "canceled"

    def _fail(self, job: Job, msg: QueueMessage, progress: _Progress, code: str) -> str:
        # fail()은 running·queued이고 내 lease일 때만 바꾸고 환불한다.
        status = self.repo.fail(job, msg, progress.step, code)
        if status == "lost":
            return "lost"
        self._cleanup_proxy(progress)
        self.repo.archive(msg)
        return "failed" if status == "ok" else "canceled"

    def _cleanup_proxy(self, progress: _Progress) -> None:
        if progress.proxy_path is None:
            return
        try:
            self.storage.delete(progress.proxy_path)
        except Exception as e:  # 정리 실패는 작업 결과를 바꾸지 않는다
            log.warning("proxy cleanup failed: %s", type(e).__name__)

    def _begin(self, job: Job, msg: QueueMessage, progress: _Progress, step_no: int) -> None:
        progress.step = step_no
        status = self.repo.begin_step(job, msg, step_no)
        if status != "ok":
            raise Aborted(status)

    def _finish(self, job: Job, msg: QueueMessage, step_no: int) -> None:
        status = self.repo.finish_step(job, msg, step_no)
        if status != "ok":
            raise Aborted(status)

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
        status, flagged = self.repo.record_source(job, msg, sha)
        if status != "ok":
            raise Aborted(status)
        if flagged:
            log.info("job %s repeat_source flagged", job.id)
        self._finish(job, msg, 1)

        # ---- 2. 장면 분석: 장면 경계·대표 프레임(≤12)·기존 틀/여백·받아쓰기 ----
        self._begin(job, msg, progress, 2)
        dmx = probe.demuxer
        crop = media.crop_box(self.media.cropdetect(src, dmx), probe.width, probe.height)
        scenes = self.media.scenes(src, probe.duration)
        frames = [
            (at, self.media.frame(src, dmx, at, tmp / f"frame_{i:02d}.jpg"))
            for i, at in enumerate(media.pick_frame_times(scenes))
        ]
        transcript = self.media.transcribe(src, dmx) if probe.has_audio else []
        self._finish(job, msg, 2)

        # ---- 3. 제목·대본 생성: begin_step(3) 커밋 뒤에만 LLM 호출(이후 취소 불가) ----
        self._begin(job, msg, progress, 3)

        def build(note: str | None) -> list[dict]:
            return build_user_content(
                frames=frames, transcript=transcript, project_type=ctx.project_type, lang=ctx.lang,
                length_preset=ctx.length_preset, duration=probe.duration, scenes=scenes, crop=crop,
                vertical=probe.vertical, retry_note=note,
            )

        output = self.generate(probe.duration, build)
        self._finish(job, msg, 3)

        # ---- 4. 편집 마무리: 컷 경계 정리 + 미리보기 프록시 ----
        self._begin(job, msg, progress, 4)
        state = finalize_edit_state(output, probe.duration)
        proxy = self.media.proxy(src, dmx, tmp / PROXY_NAME)
        path = f"{job.user_id}/{job.project_id}/{PROXY_NAME}"
        self.storage.upload(path, proxy)
        progress.proxy_path = path
        self._finish(job, msg, 4)
        return state
