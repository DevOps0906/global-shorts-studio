"""PgRepo: 잠금 순서(사용자 lock → jobs → 큐 메시지) 뒤 status·lease 재확인 → 쓰기·환불 분기(가짜 연결로 SQL만 기록)."""

from __future__ import annotations

from contextlib import contextmanager
from uuid import uuid4

import pytest

from app.repo import (
    Job,
    PgRepo,
    QueueMessage,
    claim_decision,
    is_repeat_source,
    refund_key,
    source_path_ok,
)

LEASE = QueueMessage(11, 1, {})


class FakeCursor:
    def __init__(self, conn: FakeConn) -> None:
        self.conn = conn
        self._next = None
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, query, params=()) -> None:
        text = query if isinstance(query, str) else query.as_string(None)
        self.conn.sql.append(text)
        self.conn.params.append(params)
        self.rowcount = 0
        if "pgmq" in text and "for update" in text:
            self._next = {"ok": 1} if self.conn.owns else None
        elif "pgmq" in text and text.lstrip().startswith("update"):
            self.rowcount = 1 if self.conn.owns else 0
            self._next = None
        elif "for update" in text:
            self._next = self.conn.job_row
        elif "refund_credits" in text:
            self._next = {"r": self.conn.refund_result}
        elif "count(*)" in text:
            self._next = {"n": self.conn.count}
        else:
            self._next = None

    def fetchone(self):
        return self._next


class FakeConn:
    def __init__(self, status: str | None = "running", refund_result: str = "ok", count: int = 1,
                 owns: bool = True) -> None:
        self.job_row = None if status is None else {
            "status": status, "kind": "analyze", "user_id": uuid4(), "project_id": uuid4(),
            "attempt_no": 2, "cost_credits": 1,
        }
        self.refund_result = refund_result
        self.count = count
        self.owns = owns
        self.sql: list[str] = []
        self.params: list = []
        self.committed = 0
        self.rolled_back = 0

    @contextmanager
    def transaction(self):
        try:
            yield
        except Exception:
            self.rolled_back += 1
            raise
        else:
            self.committed += 1

    def cursor(self):
        return FakeCursor(self)

    def writes(self) -> list[str]:
        return [s for s in self.sql
                if s.lstrip().startswith(("update", "insert")) or "refund_credits" in s or "archive" in s]


def _job(conn: FakeConn) -> Job:
    r = conn.job_row or {"user_id": uuid4(), "project_id": uuid4()}
    return Job(uuid4(), r["user_id"], r["project_id"], 2, 1)


def _repo(conn: FakeConn) -> PgRepo:
    return PgRepo(conn, "analyze")


def test_lock_order_matches_cancel_analyze() -> None:
    conn = FakeConn("running")
    _repo(conn).fail(_job(conn), LEASE, 2, "X")
    idx_user = next(i for i, s in enumerate(conn.sql) if "pg_advisory_xact_lock" in s)
    idx_job = next(i for i, s in enumerate(conn.sql) if "studio.jobs" in s and "for update" in s)
    idx_msg = next(i for i, s in enumerate(conn.sql) if "pgmq" in s and "for update" in s)
    assert idx_user < idx_job < idx_msg


def test_record_source_takes_user_lock_first() -> None:
    conn = FakeConn("running", count=3)
    st, flagged = _repo(conn).record_source(_job(conn), LEASE, "ab" * 32)
    assert (st, flagged) == ("ok", True)
    assert "pg_advisory_xact_lock" in conn.sql[0]
    assert any("insert into studio.policy_flags" in s and "repeat_source" in s for s in conn.sql)
    conn2 = FakeConn("running", count=2)
    assert _repo(conn2).record_source(_job(conn2), LEASE, "ab" * 32) == ("ok", False)
    assert not any("policy_flags" in s for s in conn2.sql)


@pytest.mark.parametrize("status", ["canceled", "done", "failed"])
def test_fail_on_finished_job_writes_nothing_and_no_refund(status: str) -> None:
    conn = FakeConn(status)
    assert _repo(conn).fail(_job(conn), LEASE, 2, "X") == "inactive"
    assert conn.writes() == []


@pytest.mark.parametrize("status", ["running", "queued", "canceled"])
def test_lost_lease_writes_nothing(status: str) -> None:
    conn = FakeConn(status, owns=False)
    repo, job = _repo(conn), _job(conn)
    assert repo.fail(job, LEASE, 2, "X") == "lost"
    assert repo.begin_step(job, LEASE, 3) == "lost"
    assert repo.finish_step(job, LEASE, 3) == "lost"
    assert repo.complete(job, LEASE, {}) == "lost"
    assert repo.record_source(job, LEASE, "ab") == ("lost", False)
    assert repo.claim(job.id, LEASE) is None
    assert repo.lock_for_max_attempts(job.id, LEASE) is None
    assert repo.archive(LEASE) is False
    assert repo.renew(LEASE, 60) is False
    assert [s for s in conn.writes() if "pgmq" not in s] == []
    assert not any("pgmq.archive" in s for s in conn.sql)


@pytest.mark.parametrize("status", ["running", "queued"])
def test_fail_running_marks_failed_and_refunds_with_attempt_key(status: str) -> None:
    conn = FakeConn(status)
    job = _job(conn)
    assert _repo(conn).fail(job, LEASE, 2, "LLM_REFUSED") == "ok"
    refund_idx = next(i for i, s in enumerate(conn.sql) if "refund_credits" in s)
    assert conn.params[refund_idx] == (job.user_id, 1, job.id, 2, f"{job.id}:refund:2")
    assert any("status = 'failed'" in s and "studio.jobs" in s for s in conn.sql)
    assert any("studio.projects set status = 'failed'" in s for s in conn.sql)
    assert conn.committed == 1


@pytest.mark.parametrize("result", ["duplicate", "no_charge"])
def test_refund_idempotent_results_are_accepted(result: str) -> None:
    conn = FakeConn("running", refund_result=result)
    assert _repo(conn).fail(_job(conn), LEASE, 1, "X") == "ok"


def test_refund_unexpected_result_rolls_back() -> None:
    conn = FakeConn("running", refund_result="over_refund")
    with pytest.raises(RuntimeError):
        _repo(conn).fail(_job(conn), LEASE, 1, "X")
    assert conn.rolled_back == 1 and conn.committed == 0


def test_fail_with_unknown_step_targets_last_started() -> None:
    conn = FakeConn("running")
    _repo(conn).fail(_job(conn), LEASE, None, "MAX_ATTEMPTS")
    assert any("order by case when started_at is null" in s for s in conn.sql)


@pytest.mark.parametrize("status", ["canceled", "done", "failed", "queued"])
def test_complete_and_steps_only_when_running(status: str) -> None:
    conn = FakeConn(status)
    repo, job = _repo(conn), _job(conn)
    assert repo.begin_step(job, LEASE, 3) == "inactive"
    assert repo.finish_step(job, LEASE, 3) == "inactive"
    assert repo.complete(job, LEASE, {}) == "inactive"
    assert conn.writes() == []


def test_complete_running_inserts_draft_v1_and_marks_done() -> None:
    conn = FakeConn("running")
    assert _repo(conn).complete(_job(conn), LEASE, {"titles": []}) == "ok"
    assert any("insert into studio.drafts" in s and "1," in s for s in conn.sql)
    assert any("status = 'done'" in s for s in conn.sql)
    assert any("status = 'editing'" in s for s in conn.sql)


def test_claim_queued_sets_running() -> None:
    conn = FakeConn("queued")
    job = _repo(conn).claim(uuid4(), LEASE)
    assert job is not None and job.attempt_no == 2
    assert any("status = 'running'" in s and "status = 'queued'" in s for s in conn.sql)


@pytest.mark.parametrize("status", ["canceled", "done", "failed"])
def test_claim_finished_returns_none_without_writes(status: str) -> None:
    conn = FakeConn(status)
    assert _repo(conn).claim(uuid4(), LEASE) is None
    assert conn.writes() == []


def test_claim_missing_or_other_kind() -> None:
    assert _repo(FakeConn(None)).claim(uuid4(), LEASE) is None
    conn = FakeConn("queued")
    conn.job_row["kind"] = "render"
    assert _repo(conn).claim(uuid4(), LEASE) is None and conn.writes() == []


def test_archive_and_renew_when_owned() -> None:
    conn = FakeConn("running")
    repo = _repo(conn)
    assert repo.archive(LEASE) is True and any("pgmq.archive" in s for s in conn.sql)
    assert repo.renew(LEASE, 60) is True
    assert conn.params[-1] == (60, 11, 1)


def test_invalid_queue_name_rejected() -> None:
    with pytest.raises(ValueError):
        PgRepo(FakeConn(), "analyze; drop table x")


@pytest.mark.parametrize(
    ("status", "read_ct", "expected"),
    [("queued", 1, "claim"), ("queued", 3, "claim"), ("running", 2, "resume"), ("running", 1, "drop"),
     ("canceled", 1, "drop"), ("done", 2, "drop"), ("failed", 1, "drop")],
)
def test_claim_decision(status: str, read_ct: int, expected: str) -> None:
    assert claim_decision(status, read_ct) == expected


def test_source_path_ok() -> None:
    u, p = uuid4(), uuid4()
    assert source_path_ok(f"{u}/{p}/source.mp4", u, p)
    assert source_path_ok(f"{u}/{p}/source.webm", u, p)
    for bad in [None, "", f"{u}/{p}/source.avi", f"{u}/{p}/../x/source.mp4", f"{uuid4()}/{p}/source.mp4",
                f"{u}/{uuid4()}/source.mp4", f"{u}/{p}/source.mp4/x", f"x/{u}/{p}/source.mp4"]:
        assert not source_path_ok(bad, u, p)


def test_repeat_and_refund_key() -> None:
    assert [is_repeat_source(n) for n in (1, 2, 3, 4)] == [False, False, True, True]
    j = uuid4()
    assert refund_key(j, 1) == f"{j}:refund:1"
