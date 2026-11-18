// 레이더 표시용 포맷(원본 값을 그대로 줄여 쓰기만 한다 — 파생 지표 계산 없음).

/** 1.2만 / 9,800 / null → "비공개" */
export function fmtCount(n: number | null): string {
  if (n === null) return "비공개";
  return n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString("ko-KR");
}

/** 75 → "1:15" */
export function fmtDuration(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 쿼터 초기화 시각 → "11.20. 오후 5:00"(KST) */
export function fmtReset(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.month}.${p.day}. ${p.dayPeriod} ${p.hour}:${p.minute}`;
}

export type ApiError = { code: string; message: string; resetAt?: string };

/** Route Handler 호출(JSON). 실패면 `{ error }`, 네트워크 오류는 UPSTREAM_ERROR */
export async function callApi<T>(url: string, method: string, body: unknown = {}): Promise<{ data: T } | { error: ApiError }> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as ({ error?: ApiError } & T) | null;
    if (!res.ok || !json) return { error: json?.error ?? { code: "UPSTREAM_ERROR", message: "잠시 후 다시 시도해 주세요." } };
    return { data: json };
  } catch {
    return { error: { code: "UPSTREAM_ERROR", message: "연결이 끊겼어요. 다시 시도해 주세요." } };
  }
}

/** 화면 하단 고지(YouTube API 서비스 약관 III.A) */
export const YT_TERMS_URL = "https://www.youtube.com/t/terms";
export const GOOGLE_PRIVACY_URL = "https://policies.google.com/privacy";
