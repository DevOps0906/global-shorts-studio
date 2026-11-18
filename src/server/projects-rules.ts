// 작업물·분석 요청 검증과 DB 결과 → API 오류 매핑(task-006a). 순수 함수만(단위 테스트 대상).
// 계약 정본: tasks/task-006-contract.md

export const PROJECT_TYPES = ["video", "script"] as const;
export const PROJECT_LANGS = ["ko", "ja", "both"] as const;
export const LENGTH_PRESETS = ["keep", "short", "mid", "long"] as const;
export const LICENSE_TYPES = ["own", "permission", "license", "etc"] as const;
/** Storage 버킷 sources 와 같은 값(마이그레이션 20261119100000) */
export const SOURCE_MAX_BYTES = 500 * 1024 * 1024;
const MIME_EXT: Record<string, "mp4" | "mov" | "webm"> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type Fail = { ok: false; status: number; code: string; message: string; jobId?: string };

export function fail(status: number, code: string, message: string, jobId?: string): Fail {
  return { ok: false, status, code, message, ...(jobId ? { jobId } : {}) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export type NewProjectInput = { type: string; lang: string; length: string; ext: "mp4" | "mov" | "webm" };

/** POST /api/projects 본문 검증. 형식·크기 오류는 PLAN 13-4 코드로 */
export function parseNewProject(body: Record<string, unknown>): NewProjectInput | Fail {
  const { type, lang, length, mimeType, size } = body;
  if (!oneOf(PROJECT_TYPES, type) || !oneOf(PROJECT_LANGS, lang) || !oneOf(LENGTH_PRESETS, length)) {
    return fail(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");
  }
  const ext = typeof mimeType === "string" && Object.hasOwn(MIME_EXT, mimeType) ? MIME_EXT[mimeType] : undefined;
  if (!ext) return fail(400, "UNSUPPORTED_FORMAT", "MP4·MOV·WebM 영상만 올릴 수 있어요.");
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
    return fail(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");
  }
  if (size > SOURCE_MAX_BYTES) return fail(413, "FILE_TOO_LARGE", "500MB 이하 영상만 올릴 수 있어요.");
  return { type, lang, length, ext };
}

/** POST /api/projects/:id/analyze 본문 → DB에 넘길 라이선스(권리 미확인이면 null → DB가 RIGHTS_NOT_CONFIRMED·기록) */
export function licenseOf(body: Record<string, unknown>): string | null {
  return body.rightsConfirmed === true && oneOf(LICENSE_TYPES, body.licenseType) ? body.licenseType : null;
}

/** studio.create_project 결과 */
export function createProjectFail(result: unknown): Fail {
  switch (result) {
    case "not_approved":
      return fail(403, "NOT_APPROVED", "승인된 회원만 쓸 수 있어요.");
    case "invalid_request":
      return fail(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");
    case "daily_limit":
      return fail(429, "RATE_LIMITED", "새 영상은 하루 30개까지 만들 수 있어요.");
    default:
      return fail(500, "UPSTREAM_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}

/** studio.start_analyze 결과 */
export function startAnalyzeFail(result: unknown, jobId?: string): Fail {
  switch (result) {
    case "not_approved":
      return fail(403, "NOT_APPROVED", "승인된 회원만 쓸 수 있어요.");
    case "not_found":
      return fail(404, "NOT_FOUND", "작업물을 찾을 수 없어요.");
    case "invalid_state":
      return fail(409, "INVALID_STATE", "이미 분석이 끝난 작업물이에요.");
    case "source_missing":
      return fail(409, "SOURCE_NOT_UPLOADED", "원본 영상 업로드가 끝나지 않았어요.");
    case "invalid_source":
      return fail(400, "UNSUPPORTED_FORMAT", "이 원본으로는 분석할 수 없어요. 영상 파일을 다시 올려 주세요.");
    case "rights_not_confirmed":
      return fail(400, "RIGHTS_NOT_CONFIRMED", "영상 권리 확인과 라이선스 유형을 선택해 주세요.");
    case "already_running":
      return fail(409, "JOB_ALREADY_RUNNING", "이 영상은 이미 분석 중이에요.", jobId);
    case "concurrency_limit":
      return fail(429, "CONCURRENCY_LIMIT", "분석은 동시에 2개까지 할 수 있어요. 진행 중인 분석이 끝난 뒤 다시 시도해 주세요.");
    case "daily_limit":
      return fail(429, "RATE_LIMITED", "분석은 하루 20번까지 시작할 수 있어요.");
    case "insufficient_credits":
      return fail(402, "INSUFFICIENT_CREDITS", "크레딧이 부족해요. 충전 후 다시 시도해 주세요.");
    default:
      return fail(500, "UPSTREAM_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}

/** studio.cancel_analyze 결과(ok 제외) */
export function cancelFail(result: unknown): Fail {
  switch (result) {
    case "not_approved":
      return fail(403, "NOT_APPROVED", "승인된 회원만 쓸 수 있어요.");
    case "not_found":
      return fail(404, "NOT_FOUND", "작업을 찾을 수 없어요.");
    case "not_cancelable":
      return fail(409, "NOT_CANCELABLE", "이미 끝난 작업이에요.");
    case "too_late":
      return fail(409, "CANCEL_TOO_LATE", "제목·대본 생성이 시작돼 취소할 수 없어요.");
    default:
      return fail(500, "UPSTREAM_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}
