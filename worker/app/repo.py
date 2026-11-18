"""DB 접근(psycopg, Postgres 직접 연결). 큐(pgmq)·jobs·job_steps·projects·drafts·환불.

상태를 바꾸는 모든 쓰기는 한 트랜잭션에서 jobs 행을 `for update`로 잠근 뒤 status를 다시 확인한다.
- 사용자가 취소(cancel_analyze)하면 status='canceled'가 되고 큐 메시지는 남는다 → 워커는 멈추고 메시지만 archive.
- canceled·done·failed 행을 done·failed로 덮어쓰거나 다시 환불하지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from psycopg.types.json import Jsonb

ClaimDecision = Literal["claim", "resume", "drop"]
SOURCE_PATH_RE = r"^{uid}/{pid}/source\.(mp4|mov|webm)$"
REFUND_OK = ("ok", "duplicate", "no_charge")


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
    """queued → 점유. running이고 재전달(read_ct>1)이면 워커 재시작 뒤 이어서 처리. 나머지는 버린다."""
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


class PgRepo:
    def __init__(self, conn: Any, queue: str) -> None:
        self.conn = conn  # psycopg.Connection(autocommit=True, row_factory=dict_row)
        self.queue = queue

    # ----- 큐 -----
    def read(self, vt: int) -> QueueMessage | None:
        with self.conn.cursor() as cur:
            cur.execute("select msg_id, read_ct, message from pgmq.read(%s, %s, %s)", (self.queue, vt, 1))
            row = cur.fetchone()
        if row is None:
            return None
        return QueueMessage(int(row["msg_id"]), int(row["read_ct"]), row["message"] or {})

    def archive(self, msg_id: int) -> None:
        with self.conn.cursor() as cur:
            cur.execute("select pgmq.archive(%s, %s::bigint)", (self.queue, msg_id))

    def extend(self, msg_id: int, vt: int) -> None:
        with self.conn.cursor() as cur:
            cur.execute("select pgmq.set_vt(%s, %s::bigint, %s)", (self.queue, msg_id, vt))

    # ----- 잠금 -----
    def _lock(self, cur: Any, job_id: UUID) -> dict | None:
        cur.execute(_LOCK_JOB, (job_id,))
        return cur.fetchone()

    @staticmethod
    def _job(job_id: UUID, row: dict) -> Job:
        return Job(job_id, row["user_id"], row["project_id"], int(row["attempt_no"]), int(row["cost_credits"] or 1))

    # ----- 점유 -----
    def claim(self, job_id: UUID, read_ct: int) -> Job | None:
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job_id)
            if row is None or row["kind"] != "analyze" or row["project_id"] is None:
                return None
            decision = claim_decision(row["status"], read_ct)
            if decision == "drop":
                return None
            if decision == "claim":
                cur.execute(
                    "update studio.jobs set status = 'running', started_at = now() where id = %s and status = 'queued'",
                    (job_id,),
                )
            return self._job(job_id, row)

    def lock_for_max_attempts(self, job_id: UUID) -> Job | None:
        """read_ct 초과 메시지의 job(끝나지 않았으면)."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job_id)
            if row is None or row["kind"] != "analyze" or not can_fail(row["status"]) or row["project_id"] is None:
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
    def begin_step(self, job_id: UUID, step_no: int) -> bool:
        """jobs를 잠그고 running일 때만 단계 시작을 기록. 3단계는 이 커밋 뒤에야 LLM을 부른다(취소 경쟁 방지)."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job_id)
            if row is None or not can_progress(row["status"]):
                return False
            cur.execute(
                "update studio.job_steps set started_at = now(), done_at = null, error_code = null "
                "where job_id = %s and step_no = %s",
                (job_id, step_no),
            )
            cur.execute(
                "update studio.jobs set step_name = "
                "(select label from studio.job_steps where job_id = %s and step_no = %s) where id = %s",
                (job_id, step_no, job_id),
            )
            return True

    def finish_step(self, job_id: UUID, step_no: int) -> bool:
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job_id)
            if row is None or not can_progress(row["status"]):
                return False
            cur.execute(
                "update studio.job_steps set done_at = now() where job_id = %s and step_no = %s",
                (job_id, step_no),
            )
            return True

    def record_source(self, job: Job, sha256: str) -> bool:
        """원본 해시 기록 + 30일 안 3번째면 policy_flags(repeat_source). 반환: 반복 원본 여부."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            cur.execute("update studio.projects set source_sha256 = %s where id = %s", (sha256, job.project_id))
            cur.execute(
                "select count(*) as n from studio.projects where user_id = %s and source_sha256 = %s "
                "and created_at >= now() - interval '30 days'",
                (job.user_id, sha256),
            )
            if not is_repeat_source(int(cur.fetchone()["n"])):
                return False
            cur.execute(
                "insert into studio.policy_flags (job_id, user_id, project_id, type) "
                "select %s, %s, %s, 'repeat_source' where not exists ("
                "  select 1 from studio.policy_flags where project_id = %s and type = 'repeat_source')",
                (job.id, job.user_id, job.project_id, job.project_id),
            )
            return True

    # ----- 종료 -----
    def complete(self, job: Job, edit_state: dict[str, Any]) -> bool:
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job.id)
            if row is None or not can_progress(row["status"]):
                return False
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
            return True

    def fail(self, job: Job, step_no: int | None, code: str) -> bool:
        """최종 실패: jobs·projects failed, 단계 error_code, 크레딧 환불(같은 트랜잭션). 이미 끝난 작업은 손대지 않는다."""
        with self.conn.transaction(), self.conn.cursor() as cur:
            row = self._lock(cur, job.id)
            if row is None or not can_fail(row["status"]):
                return False
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
            return True
