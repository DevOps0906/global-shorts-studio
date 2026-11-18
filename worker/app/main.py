"""워커 진입점: pgmq 'analyze'를 한 건씩 읽어 처리한다. `python -m app.main`"""

from __future__ import annotations

import logging
import os
import signal
import time
from functools import partial

import anthropic
import psycopg
from psycopg.rows import dict_row

from . import llm
from .config import Settings
from .lease import LeaseKeeper
from .pipeline import Media, Pipeline
from .repo import PgRepo
from .storage import Storage

log = logging.getLogger("worker")
_stop = False


def _on_signal(*_: object) -> None:
    global _stop
    _stop = True


def build(settings: Settings, conn: psycopg.Connection, lease_conn: psycopg.Connection) -> Pipeline:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key.get_secret_value())

    def generate(duration: float, build_content):  # noqa: ANN001
        return llm.generate(
            client, model=settings.llm_model, max_tokens=settings.llm_max_tokens, effort=settings.llm_effort,
            fallback=settings.llm_fallback, duration=duration, build_content=build_content,
        )

    os.makedirs(settings.work_dir, exist_ok=True)
    lease_repo = PgRepo(lease_conn, settings.queue_name)  # 갱신 전용 연결(백그라운드 스레드만 사용)

    def lease_factory(msg):  # noqa: ANN001, ANN202
        return LeaseKeeper(lease_repo.renew, msg, settings.queue_vt_seconds, settings.queue_vt_seconds / 3)

    return Pipeline(
        repo=PgRepo(conn, settings.queue_name),
        storage=Storage(settings.supabase_url, settings.supabase_service_role_key.get_secret_value(),
                        settings.source_bucket, settings.max_source_bytes),
        media=Media(settings.whisper_model, settings.scenes_timeout_seconds, settings.transcribe_timeout_seconds),
        generate=generate,
        max_read_ct=settings.max_read_ct,
        work_dir=settings.work_dir,
        lease_factory=lease_factory,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # 요청 URL·헤더 로그 방지
    settings = Settings()
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)
    connect = partial(psycopg.connect, settings.database_url.get_secret_value(), autocommit=True,
                      row_factory=dict_row, prepare_threshold=None)
    while not _stop:
        try:
            with connect() as conn, connect() as lease_conn:
                pipeline = build(settings, conn, lease_conn)
                repo: PgRepo = pipeline.repo  # type: ignore[assignment]
                log.info("worker started (queue=%s)", settings.queue_name)
                while not _stop:
                    msg = repo.read(settings.queue_vt_seconds)
                    if msg is None:
                        time.sleep(settings.poll_seconds)
                        continue
                    try:
                        outcome = pipeline.handle(msg)
                    except psycopg.Error:
                        raise
                    except Exception:  # 예: 환불 함수 이상 → 롤백됨. 메시지는 vt 뒤 다시 처리된다.
                        log.exception("msg %d unhandled", msg.msg_id)
                        continue
                    log.info("msg %d -> %s", msg.msg_id, outcome)
        except psycopg.Error as e:
            # 메시지는 큐에 남는다(vt 뒤 재전달). 연결을 다시 맺는다.
            log.error("db error: %s; reconnecting", type(e).__name__)
            time.sleep(5)


if __name__ == "__main__":
    main()
