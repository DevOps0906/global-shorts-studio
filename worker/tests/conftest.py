"""가짜 DB·Storage·미디어·LLM. 실제 Supabase·Claude는 부르지 않는다."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest

from app import errors
from app.errors import StepError
from app.llm import validate_output
from app.media import ProbeResult
from app.pipeline import Pipeline
from app.repo import Context, Job, QueueMessage, Status, can_fail, can_progress, claim_decision


def valid_output(duration: float = 30.0) -> dict[str, Any]:
    cut = {"start": 0.0, "end": 3.0, "caption": "트리 밑, 막을까?", "scene": "매트를 편다",
           "tts": True, "keepOriginal": False, "zoom": 1.0}
    cut2 = {**cut, "start": 3.0, "end": min(8.0, duration), "caption": "고양이가 먼저 들어간다"}
    return {
        "titles": [
            {"line1": "집사는 트리 꾸미고", "line2": "고양이는 집 구하고", "hook": "contrast", "reason": "대비"},
            {"line1": "고양이가 트리 밑에", "line2": "들어간 이유", "hook": "curiosity", "reason": "호기심"},
            {"line1": "이 표정 보세요", "line2": "", "hook": "emotion", "reason": "감정"},
        ],
        "scripts": [{"label": f"안 {i}", "cuts": [cut, cut2]} for i in range(3)],
        "sfx": [{"at": 2.4, "type": "pop"}],
        "mosaic": [{"from": 0, "to": 12.5, "box": [0.72, 0.04, 0.24, 0.06]}],
        "comments": [{"cut": 1, "text": "트리 산 줄 알았는데"}],
        "meta": {"description": "설명", "hashtags": ["#shorts"]},
    }


@dataclass
class FakeRepo:
    """PgRepo와 같은 판정 함수(claim_decision·can_progress·can_fail)와 lease 규칙을 쓰는 메모리 DB."""

    job_id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    project_id: UUID = field(default_factory=uuid4)
    status: str = "queued"
    kind: str = "analyze"
    project_status: str = "analyzing"
    attempt_no: int = 1
    approved: bool = True
    rights: bool = True
    source_path: str | None = None
    repeat: bool = False
    msg_read_ct: int | None = None  # 큐에 있는 메시지의 현재 read_ct(None이면 handle에 들어온 값과 같다고 본다)
    archived: list[int] = field(default_factory=list)
    steps: dict[int, dict[str, Any]] = field(default_factory=lambda: {n: {} for n in (1, 2, 3, 4)})
    refunds: list[str] = field(default_factory=list)
    drafts: list[dict] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)
    cancel_before_step: int | None = None  # 이 단계 begin 직전에 사용자가 취소
    steal_before_step: int | None = None  # 이 단계 begin 직전에 다른 워커가 메시지를 다시 읽음(lease 상실)

    def __post_init__(self) -> None:
        if self.source_path is None:
            self.source_path = f"{self.user_id}/{self.project_id}/source.mp4"

    def job(self) -> Job:
        return Job(self.job_id, self.user_id, self.project_id, self.attempt_no, 1)

    def cancel(self) -> None:
        """cancel_analyze와 같은 효과(3단계 전이면 canceled + 환불)."""
        if self.status in ("queued", "running") and not self.steps[3].get("started"):
            self.status = "canceled"
            self.project_status = "draft"
            self.refunds.append(f"{self.job_id}:refund:{self.attempt_no}")

    def steal(self, lease: QueueMessage) -> None:
        self.msg_read_ct = lease.read_ct + 1

    def _owns(self, lease: QueueMessage) -> bool:
        return self.msg_read_ct is None or self.msg_read_ct == lease.read_ct

    def _guard(self, lease: QueueMessage) -> Status:
        if not self._owns(lease):
            return "lost"
        return "ok" if can_progress(self.status) else "inactive"

    def archive(self, lease: QueueMessage) -> bool:
        if not self._owns(lease):
            return False
        self.archived.append(lease.msg_id)
        return True

    def claim(self, job_id: UUID, lease: QueueMessage) -> Job | None:
        if job_id != self.job_id or self.kind != "analyze" or not self._owns(lease):
            return None
        d = claim_decision(self.status, lease.read_ct)
        if d == "drop":
            return None
        if d == "claim":
            self.status = "running"
        return self.job()

    def lock_for_max_attempts(self, job_id: UUID, lease: QueueMessage) -> Job | None:
        ok = job_id == self.job_id and can_fail(self.status) and self._owns(lease)
        return self.job() if ok else None

    def load_context(self, job: Job) -> Context:
        return Context(self.approved, True, self.source_path, self.rights, "script", "ko", "keep")

    def begin_step(self, job: Job, lease: QueueMessage, step_no: int) -> Status:
        if self.cancel_before_step == step_no:
            self.cancel()
        if self.steal_before_step == step_no:
            self.steal(lease)
        st = self._guard(lease)
        if st == "ok":
            self.steps[step_no]["started"] = True
        return st

    def finish_step(self, job: Job, lease: QueueMessage, step_no: int) -> Status:
        st = self._guard(lease)
        if st == "ok":
            self.steps[step_no]["done"] = True
        return st

    def record_source(self, job: Job, lease: QueueMessage, sha256: str) -> tuple[Status, bool]:
        st = self._guard(lease)
        if st != "ok":
            return st, False
        if self.repeat:
            self.flags.append("repeat_source")
        return "ok", self.repeat

    def complete(self, job: Job, lease: QueueMessage, edit_state: dict[str, Any]) -> Status:
        st = self._guard(lease)
        if st == "ok":
            self.drafts.append(edit_state)
            self.status, self.project_status = "done", "editing"
        return st

    def fail(self, job: Job, lease: QueueMessage, step_no: int | None, code: str) -> Status:
        if not self._owns(lease):
            return "lost"
        if not can_fail(self.status):
            return "inactive"
        self.status, self.project_status = "failed", "failed"
        self.steps[step_no or 1]["error"] = code
        self.refunds.append(f"{job.id}:refund:{job.attempt_no}")
        return "ok"


class FakeStorage:
    def __init__(self) -> None:
        self.downloads: list[str] = []
        self.uploads: list[str] = []
        self.deleted: list[str] = []

    def download(self, path: str, dest: Path) -> str:
        self.downloads.append(path)
        dest.write_bytes(b"not-really-a-video")
        return "ab" * 32

    def upload(self, path: str, src: Path, content_type: str = "video/mp4") -> None:
        self.uploads.append(path)

    def delete(self, path: str) -> None:
        self.deleted.append(path)


class FakeMedia:
    def __init__(self, probe: ProbeResult | None = None, raise_at: str | None = None,
                 error: Exception | None = None) -> None:
        self._probe = probe or ProbeResult("mp4", 30.0, 1080, 1920, "h264", True)
        self.raise_at = raise_at
        self.error = error or StepError(errors.MEDIA_PROCESSING_FAILED)
        self.calls: list[str] = []
        self.demuxers: set[str] = set()

    def _maybe(self, name: str) -> None:
        self.calls.append(name)
        if self.raise_at == name:
            raise self.error

    def probe(self, path: Path) -> ProbeResult:
        self._maybe("probe")
        return self._probe

    def cropdetect(self, path: Path, demuxer: str):
        self.demuxers.add(demuxer)
        self._maybe("cropdetect")
        return (1080, 1600, 0, 160)

    def scenes(self, path: Path, duration: float):
        self._maybe("scenes")
        return [(0.0, 10.0), (10.0, 20.0), (20.0, 30.0)]

    def frame(self, path: Path, demuxer: str, at: float, out: Path) -> Path:
        self.demuxers.add(demuxer)
        self._maybe("frame")
        out.write_bytes(b"\xff\xd8jpeg")
        return out

    def transcribe(self, path: Path, demuxer: str):
        self.demuxers.add(demuxer)
        self._maybe("transcribe")
        return [{"start": 0.0, "end": 2.0, "text": "안녕"}]

    def proxy(self, path: Path, demuxer: str, out: Path) -> Path:
        self.demuxers.add(demuxer)
        self._maybe("proxy")
        out.write_bytes(b"proxy")
        return out


class FakeGenerate:
    def __init__(self, error: Exception | None = None, data: dict | None = None) -> None:
        self.error = error
        self.data = data
        self.calls = 0

    def __call__(self, duration: float, build_content):
        self.calls += 1
        build_content(None)
        if self.error:
            raise self.error
        return validate_output(self.data or valid_output(duration), duration)


@pytest.fixture
def repo() -> FakeRepo:
    return FakeRepo()


def make_pipeline(repo: FakeRepo, media: FakeMedia | None = None, gen: FakeGenerate | None = None,
                  storage: FakeStorage | None = None, tmp_path: Path | None = None, **kw: Any) -> Pipeline:
    return Pipeline(repo=repo, storage=storage or FakeStorage(), media=media or FakeMedia(),
                    generate=gen or FakeGenerate(), work_dir=str(tmp_path) if tmp_path else None, **kw)


def msg_for(repo: FakeRepo, read_ct: int = 1, msg_id: int = 7) -> QueueMessage:
    return QueueMessage(msg_id, read_ct, {"job_id": str(repo.job_id), "project_id": str(repo.project_id),
                                          "kind": "analyze", "idempotency_key": f"{repo.job_id}:spend:1"})
