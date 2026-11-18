/** 작업물·분석 API 호출 도우미(계약: tasks/task-006-contract.md). 브라우저 전용. */

export const MAX_BYTES = 524_288_000;
export const MIME_BY_EXT: Record<string, "video/mp4" | "video/quicktime" | "video/webm"> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export type LicenseType = "own" | "permission" | "license" | "etc";
export const LICENSE_CHIPS: { v: LicenseType; l: string }[] = [
  { v: "own", l: "직접 촬영" },
  { v: "permission", l: "원작자 허락" },
  { v: "license", l: "라이선스 보유" },
  { v: "etc", l: "기타" },
];

export type ApiError = { status: number; code: string; message: string; jobId?: string };

/** 오류 코드별 사용자 문구(PLAN 13-4). 모르는 코드는 서버 메시지 대신 일반 문구 */
export const ERROR_TEXT: Record<string, string> = {
  UNAUTHENTICATED: "로그인이 풀렸어요. 다시 로그인해 주세요.",
  NOT_APPROVED: "아직 승인 전이라 사용할 수 없어요.",
  INVALID_REQUEST: "요청 내용이 올바르지 않아요. 다시 시도해 주세요.",
  UNSUPPORTED_FORMAT: "MP4·MOV·WebM 영상만 올릴 수 있어요.",
  FILE_TOO_LARGE: "파일이 500MB를 넘어요. 더 작은 영상을 골라 주세요.",
  RATE_LIMITED: "오늘 만들 수 있는 횟수를 모두 썼어요. 내일 다시 시도해 주세요.",
  UPSTREAM_ERROR: "서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.",
  RIGHTS_NOT_CONFIRMED: "권리 확인에 체크하고 권리 유형을 골라 주세요.",
  INSUFFICIENT_CREDITS: "크레딧이 부족해요. 충전하면 같은 설정으로 바로 이어갈 수 있어요.",
  NOT_FOUND: "작업을 찾을 수 없어요.",
  SOURCE_NOT_UPLOADED: "영상 업로드가 끝나지 않았어요. 영상을 다시 올려 주세요.",
  JOB_ALREADY_RUNNING: "이미 분석이 진행 중이에요.",
  INVALID_STATE: "이미 분석이 끝난 작업이에요.",
  CONCURRENCY_LIMIT: "동시에 분석할 수 있는 영상은 2개예요. 하나가 끝난 뒤 다시 시작해 주세요.",
  NOT_CANCELABLE: "이미 끝났거나 취소된 작업이에요.",
  CANCEL_TOO_LATE: "제목·대본 생성이 시작돼서 취소할 수 없어요.",
  DURATION_TOO_LONG: "영상이 3분을 넘어요. 3분 이하로 잘라서 다시 올려 주세요.",
};

export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

export async function postJson<T extends object>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | (T & { error?: { code?: string; message?: string; jobId?: string } })
      | null;
    if (res.ok && json) return { ok: true, data: json };
    return {
      ok: false,
      error: {
        status: res.status,
        code: json?.error?.code ?? "UPSTREAM_ERROR",
        message: json?.error?.message ?? "",
        jobId: json?.error?.jobId,
      },
    };
  } catch {
    return { ok: false, error: { status: 0, code: "UPSTREAM_ERROR", message: "network" } };
  }
}

/** 서명 URL로 PUT 업로드(진행률). supabase-js uploadToSignedUrl과 같은 멀티파트 본문 */
export function uploadSigned(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

/** 업로드 전 사전 검사. 통과하면 null, 아니면 오류 코드 */
export function checkFile(file: File): { code: "UNSUPPORTED_FORMAT" | "FILE_TOO_LARGE"; mime?: never } | { code: null; mime: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt = MIME_BY_EXT[ext];
  const mime = Object.values(MIME_BY_EXT).includes(file.type as never) ? file.type : byExt;
  if (!mime) return { code: "UNSUPPORTED_FORMAT" };
  if (file.size > MAX_BYTES) return { code: "FILE_TOO_LARGE" };
  if (file.size <= 0) return { code: "UNSUPPORTED_FORMAT" };
  return { code: null, mime };
}
