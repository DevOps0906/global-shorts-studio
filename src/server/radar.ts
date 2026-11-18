import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getChannels, getVideos, lookupChannel, recentUploads, YoutubeError, type YtVideo } from "@/server/youtube";
import { isShort, nextQuotaReset, parseChannelInput, quotaDay } from "@/server/youtube-parse";

// 레이더·저장 채널(task-005). 원본 지표(조회수·구독자·게시 경과)만 다룬다 — 파생 지표 계산 금지(PLAN 7-2).
// 쓰기는 모두 DB 함수(radar.add_channel·claim_*·upsert_videos) 경유, 사용자 세션(RLS)으로 호출한다.

export type ChannelGroup = "ref" | "ref200";

export type RadarChannel = {
  id: number;
  handle: string;
  name: string | null;
  subs: number | null;
  grp: ChannelGroup;
  tracking: boolean;
  lastScanLabel: string | null;
};

export type RadarItem = {
  id: number;
  ytVideoId: string;
  title: string;
  channel: string;
  grp: ChannelGroup;
  subs: number | null;
  views: number | null;
  /** 게시 후 경과 시간(정수) */
  hours: number;
  durationS: number;
  thumbnailUrl: string | null;
  /** first_seen_at 24시간 이내 */
  isNew: boolean;
};

export type RadarData = {
  channels: RadarChannel[];
  items: RadarItem[];
  /** 가장 최근 스캔 시각(표시용) */
  lastScanLabel: string | null;
  /** 오늘(LA 기준) 내 YouTube 쿼터 사용 유닛 */
  usedUnits: number;
};

export type Fail = { ok: false; status: number; code: string; message: string; resetAt?: string };

/** 사용자 일일 쿼터(DB radar.claim_* 와 같은 값) */
export const USER_DAILY_UNITS = 1000;
/** 레이더에 싣는 게시 기간(시간 필터 최댓값 10일) */
const WINDOW_HOURS = 240;
const HOUR = 3_600_000;

const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** `11.15. 오후 9:48` 형식(KST) */
export function timeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const p = Object.fromEntries(timeFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}.${p.day}. ${p.dayPeriod} ${p.hour}:${p.minute}`;
}

function fail(status: number, code: string, message: string, resetAt?: string): Fail {
  return { ok: false, status, code, message, ...(resetAt ? { resetAt } : {}) };
}

const dbFail = () => fail(500, "UPSTREAM_ERROR", "잠시 후 다시 시도해 주세요.");

function claimFail(reason: string): Fail {
  const reset = nextQuotaReset().toISOString();
  switch (reason) {
    case "not_approved":
      return fail(403, "NOT_APPROVED", "승인된 회원만 쓸 수 있어요.");
    case "too_soon":
      return fail(429, "RATE_LIMITED", "스캔은 10분에 한 번 할 수 있어요.");
    case "user_daily_limit":
      return fail(429, "RATE_LIMITED", `오늘 쓸 수 있는 YouTube 사용량(${USER_DAILY_UNITS.toLocaleString("en-US")})을 다 썼어요.`, reset);
    case "lookup_limit":
      return fail(429, "RATE_LIMITED", "채널 확인은 하루 50번까지 할 수 있어요.", reset);
    case "channel_limit":
      return fail(409, "CHANNEL_LIMIT", "저장 채널은 50개까지예요. 안 쓰는 채널을 지운 뒤 추가해 주세요.");
    case "quota_exhausted":
      return fail(429, "YT_QUOTA_EXCEEDED", "오늘 YouTube 사용량이 모두 소진됐어요.", reset);
    default:
      return dbFail();
  }
}

/** YouTube 오류 → 응답. 쿼터 소진은 이 요청만 YT_QUOTA_EXCEEDED(전역 차단 표시는 하지 않는다) */
function onYoutubeError(e: unknown): Fail {
  if (e instanceof YoutubeError && e.code === "YT_QUOTA_EXCEEDED") {
    return fail(429, "YT_QUOTA_EXCEEDED", "오늘 YouTube 사용량이 모두 소진됐어요.", e.resetAt);
  }
  if (!(e instanceof YoutubeError)) console.error("[radar] 예기치 않은 오류", e instanceof Error ? e.message : "");
  return fail(502, "UPSTREAM_ERROR", "YouTube 응답이 없어요. 잠시 후 다시 시도해 주세요.");
}

type ChannelRow = {
  id: number;
  handle: string;
  name: string | null;
  subs: number | null;
  grp: ChannelGroup;
  tracking: boolean;
  last_scan_at: string | null;
};

type VideoRow = {
  id: number;
  yt_video_id: string;
  title: string;
  published_at: string;
  duration_s: number;
  thumbnail_url: string | null;
  views: number | null;
  first_seen_at: string;
  channels: { name: string | null; handle: string; subs: number | null; grp: ChannelGroup } | null;
};

/** 저장 채널·최근 10일 쇼츠(withVideos)·오늘 사용량. 실패 시 null(화면은 오류 상태) */
export async function loadRadarData(withVideos = true): Promise<RadarData | null> {
  const sb = await createClient();
  const radar = sb.schema("radar");
  const now = Date.now();
  const [ch, vd, qu] = await Promise.all([
    radar.from("channels").select("id, handle, name, subs, grp, tracking, last_scan_at").order("created_at", { ascending: false }),
    withVideos
      ? radar
      .from("videos")
      .select("id, yt_video_id, title, published_at, duration_s, thumbnail_url, views, first_seen_at, channels(name, handle, subs, grp)")
      .gte("published_at", new Date(now - WINDOW_HOURS * HOUR).toISOString())
      .order("published_at", { ascending: false })
      .limit(1000)
      : { data: [], error: null },
    radar.from("quota_usage").select("units").eq("day", quotaDay()).maybeSingle(),
  ]);
  if (ch.error || vd.error || qu.error) {
    console.error("[radar] 목록 조회 실패", ch.error?.code ?? vd.error?.code ?? qu.error?.code);
    return null;
  }

  const chRows = (ch.data ?? []) as ChannelRow[];
  const channels: RadarChannel[] = chRows.map((c) => ({
    id: c.id,
    handle: c.handle,
    name: c.name,
    subs: c.subs,
    grp: c.grp,
    tracking: c.tracking,
    lastScanLabel: timeLabel(c.last_scan_at),
  }));
  const last = chRows.reduce<string | null>((m, c) => (c.last_scan_at && (!m || c.last_scan_at > m) ? c.last_scan_at : m), null);

  const items: RadarItem[] = ((vd.data ?? []) as unknown as VideoRow[]).map((v) => ({
    id: v.id,
    ytVideoId: v.yt_video_id,
    title: v.title,
    channel: v.channels?.name ?? v.channels?.handle ?? "",
    grp: v.channels?.grp ?? "ref",
    subs: v.channels?.subs ?? null,
    views: v.views,
    hours: Math.max(0, Math.floor((now - Date.parse(v.published_at)) / HOUR)),
    durationS: v.duration_s,
    thumbnailUrl: v.thumbnail_url,
    isNew: now - Date.parse(v.first_seen_at) < 24 * HOUR,
  }));

  return { channels, items, lastScanLabel: timeLabel(last), usedUnits: (qu.data as { units: number } | null)?.units ?? 0 };
}

/** 채널 추가: 입력 검증 → claim_lookup(1유닛) → channels.list → add_channel */
export async function addChannel(rawInput: unknown, rawGrp: unknown): Promise<{ ok: true; name: string } | Fail> {
  const input = typeof rawInput === "string" ? parseChannelInput(rawInput) : null;
  if (!input) {
    return fail(400, "INVALID_CHANNEL_INPUT", "@핸들, youtube.com/@핸들, youtube.com/channel/UC… 형식으로 입력해 주세요.");
  }
  const grp: ChannelGroup = rawGrp === "ref200" ? "ref200" : "ref";
  const sb = await createClient();
  const radar = sb.schema("radar");

  // 이미 저장한 채널이면 쿼터를 쓰지 않고 바로 알린다
  const dup = await radar
    .from("channels")
    .select("id")
    .eq(input.kind === "id" ? "yt_channel_id" : "handle", input.value)
    .limit(1);
  if (dup.error) return dbFail();
  if (dup.data?.length) return fail(409, "CHANNEL_DUPLICATE", "이미 저장한 채널이에요.");

  const claim = await radar.rpc("claim_lookup");
  if (claim.error) return dbFail();
  if (claim.data !== "ok") return claimFail(String(claim.data));

  let found;
  try {
    found = await lookupChannel(input);
  } catch (e) {
    return onYoutubeError(e);
  }
  if (!found) return fail(404, "CHANNEL_NOT_FOUND", "채널을 찾지 못했어요. 주소나 핸들을 확인해 주세요.");

  const res = await radar.rpc("add_channel", {
    p_handle: found.handle ?? (input.kind === "handle" ? input.value : found.ytChannelId),
    p_name: found.name,
    p_yt_channel_id: found.ytChannelId,
    p_uploads_playlist_id: found.uploadsPlaylistId,
    p_subs: found.subs,
    p_grp: grp,
  });
  if (res.error) return dbFail();
  if (res.data === "duplicate") return fail(409, "CHANNEL_DUPLICATE", "이미 저장한 채널이에요.");
  if (res.data !== "ok") return claimFail(String(res.data));
  return { ok: true, name: found.name };
}

/** 추적 켜기/끄기·그룹 변경(RLS + 컬럼 권한) */
export async function updateChannel(id: number, patch: { tracking?: boolean; grp?: ChannelGroup }): Promise<{ ok: true } | Fail> {
  const sb = await createClient();
  const { data, error } = await sb.schema("radar").from("channels").update(patch).eq("id", id).select("id");
  if (error) return dbFail();
  if (!data?.length) return fail(404, "CHANNEL_NOT_FOUND", "채널을 찾지 못했어요.");
  return { ok: true };
}

export async function deleteChannel(id: number): Promise<{ ok: true } | Fail> {
  const sb = await createClient();
  const { data, error } = await sb.schema("radar").from("channels").delete().eq("id", id).select("id");
  if (error) return dbFail();
  if (!data?.length) return fail(404, "CHANNEL_NOT_FOUND", "채널을 찾지 못했어요.");
  return { ok: true };
}

type ScanChannel = { id: number; name: string | null; handle: string; yt_channel_id: string; uploads_playlist_id: string };

/**
 * 스캔: 추적 켠 채널 최대 50개. claim_scan(예상 유닛)을 먼저 확보한 뒤
 * channels.list 1 + playlistItems 채널당 1 + videos.list 50개당 1. 404 채널은 건너뛰고 보고한다.
 */
export async function scanChannels(): Promise<{ ok: true; scanned: number; saved: number; skipped: string[] } | Fail> {
  const sb = await createClient();
  const radar = sb.schema("radar");
  const ch = await radar
    .from("channels")
    .select("id, name, handle, yt_channel_id, uploads_playlist_id")
    .eq("tracking", true)
    .order("id")
    .limit(50);
  if (ch.error) return dbFail();
  const chans = (ch.data ?? []) as ScanChannel[];
  if (chans.length === 0) return fail(400, "NO_CHANNELS", "추적 중인 저장 채널이 없어요. 채널을 먼저 추가해 주세요.");

  // 상한 추정: channels.list 1 + 채널당 playlistItems 1 + videos.list(채널당 최대 50개 → 채널당 최대 1)
  const claim = await radar.rpc("claim_scan", { p_units: 1 + chans.length * 2 });
  if (claim.error) return dbFail();
  if (claim.data !== "ok") return claimFail(String(claim.data));

  const cutoff = Date.now() - WINDOW_HOURS * HOUR;
  const skipped: string[] = [];
  const skippedIds = new Set<number>();
  const owner = new Map<string, number>(); // yt_video_id → channel id
  let meta: Awaited<ReturnType<typeof getChannels>>;
  let videos: YtVideo[];
  try {
    // 이름·구독자 갱신용: 쿼터 소진 외 실패는 갱신만 건너뛴다
    meta = await getChannels(chans.map((c) => c.yt_channel_id)).catch((e: unknown) => {
      if (e instanceof YoutubeError && e.code === "YT_QUOTA_EXCEEDED") throw e;
      return new Map();
    });
    for (let i = 0; i < chans.length; i += 10) {
      const batch = chans.slice(i, i + 10);
      // 채널별 실패(404·일시 오류)는 건너뛰고 보고, 쿼터 소진만 전체 중단
      const lists = await Promise.allSettled(batch.map((c) => recentUploads(c.uploads_playlist_id)));
      lists.forEach((r, j) => {
        const c = batch[j];
        if (r.status === "rejected" && r.reason instanceof YoutubeError && r.reason.code === "YT_QUOTA_EXCEEDED") throw r.reason;
        const list = r.status === "fulfilled" ? r.value : null;
        if (!list) {
          skippedIds.add(c.id);
          skipped.push(c.name ?? c.handle);
          return;
        }
        for (const it of list) if (Date.parse(it.publishedAt) >= cutoff) owner.set(it.videoId, c.id);
      });
    }
    videos = await getVideos([...owner.keys()]);
  } catch (e) {
    return onYoutubeError(e);
  }

  const byChannel = new Map<number, YtVideo[]>();
  for (const v of videos) {
    const cid = owner.get(v.ytVideoId);
    if (cid === undefined || !isShort(v.durationS)) continue;
    byChannel.set(cid, [...(byChannel.get(cid) ?? []), v]);
  }

  let saved = 0;
  for (const c of chans) {
    if (skippedIds.has(c.id)) continue;
    const m = meta.get(c.yt_channel_id);
    const list = (byChannel.get(c.id) ?? []).slice(0, 50).map((v) => ({
      yt_video_id: v.ytVideoId,
      title: v.title,
      published_at: v.publishedAt,
      duration_s: v.durationS,
      thumbnail_url: v.thumbnailUrl,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
    }));
    const res = await radar.rpc("upsert_videos", {
      p_channel_id: c.id,
      p_videos: list,
      p_name: m?.name ?? null,
      p_subs: m?.subs ?? null,
    });
    if (res.error) {
      console.error("[radar] upsert_videos 실패", res.error.code);
      skippedIds.add(c.id);
      skipped.push(c.name ?? c.handle);
      continue;
    }
    saved += Number(res.data) || 0;
  }
  return { ok: true, scanned: chans.length - skippedIds.size, saved, skipped };
}
