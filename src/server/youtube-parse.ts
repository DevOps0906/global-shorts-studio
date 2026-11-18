// YouTube 입력·응답 해석 순수 함수(테스트: youtube-parse.test.mjs, `pnpm test`). 네트워크·비밀 없음.

export type ChannelInput = { kind: "handle"; value: string } | { kind: "id"; value: string };

/** 쇼츠 판정 상한(초) */
export const SHORTS_MAX_SECONDS = 180;

const HANDLE = /^@[\p{L}\p{N}._-]{3,30}$/u;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

/**
 * 허용 입력: `@핸들` · `youtube.com/@핸들` · `youtube.com/channel/UC…`(https·www·m 선택).
 * 그 밖(검색어·영상 주소·/c/·/user/)은 null — search.list(100유닛)를 쓰지 않기 위해서다.
 */
export function parseChannelInput(raw: string): ChannelInput | null {
  const s = raw.trim();
  if (!s || s.length > 200) return null;
  if (s.startsWith("@")) return HANDLE.test(s) ? { kind: "handle", value: s } : null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  let first: string;
  try {
    first = decodeURIComponent(parts[0]);
  } catch {
    return null;
  }
  if (first.startsWith("@")) return HANDLE.test(first) ? { kind: "handle", value: first } : null;
  if (first === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) return { kind: "id", value: parts[1] };
  return null;
}

/** ISO 8601 기간(PT1M5S·P1DT2H)을 초로. 형식이 틀리면 null */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m || iso === "P" || iso.endsWith("T")) return null;
  const [, d, h, min, sec] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + sec;
}

export function isShort(durationS: number): boolean {
  return durationS > 0 && durationS <= SHORTS_MAX_SECONDS;
}

const QUOTA_TZ = "America/Los_Angeles";

function zonedParts(t: number) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: QUOTA_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}

/** YouTube 쿼터 기준일(LA 날짜) `YYYY-MM-DD`. DB radar.quota_day()와 같은 기준 */
export function quotaDay(now: Date = new Date()): string {
  const { y, mo, d } = zonedParts(now.getTime());
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 다음 쿼터 초기화 시각(다음 LA 자정, 서머타임 반영) */
export function nextQuotaReset(now: Date = new Date()): Date {
  const { y, mo, d } = zonedParts(now.getTime());
  const target = Date.UTC(y, mo - 1, d + 1, 0, 0, 0); // LA 벽시계 기준 다음 날 0시를 UTC 숫자로
  let t = target;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(t);
    const wall = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    t += target - wall;
  }
  return new Date(t);
}
