"""단계 실패 코드. job_steps.error_code에 그대로 기록된다(화면은 코드로 문구를 고른다)."""


class StepError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


# 1단계(영상 확인·재검증)
NOT_APPROVED = "NOT_APPROVED"
RIGHTS_NOT_CONFIRMED = "RIGHTS_NOT_CONFIRMED"
INVALID_SOURCE = "INVALID_SOURCE"
SOURCE_MISSING = "SOURCE_MISSING"
FILE_TOO_LARGE = "FILE_TOO_LARGE"
UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
DURATION_TOO_LONG = "DURATION_TOO_LONG"
RESOLUTION_TOO_HIGH = "RESOLUTION_TOO_HIGH"
# 2·4단계
MEDIA_PROCESSING_FAILED = "MEDIA_PROCESSING_FAILED"
# 3단계(LLM)
LLM_REFUSED = "LLM_REFUSED"
LLM_SCHEMA_INVALID = "LLM_SCHEMA_INVALID"
LLM_UPSTREAM = "LLM_UPSTREAM"
# 공통
MAX_ATTEMPTS = "MAX_ATTEMPTS"
INTERNAL_ERROR = "INTERNAL_ERROR"
