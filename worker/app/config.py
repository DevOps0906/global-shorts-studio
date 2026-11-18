"""워커 설정. 필수 값이 없으면 시작 시 실패한다(조용한 기본값 금지)."""

from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: SecretStr
    supabase_url: str
    supabase_service_role_key: SecretStr
    anthropic_api_key: SecretStr
    llm_model: str  # 예: claude-sonnet-5-5 (task-006 사용자 결정)

    llm_fallback: bool = True  # 서버 측 fallback(server-side-fallback-2026-07-01, fallbacks="default")
    llm_effort: Literal["low", "medium", "high"] = "medium"
    llm_max_tokens: int = 16000
    whisper_model: str = "small"  # 이미지에서는 revision 고정 로컬 경로(/opt/whisper-small)
    scenes_timeout_seconds: float = 180
    transcribe_timeout_seconds: float = 300

    queue_name: str = "analyze"
    queue_vt_seconds: int = 120  # lease. 처리 중 vt/3마다 백그라운드로 갱신한다
    max_read_ct: int = 3  # 이 횟수를 넘겨 읽힌 메시지는 실패·환불·archive
    poll_seconds: float = 2.0
    source_bucket: str = "sources"
    max_source_bytes: int = 524_288_000  # 500MB(버킷 한도와 같음)
    work_dir: str = "/tmp/gss-worker"
