"""실제 PostgreSQL(docker postgres:17) 두 연결 경합: lease 상실·lease 갱신·반복 원본 직렬화·취소/실패 교착·이중 환불.

스키마: supabase/tests/_stub.sql + tests/db/pgmq_stub.sql + supabase/migrations(run.sh 순서). docker가 없으면 건너뛴다.
"""

from __future__ import annotations

import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

import pytest

psycopg = pytest.importorskip("psycopg")
from psycopg.rows import dict_row  # noqa: E402

from app.lease import LeaseKeeper  # noqa: E402
from app.repo import PgRepo  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_FILES = [
    ROOT / "supabase/tests/_stub.sql",
    Path(__file__).parent / "db/pgmq_stub.sql",
    ROOT / "supabase/migrations/20261116184706_studio_schema.sql",
    ROOT / "supabase/migrations/20261116184740_fk_indexes.sql",
    ROOT / "supabase/migrations/20261118152240_approval_gate.sql",
    ROOT / "supabase/migrations/20261118160922_radar_videos.sql",
    ROOT / "supabase/migrations/20261118193428_studio_analyze.sql",
]
CONTAINER = "gss-worker-dbtest"


def _docker_ok() -> bool:
    if not shutil.which("docker"):
        return False
    return subprocess.run(["docker", "info"], capture_output=True).returncode == 0


pytestmark = pytest.mark.skipif(not _docker_ok(), reason="docker 없음")


@pytest.fixture(scope="module")
def dsn():
    subprocess.run(["docker", "rm", "-f", CONTAINER], capture_output=True)
    subprocess.run(["docker", "run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=pw",
                    "-p", "127.0.0.1::5432", "postgres:17"], check=True, capture_output=True)
    try:
        for _ in range(60):
            if subprocess.run(["docker", "exec", CONTAINER, "pg_isready", "-U", "postgres"],
                              capture_output=True).returncode == 0:
                break
            time.sleep(1)
        time.sleep(2)
        for f in SCHEMA_FILES:
            subprocess.run(["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                            "-q"], input=f.read_bytes(), check=True, capture_output=True)
        port = subprocess.run(["docker", "port", CONTAINER, "5432/tcp"], check=True, capture_output=True,
                              text=True).stdout.strip().splitlines()[0].rsplit(":", 1)[1]
        yield f"postgresql://postgres:pw@127.0.0.1:{port}/postgres"
    finally:
        subprocess.run(["docker", "rm", "-f", CONTAINER], capture_output=True)


def _connect(dsn: str):
    return psycopg.connect(dsn, autocommit=True, row_factory=dict_row)


@pytest.fixture
def conns(dsn):
    cs = [_connect(dsn) for _ in range(4)]
    with cs[0].cursor() as cur:  # 테스트 사이 큐 비우기
        cur.execute("delete from pgmq.q_analyze")
    yield cs
    for c in cs:
        c.close()


def _q(conn, sql: str, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall() if cur.description else None


def _seed_user(conn, credits: int = 5) -> uuid.UUID:
    uid = uuid.uuid4()
    _q(conn, "insert into auth.users (id) values (%s)", (uid,))
    _q(conn, "update studio.profiles set approved_at = now() where user_id = %s", (uid,))
    _q(conn, "select studio.grant_credits(%s, %s, 'gift', %s)", (uid, credits, f"seed-{uid}"))
    return uid


def _start(conn, uid: uuid.UUID, sha: str | None = None) -> tuple[uuid.UUID, uuid.UUID]:
    """작업물 + 원본 객체 + start_analyze(사용자 세션) → (project_id, job_id)."""
    pid = uuid.uuid4()
    path = f"{uid}/{pid}/source.mp4"
    _q(conn, "insert into studio.projects (id, user_id, type, source_path) values (%s, %s, 'video', %s)",
       (pid, uid, path))
    _q(conn, "insert into storage.objects (bucket_id, name) values ('sources', %s)", (path,))
    with conn.transaction():
        _q(conn, "set local role authenticated")
        _q(conn, "select set_config('request.jwt.claim.sub', %s, true)", (str(uid),))
        r = _q(conn, "select studio.start_analyze(%s, 'own') as r", (pid,))[0]["r"]
    assert r["result"] == "ok", r
    return pid, uuid.UUID(r["job_id"])


def _cancel(conn, uid: uuid.UUID, job_id: uuid.UUID) -> str:
    with conn.transaction():
        _q(conn, "set local role authenticated")
        _q(conn, "select set_config('request.jwt.claim.sub', %s, true)", (str(uid),))
        return _q(conn, "select studio.cancel_analyze(%s) as r", (job_id,))[0]["r"]


def _refunds(conn, job_id: uuid.UUID) -> int:
    return _q(conn, "select count(*) as n from studio.credit_ledger where job_id = %s and reason = 'refund'",
              (job_id,))[0]["n"]


def _status(conn, job_id: uuid.UUID) -> str:
    return _q(conn, "select status from studio.jobs where id = %s", (job_id,))[0]["status"]


def test_lease_takeover_blocks_old_worker_writes(conns) -> None:
    a_conn, b_conn, admin = conns[0], conns[1], conns[2]
    uid = _seed_user(admin)
    _pid, job_id = _start(admin, uid)
    a, b = PgRepo(a_conn, "analyze"), PgRepo(b_conn, "analyze")

    msg_a = a.read(vt=1)
    job = a.claim(job_id, msg_a)
    assert job is not None and _status(admin, job_id) == "running"
    assert a.begin_step(job, msg_a, 1) == "ok"

    time.sleep(1.3)  # vt 만료(갱신 없음) → 다른 워커가 다시 읽는다
    msg_b = b.read(vt=30)
    assert msg_b is not None and msg_b.msg_id == msg_a.msg_id and msg_b.read_ct == 2

    assert a.begin_step(job, msg_a, 2) == "lost"
    assert a.fail(job, msg_a, 2, "INTERNAL_ERROR") == "lost"
    assert a.complete(job, msg_a, {}) == "lost"
    assert a.archive(msg_a) is False
    assert _status(admin, job_id) == "running" and _refunds(admin, job_id) == 0

    job_b = b.claim(job_id, msg_b)  # running + 재전달 → 이어서 처리
    assert job_b is not None and b.begin_step(job_b, msg_b, 1) == "ok"
    assert b.fail(job_b, msg_b, 1, "INTERNAL_ERROR") == "ok"
    assert _status(admin, job_id) == "failed" and _refunds(admin, job_id) == 1
    assert b.archive(msg_b) is True


def test_lease_keeper_prevents_redelivery(conns, dsn) -> None:
    a_conn, b_conn, admin, lease_conn = conns
    uid = _seed_user(admin)
    _start(admin, uid)
    a, b = PgRepo(a_conn, "analyze"), PgRepo(b_conn, "analyze")
    lease_repo = PgRepo(lease_conn, "analyze")

    msg = a.read(vt=2)
    with LeaseKeeper(lease_repo.renew, msg, vt=2, interval=0.5) as keeper:
        time.sleep(3.5)
        assert b.read(vt=30) is None  # 갱신 중에는 다시 읽히지 않는다
        assert not keeper.lost.is_set()
    time.sleep(2.5)
    again = b.read(vt=30)  # 갱신을 멈추면 vt 뒤 재전달
    assert again is not None and again.read_ct == 2
    assert lease_repo.renew(msg, 30) is False  # 옛 lease 갱신은 거부


def test_repeat_source_is_serialized_per_user(conns) -> None:
    a_conn, b_conn, admin, blocker = conns
    uid = _seed_user(admin)
    sha = "f" * 64
    old = uuid.uuid4()  # 30일 안 같은 원본 1번째
    _q(admin, "insert into studio.projects (id, user_id, type, source_sha256) values (%s, %s, 'video', %s)",
       (old, uid, sha))
    _p2, j2 = _start(admin, uid)
    _p3, j3 = _start(admin, uid)
    a, b = PgRepo(a_conn, "analyze"), PgRepo(b_conn, "analyze")
    m1, m2 = a.read(vt=60), b.read(vt=60)
    by_job = {}
    for repo, m in ((a, m1), (b, m2)):
        jid = uuid.UUID(m.body["job_id"])
        by_job[jid] = (repo, m, repo.claim(jid, m))
    assert set(by_job) == {j2, j3}

    results: list = []
    # 같은 사용자 잠금을 쥔 채 두 판정을 동시에 출발시킨 뒤 놓는다 → 잠금이 없으면 둘 다 2로 세어 0건
    with blocker.transaction():
        _q(blocker, "select pg_advisory_xact_lock(hashtextextended(%s::text, 0))", (uid,))
        threads = [threading.Thread(target=lambda r=r, m=m, j=j: results.append(r.record_source(j, m, sha)))
                   for r, m, j in by_job.values()]
        for t in threads:
            t.start()
        time.sleep(0.5)
    for t in threads:
        t.join(10)
    assert sorted(results) == [("ok", False), ("ok", True)]
    flags = _q(admin, "select count(*) as n from studio.policy_flags where user_id = %s and type = 'repeat_source'",
               (uid,))[0]["n"]
    assert flags == 1


@pytest.mark.parametrize("round_no", range(3))
def test_cancel_and_fail_race_no_deadlock_single_refund(conns, round_no: int) -> None:
    w_conn, user_conn, admin, blocker = conns
    uid = _seed_user(admin)
    _pid, job_id = _start(admin, uid)
    w = PgRepo(w_conn, "analyze")
    msg = w.read(vt=60)
    job = w.claim(job_id, msg)
    assert w.begin_step(job, msg, 2) == "ok"

    out: dict = {}
    errs: list = []

    def do_fail():
        try:
            out["fail"] = w.fail(job, msg, 2, "MEDIA_PROCESSING_FAILED")
        except Exception as e:
            errs.append(e)

    def do_cancel():
        try:
            out["cancel"] = _cancel(user_conn, uid, job_id)
        except Exception as e:
            errs.append(e)

    with blocker.transaction():
        _q(blocker, "select pg_advisory_xact_lock(hashtextextended(%s::text, 0))", (uid,))
        order = [do_fail, do_cancel] if round_no % 2 == 0 else [do_cancel, do_fail]
        threads = [threading.Thread(target=f) for f in order]
        for t in threads:
            t.start()
        time.sleep(0.3)
    for t in threads:
        t.join(10)
    assert errs == []
    assert _refunds(admin, job_id) == 1
    if out["fail"] == "ok":
        assert out["cancel"] == "not_cancelable" and _status(admin, job_id) == "failed"
    else:
        assert out["fail"] == "inactive" and out["cancel"] == "ok" and _status(admin, job_id) == "canceled"


def test_canceled_job_is_not_overwritten(conns) -> None:
    w_conn, user_conn, admin, _ = conns
    uid = _seed_user(admin)
    pid, job_id = _start(admin, uid)
    w = PgRepo(w_conn, "analyze")
    msg = w.read(vt=60)
    job = w.claim(job_id, msg)
    assert _cancel(user_conn, uid, job_id) == "ok"
    assert w.begin_step(job, msg, 2) == "inactive"
    assert w.complete(job, msg, {"x": 1}) == "inactive"
    assert w.fail(job, msg, 2, "X") == "inactive"
    assert _status(admin, job_id) == "canceled" and _refunds(admin, job_id) == 1
    assert _q(admin, "select count(*) as n from studio.drafts where project_id = %s", (pid,))[0]["n"] == 0
    assert w.archive(msg) is True


def test_step3_started_blocks_cancel(conns) -> None:
    w_conn, user_conn, admin, _ = conns
    uid = _seed_user(admin)
    _pid, job_id = _start(admin, uid)
    w = PgRepo(w_conn, "analyze")
    msg = w.read(vt=60)
    job = w.claim(job_id, msg)
    assert w.begin_step(job, msg, 3) == "ok"
    assert _cancel(user_conn, uid, job_id) == "too_late"
    assert w.complete(job, msg, {"titles": []}) == "ok"
    assert _status(admin, job_id) == "done"
