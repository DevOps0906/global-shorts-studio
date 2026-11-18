"""상태 전이·취소 경쟁·환불 분기(계약 5장 + 보안 리뷰 추가 요구)."""

from __future__ import annotations

from uuid import uuid4

import pytest
from conftest import FakeGenerate, FakeMedia, FakeRepo, FakeStorage, make_pipeline, msg_for, valid_output

from app import errors
from app.errors import StepError
from app.media import ProbeResult
from app.repo import QueueMessage


def test_success_saves_draft_marks_done_and_uploads_proxy(repo: FakeRepo, tmp_path) -> None:
    storage, gen = FakeStorage(), FakeGenerate()
    out = make_pipeline(repo, gen=gen, storage=storage, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "done"
    assert (repo.status, repo.project_status) == ("done", "editing")
    assert all(repo.steps[n].get("started") and repo.steps[n].get("done") for n in (1, 2, 3, 4))
    assert len(repo.drafts) == 1 and len(repo.drafts[0]["titles"]) == 3
    assert repo.refunds == []  # 차감은 start_analyze가 했고 성공이면 환불 없음
    assert repo.archived == [7]
    assert storage.uploads == [f"{repo.user_id}/{repo.project_id}/proxy.mp4"]
    assert gen.calls == 1


@pytest.mark.parametrize("status", ["canceled", "done", "failed"])
def test_finished_job_message_is_dropped_without_changes(status: str, tmp_path) -> None:
    repo = FakeRepo(status=status)
    media = FakeMedia()
    out = make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "dropped"
    assert repo.status == status and repo.refunds == [] and repo.drafts == []
    assert media.calls == [] and repo.archived == [7]


def test_unknown_job_or_bad_message_is_archived(repo: FakeRepo, tmp_path) -> None:
    p = make_pipeline(repo, tmp_path=tmp_path)
    assert p.handle(QueueMessage(1, 1, {"job_id": "not-a-uuid"})) == "invalid"
    assert p.handle(QueueMessage(2, 1, {})) == "invalid"
    assert p.handle(QueueMessage(3, 1, {"job_id": str(uuid4())})) == "dropped"
    assert repo.archived == [1, 2, 3] and repo.status == "queued"


def test_non_analyze_job_is_dropped(tmp_path) -> None:
    repo = FakeRepo(kind="render")
    assert make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo)) == "dropped"
    assert repo.status == "queued"


@pytest.mark.parametrize("step", [2, 3, 4])
def test_cancel_between_steps_stops_without_overwrite_or_second_refund(step: int, tmp_path) -> None:
    # step 3·4: 3단계 시작 뒤 취소는 cancel_analyze가 거부(too_late) → 계속 진행되어야 한다
    repo = FakeRepo(cancel_before_step=step)
    gen = FakeGenerate()
    out = make_pipeline(repo, gen=gen, tmp_path=tmp_path).handle(msg_for(repo))
    if step == 2 or step == 3:
        # 3단계 begin 직전 취소는 아직 started가 없으므로 취소 성공 → LLM을 부르지 않는다
        assert out == "canceled"
        assert repo.status == "canceled" and repo.project_status == "draft"
        assert repo.refunds == [f"{repo.job_id}:refund:1"]  # cancel이 한 1회뿐
        assert gen.calls == 0 and repo.drafts == []
        assert repo.archived == [7]
    else:
        assert out == "done" and repo.status == "done" and repo.refunds == []


def test_cancel_during_step_then_step_error_does_not_fail_or_refund(tmp_path) -> None:
    repo = FakeRepo()

    class CancelThenFail(FakeMedia):
        def transcribe(self, path, demuxer):
            repo.cancel()
            raise StepError(errors.MEDIA_PROCESSING_FAILED)

    out = make_pipeline(repo, media=CancelThenFail(), tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "canceled"
    assert repo.status == "canceled" and repo.refunds == [f"{repo.job_id}:refund:1"]
    assert "error" not in repo.steps[2]


def test_cancel_during_step_is_detected_at_finish(tmp_path) -> None:
    repo = FakeRepo()

    class CancelInScenes(FakeMedia):
        def scenes(self, path, duration):
            repo.cancel()
            return [(0.0, 30.0)]

    gen = FakeGenerate()
    out = make_pipeline(repo, media=CancelInScenes(), gen=gen, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "canceled" and gen.calls == 0 and repo.status == "canceled"
    assert len(repo.refunds) == 1


@pytest.mark.parametrize(
    ("raise_at", "code", "step"),
    [
        ("probe", errors.DURATION_TOO_LONG, 1),
        ("probe", errors.UNSUPPORTED_FORMAT, 1),
        ("scenes", errors.MEDIA_PROCESSING_FAILED, 2),
        ("proxy", errors.MEDIA_PROCESSING_FAILED, 4),
    ],
)
def test_media_failure_fails_job_and_refunds_once(raise_at: str, code: str, step: int, tmp_path) -> None:
    repo = FakeRepo()
    media = FakeMedia(raise_at=raise_at, error=StepError(code))
    out = make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "failed"
    assert (repo.status, repo.project_status) == ("failed", "failed")
    assert repo.steps[step]["error"] == code
    assert repo.refunds == [f"{repo.job_id}:refund:1"]
    assert repo.drafts == [] and repo.archived == [7]


@pytest.mark.parametrize("code", [errors.LLM_REFUSED, errors.LLM_SCHEMA_INVALID, errors.LLM_UPSTREAM])
def test_llm_failure_fails_step3_and_refunds(code: str, tmp_path) -> None:
    repo = FakeRepo()
    out = make_pipeline(repo, gen=FakeGenerate(StepError(code)), tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "failed" and repo.steps[3]["error"] == code
    assert repo.refunds == [f"{repo.job_id}:refund:1"]


def test_unexpected_exception_is_internal_error_with_refund(tmp_path) -> None:
    repo = FakeRepo()
    media = FakeMedia(raise_at="cropdetect", error=RuntimeError("boom"))
    assert make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo)) == "failed"
    assert repo.steps[2]["error"] == errors.INTERNAL_ERROR and len(repo.refunds) == 1


@pytest.mark.parametrize(
    ("kwargs", "code"),
    [
        ({"approved": False}, errors.NOT_APPROVED),
        ({"rights": False}, errors.RIGHTS_NOT_CONFIRMED),
        ({"source_path": "someone-else/x/source.mp4"}, errors.INVALID_SOURCE),
    ],
)
def test_revalidation_failures_refund_before_download(kwargs: dict, code: str, tmp_path) -> None:
    repo = FakeRepo(**kwargs)
    storage = FakeStorage()
    out = make_pipeline(repo, storage=storage, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "failed" and repo.steps[1]["error"] == code
    assert storage.downloads == [] and len(repo.refunds) == 1


def test_forged_path_with_other_project_id_is_rejected(tmp_path) -> None:
    repo = FakeRepo()
    repo.source_path = f"{repo.user_id}/{uuid4()}/source.mp4"
    assert make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo)) == "failed"
    assert repo.steps[1]["error"] == errors.INVALID_SOURCE


def test_repeat_source_flags_but_continues(tmp_path) -> None:
    repo = FakeRepo(repeat=True)
    assert make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo)) == "done"
    assert repo.flags == ["repeat_source"]


def test_no_audio_skips_transcription(tmp_path) -> None:
    repo = FakeRepo()
    media = FakeMedia(probe=ProbeResult("webm", 20.0, 1080, 1920, "vp9", False))
    assert make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo)) == "done"
    assert "transcribe" not in media.calls


def test_frames_are_limited_to_twelve(tmp_path) -> None:
    class ManyScenes(FakeMedia):
        def scenes(self, path, duration):
            self.calls.append("scenes")
            return [(i * 1.0, i * 1.0 + 1) for i in range(30)]

    repo, media = FakeRepo(), ManyScenes()
    assert make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo)) == "done"
    assert media.calls.count("frame") == 12


def test_read_ct_over_limit_fails_and_refunds_once(tmp_path) -> None:
    repo = FakeRepo(status="running")
    media = FakeMedia()
    out = make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo, read_ct=4))
    assert out == "max_attempts"
    assert repo.status == "failed" and repo.steps[1]["error"] == errors.MAX_ATTEMPTS
    assert repo.refunds == [f"{repo.job_id}:refund:1"] and repo.archived == [7] and media.calls == []


def test_read_ct_over_limit_on_canceled_job_does_not_refund(tmp_path) -> None:
    repo = FakeRepo(status="canceled")
    assert make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo, read_ct=4)) == "max_attempts"
    assert repo.status == "canceled" and repo.refunds == [] and repo.archived == [7]


def test_redelivered_running_job_resumes(tmp_path) -> None:
    repo = FakeRepo(status="running")
    assert make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo, read_ct=2)) == "done"


def test_running_job_on_first_read_is_not_taken_twice(tmp_path) -> None:
    repo = FakeRepo(status="running")
    media = FakeMedia()
    assert make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo, read_ct=1)) == "dropped"
    assert repo.status == "running" and media.calls == []


# ---------- lease(vt 만료 중복 점유) ----------

@pytest.mark.parametrize("step", [2, 3, 4])
def test_lost_lease_stops_without_any_write_refund_or_archive(step: int, tmp_path) -> None:
    repo = FakeRepo(steal_before_step=step)
    storage, gen = FakeStorage(), FakeGenerate()
    out = make_pipeline(repo, gen=gen, storage=storage, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "lost"
    assert repo.status == "running"  # 새 소유 워커가 이어서 처리
    assert repo.refunds == [] and repo.drafts == [] and repo.archived == []
    assert storage.deleted == []
    assert gen.calls == (1 if step == 4 else 0)


def test_lost_lease_then_step_error_does_not_fail_or_refund(tmp_path) -> None:
    repo = FakeRepo()

    class StealThenFail(FakeMedia):
        def scenes(self, path, duration):
            repo.steal(msg_for(repo))
            raise StepError(errors.MEDIA_PROCESSING_FAILED)

    out = make_pipeline(repo, media=StealThenFail(), tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "lost" and repo.status == "running" and repo.refunds == [] and repo.archived == []


def test_lost_lease_at_complete_writes_no_draft(tmp_path) -> None:
    repo = FakeRepo()
    original = repo.finish_step

    def finish_then_steal(job, lease, step_no):
        st = original(job, lease, step_no)
        if step_no == 4:
            repo.steal(lease)
        return st

    repo.finish_step = finish_then_steal  # type: ignore[method-assign]
    storage = FakeStorage()
    out = make_pipeline(repo, storage=storage, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "lost" and repo.drafts == [] and repo.status == "running"
    assert storage.deleted == []  # 새 소유 워커의 프록시일 수 있어 지우지 않는다


def test_stale_message_after_redelivery_is_not_archived(tmp_path) -> None:
    repo = FakeRepo(status="queued", msg_read_ct=2)  # 다른 워커가 이미 다시 읽음
    out = make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo, read_ct=1))
    assert out == "dropped" and repo.archived == [] and repo.status == "queued"


def test_max_attempts_with_lost_lease_does_nothing(tmp_path) -> None:
    repo = FakeRepo(status="running", msg_read_ct=5)
    out = make_pipeline(repo, tmp_path=tmp_path).handle(msg_for(repo, read_ct=4))
    assert out == "max_attempts" and repo.refunds == [] and repo.status == "running" and repo.archived == []


def test_lease_keeper_wraps_processing(tmp_path) -> None:
    entered: list[int] = []

    class Keeper:
        def __init__(self, msg):
            self.msg = msg

        def __enter__(self):
            entered.append(self.msg.msg_id)

        def __exit__(self, *a):
            entered.append(-self.msg.msg_id)

    repo = FakeRepo()
    out = make_pipeline(repo, tmp_path=tmp_path, lease_factory=Keeper).handle(msg_for(repo))
    assert out == "done" and entered == [7, -7]


# ---------- 프록시 정리·demuxer 고정·컷 재매핑 ----------

def test_failure_after_proxy_upload_deletes_proxy(tmp_path) -> None:
    repo = FakeRepo()
    original = repo.finish_step

    def finish_then_cancel(job, lease, step_no):
        if step_no == 4:
            repo.status = "canceled"  # 운영자 조치 등으로 running이 아니게 됨
        return original(job, lease, step_no)

    repo.finish_step = finish_then_cancel  # type: ignore[method-assign]
    storage = FakeStorage()
    out = make_pipeline(repo, storage=storage, tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "canceled" and storage.deleted == storage.uploads and repo.drafts == []


def test_demuxer_is_fixed_from_probe(tmp_path) -> None:
    repo = FakeRepo()
    media = FakeMedia(probe=ProbeResult("webm", 20.0, 1080, 1920, "vp9", True))
    make_pipeline(repo, media=media, tmp_path=tmp_path).handle(msg_for(repo))
    assert media.demuxers == {"matroska"}


def test_comments_are_remapped_after_cut_normalization(tmp_path) -> None:
    data = valid_output()
    base = data["scripts"][0]
    base["cuts"] = [
        {**base["cuts"][0], "start": 0.0, "end": 0.1},  # 너무 짧아 버려진다
        {**base["cuts"][0], "start": 0.1, "end": 3.0},
        {**base["cuts"][1]},
    ]
    data["comments"] = [{"cut": 0, "text": "버려진 컷"}, {"cut": 2, "text": "남는 컷"}]
    repo = FakeRepo()
    out = make_pipeline(repo, gen=FakeGenerate(data=data), tmp_path=tmp_path).handle(msg_for(repo))
    assert out == "done"
    state = repo.drafts[0]
    assert len(state["scripts"][0]["cuts"]) == 2
    assert state["comments"] == [{"cut": 1, "text": "남는 컷"}]
