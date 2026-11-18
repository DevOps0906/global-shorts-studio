"""DB 접근(psycopg, Postgres 직접 연결). 큐(pgmq)·jobs·job_steps·projects·drafts·환불.

소유권(lease) = 이 워커가 읽은 큐 메시지 (msg_id, read_ct).
vt가 만료돼 다른 워커가 같은 메시지를 다시 읽으면 read_ct가 늘어나 소유권을 잃는다.

상태를 바꾸는 모든 쓰기는 한 트랜잭션에서 아래 순서로 잠근 뒤 다시 확인한다(cancel_analyze와 같은 순서 → 교착 없음).
  (환불·반복 원본 판정만) 사용자 advisory lock → jobs `for update` → 큐 메시지 행 `for update`(read_ct 일치)
- jobs.status가 running이 아니면(취소 등) 'inactive': 쓰지 않는다.
- 메시지가 없거나 read_ct가 다르면 'lost': 쓰기·실패·환불·archive 모두 하지 않는다.
- canceled·done·failed 행을 done·failed로 덮어쓰거나 다시 환불하지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from psycopg import sql
from psycopg.types.json import Jsonb

ClaimDecision = Literal["claim", "resume", "drop"]
Status = Literal["ok", "inactive", "lost"]
SOURCE_PATH_RE = r"^{uid}/{pid}/source\.(mp4|mov|webm)$"
REFUND_OK = ("ok", "duplicate", "no_charge")
_QUEUE_NAME_RE = re.compile(r"^[a-z_]{1,40}$")


@dataclass(frozen=True)
class QueueMessage:
    msg_id: int
    read_ct: int
    body: dict[str, Any]


@dataclass(frozen=True)
class Job:
    id: UUID
    user_id: UUID
    project_id: UUID
    attempt_no: int
    cost_credits: int


@dataclass(frozen=True)
class Context:
    approved: bool
    project_found: bool
    source_path: str | None
    rights_confirmed: bool
    project_type: str
    lang: str
    length_preset: str


# ---------- 순수 판정(테스트 대상) ----------

def claim_decision(status: str, read_ct: int) -> ClaimDecision:
    """queued → 점유. running이고 재전달(read_ct>1)이면 이전 워커가 lease를 잃은 것 → 이어서 처리. 나머지는 버린다."""
    if status == "queued":
        return "claim"
    if status == "running" and read_ct > 1:
        return "resume"
    return "drop"


def can_progress(status: str | None) -> bool:
    """단계 시작·완료 기록은 running일 때만."""
    return status == "running"


def can_fail(status: str | None) -> bool:
    """실패·환불은 아직 끝나지 않은 작업만(canceled는 cancel_analyze가 이미 환불)."""
    return status in ("queued", "running")


def refund_key(job_id: UUID, attempt_no: int) -> str:
    return f"{job_id}:refund:{attempt_no}"


def source_path_ok(path: str | None, user_id: UUID, project_id: UUID) -> bool:
    if not path:
        return False
    pattern = SOURCE_PATH_RE.format(uid=re.escape(str(user_id)), pid=re.escape(str(project_id)))
    return re.fullmatch(pattern, path) is not None


def is_repeat_source(count_30d: int) -> bool:
    """같은 원본(SHA-256)을 30일 안 3번째 쓰면 반복 원본(PLAN 13-6)."""
    return count_30d >= 3


# ---------- Postgres ----------

_LOCK_JOB = (
    "select status, kind, user_id, project_id, attempt_no, cost_credits "
    "from studio.jobs where id = %s for update"
)
_USER_LOCK = "select pg_advisory_xact_lock(hashtextextended(%s::text, 0))"  # spend/refund/start/cancel과 같은 키


class PgRepo:
    def __init__(self, conn: Any, queue: str) -> None:
        if not _QUEUE_NAME_RE.match(queue):
            raise ValueError("invalid queue name")
        self.conn = conn  # psycopg.Connection(autocommit=True, row_factory=dict_row)
        self.queue = queue
        self._qtable = sql.Identifier("pgmq", f"q_{queue}")

    # ----- 큐 -----
    def read(self, vt: int) -> QueueMessage | None:
        with self.conn.cursor() as cur:
            cur.execute("select msg_id, read_ct, message from pgmq.read(%s, %s, %s)", (self.queue, vt, 1))
            row = cur.fetchone()
        if row is None:
            return None
        return QueueMessage(int(row["msg_id"]), int(row["read_ct"]), row["message"] or {})

    def _owns(self, cur: Any, lease: QueueMessage) -> bool:
        cur.execute(
            sql.SQL("select 1 as ok from {} where msg_id = %s and read_ct = %s for update").format(self._qtable),
            (lease.msg_id, lease.read_ct),
        )
        return cur.fetchone() is not None

    def archive(self, lease: QueueMessage) -> bool:
        """아직 내 메시지일 때만 archive(다른 워커가 다시 읽었으면 건드리지 않는다)."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            if not self._owns(cur, lease):
                return False
            cur.execute("select pgmq.archive(%s, %s::bigint)", (self.queue, lease.msg_id))
            return True

    def renew(self, lease: QueueMessage, vt: int) -> bool:
        """lease 갱신(vt 연장). read_ct가 다르면 False = 소유권 상실."""
        with self.conn.cursor() as cur:
            cur.execute(
                sql.SQL("update {} set vt = clock_timestamp() + make_interval(secs => %s) "
                        "where msg_id = %s and read_ct = %s").format(self._qtable),
                (vt, lease.msg_id, lease.read_ct),
            )
            return cur.rowcount == 1

    # ----- 잠금 -----
    def _lock(self, cur: Any, job_id: UUID) -> dict | None:
        cur.execute(_LOCK_JOB, (job_id,))
        return cur.fetchone()

    def _guard(self, cur: Any, job: Job, lease: QueueMessage) -> Status:
        row = self._lock(cur, job.id)
        if not self._owns(cur, lease):
            return "lost"
        if row is None or not can_progress(row["status"]):
            return "inactive"
        return "ok"

    @staticmethod
    def _job(job_id: UUID, row: dict) -> Job:
        return Job(job_id, row["user_id"], row["project_id"], int(row["attempt_no"]), int(row["cost_credits"] or 1))

    # ----- 점유 -----
    def claim(self, job_id: UUID, lease: QueueMessage) -> Job | None:
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job_id)
            if row is None or row["kind"] != "analyze" or row["project_id"] is None or not self._owns(cur, lease):
                return None
            decision = claim_decision(row["status"], lease.read_ct)
            if decision == "drop":
                return None
            if decision == "claim":
                cur.execute(
                    "update studio.jobs set status = 'running', started_at = now() where id = %s and status = 'queued'",
                    (job_id,),
                )
            return self._job(job_id, row)

    def lock_for_max_attempts(self, job_id: UUID, lease: QueueMessage) -> Job | None:
        """read_ct 초과 메시지의 job(끝나지 않았고 메시지가 아직 내 것일 때)."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job_id)
            if (row is None or row["kind"] != "analyze" or not can_fail(row["status"])
                    or row["project_id"] is None or not self._owns(cur, lease)):
                return None
            return self._job(job_id, row)

    # ----- 재검증용 문맥 -----
    def load_context(self, job: Job) -> Context:
        with self.conn.cursor() as cur:
            cur.execute(
                "select p.source_path, p.rights_confirmed_at, p.license_type, p.type, p.lang, p.length_preset, "
                "  (select pr.approved_at from studio.profiles pr where pr.user_id = p.user_id) as approved_at "
                "from studio.projects p where p.id = %s and p.user_id = %s and p.deleted_at is null",
                (job.project_id, job.user_id),
            )
            row = cur.fetchone()
        if row is None:
            return Context(False, False, None, False, "", "", "")
        return Context(
            approved=row["approved_at"] is not None,
            project_found=True,
            source_path=row["source_path"],
            rights_confirmed=row["rights_confirmed_at"] is not None and row["license_type"] is not None,
            project_type=row["type"],
            lang=row["lang"],
            length_preset=row["length_preset"],
        )

    # ----- 단계 -----
    def begin_step(self, job: Job, lease: QueueMessage, step_no: int) -> Status:
        """running이고 내 lease일 때만 단계 시작 기록. 3단계는 이 커밋 뒤에야 LLM을 부른다(취소 경쟁 방지)."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            st = self._guard(cur, job, lease)
            if st != "ok":
                return st
            cur.execute(
                "update studio.job_steps set started_at = now(), done_at = null, error_code = null "
                "where job_id = %s and step_no = %s",
                (job.id, step_no),
            )
            cur.execute(
                "update studio.jobs set step_name = "
                "(select label from studio.job_steps where job_id = %s and step_no = %s) where id = %s",
                (job.id, step_no, job.id),
            )
            return "ok"

    def finish_step(self, job: Job, lease: QueueMessage, step_no: int) -> Status:
        with self.conn.transaction(), self.conn.cursor() as cur:
            st = self._guard(cur, job, lease)
            if st != "ok":
                return st
            cur.execute(
                "update studio.job_steps set done_at = now() where job_id = %s and step_no = %s",
                (job.id, step_no),
            )
            return "ok"

    def record_source(self, job: Job, lease: QueueMessage, sha256: str) -> tuple[Status, bool]:
        """원본 해시 기록 + 30일 안 3번째면 policy_flags(repeat_source).
        사용자 advisory lock으로 같은 사용자의 판정을 줄 세운다(동시 분석 2건이 서로를 못 세는 경쟁 방지)."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(_USER_LOCK, (job.user_id,))
            st = self._guard(cur, job, lease)
            if st != "ok":
                return st, False
            cur.execute("update studio.projects set source_sha256 = %s where id = %s", (sha256, job.project_id))
            cur.execute(
                "select count(*) as n from studio.projects where user_id = %s and source_sha256 = %s "
                "and created_at >= now() - interval '30 days'",
                (job.user_id, sha256),
            )
            if not is_repeat_source(int(cur.fetchone()["n"])):
                return "ok", False
            cur.execute(
                "insert into studio.policy_flags (job_id, user_id, project_id, type) "
                "select %s, %s, %s, 'repeat_source' where not exists ("
                "  select 1 from studio.policy_flags where project_id = %s and type = 'repeat_source')",
                (job.id, job.user_id, job.project_id, job.project_id),
            )
            return "ok", True

    # ----- 종료 -----
    def complete(self, job: Job, lease: QueueMessage, edit_state: dict[str, Any]) -> Status:
        with self.conn.transaction(), self.conn.cursor() as cur:
            st = self._guard(cur, job, lease)
            if st != "ok":
                return st
            cur.execute(
                "insert into studio.drafts (project_id, user_id, version, edit_state) values (%s, %s, 1, %s) "
                "on conflict (project_id, version) do nothing",
                (job.project_id, job.user_id, Jsonb(edit_state)),
            )
            cur.execute(
                "update studio.jobs set status = 'done', finished_at = now() where id = %s", (job.id,)
            )
            cur.execute(
                "update studio.projects set status = 'editing' where id = %s and status = 'analyzing'",
                (job.project_id,),
            )
            return "ok"

    def fail(self, job: Job, lease: QueueMessage, step_no: int | None, code: str) -> Status:
        """최종 실패: jobs·projects failed, 단계 error_code, 크레딧 환불(같은 트랜잭션).
        이미 끝난 작업·잃은 lease는 손대지 않는다."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute(_USER_LOCK, (job.user_id,))
            row = self._lock(cur, job.id)
            if not self._owns(cur, lease):
                return "lost"
            if row is None or not can_fail(row["status"]):
                return "inactive"
            cur.execute(
                "update studio.jobs set status = 'failed', finished_at = now() where id = %s", (job.id,)
            )
            if step_no is None:  # 단계를 모를 때(읽기 횟수 초과): 마지막으로 시작한 단계, 없으면 1단계
                cur.execute(
                    "update studio.job_steps set error_code = %s where id = ("
                    "  select id from studio.job_steps where job_id = %s "
                    "  order by case when started_at is null then 0 else step_no end desc, step_no limit 1)",
                    (code, job.id),
                )
            else:
                cur.execute(
                    "update studio.job_steps set error_code = %s where job_id = %s and step_no = %s",
                    (code, job.id, step_no),
                )
            cur.execute(
                "update studio.projects set status = 'failed' where id = %s and status = 'analyzing'",
                (job.project_id,),
            )
            cur.execute(
                "select studio.refund_credits(%s, %s, %s, %s, %s) as r",
                (job.user_id, job.cost_credits, job.id, job.attempt_no, refund_key(job.id, job.attempt_no)),
            )
            result = cur.fetchone()["r"]
            if result not in REFUND_OK:
                raise RuntimeError(f"refund_credits returned {result}")  # 롤백: 상태도 바꾸지 않는다
            return "ok"
