import "server-only";
import { nextQuotaReset, parseIsoDuration, type ChannelInput } from "@/server/youtube-parse";

// YouTube Data API v3 (서버 공용 키 YOUTUBE_API_KEY). search.list(100유닛)는 쓰지 않는다 — 모든 호출 1유닛.
// 키는 응답·로그에 넣지 않는다(요청 URL도 로그 금지).

const API = "https://www.googleapis.com/youtube/v3";

export type YoutubeErrorCode = "YT_QUOTA_EXCEEDED" | "UPSTREAM_ERROR";

export class YoutubeError extends Error {
  constructor(
    readonly code: YoutubeErrorCode,
    readonly resetAt?: string,
  ) {
    super(code);
  }
}

export type YtChannel = {
  ytChannelId: string;
  handle: string | null;
  name: string;
  subs: number | null;
  uploadsPlaylistId: string;
};

export type YtVideo = {
  ytVideoId: string;
  title: string;
  publishedAt: string;
  durationS: number;
  thumbnailUrl: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

type Json = Record<string, unknown>;

function obj(v: unknown): Json {
  return v && typeof v === "object" ? (v as Json) : {};
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown): number | null {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** 1유닛 GET. 404면 null(해당 채널만 건너뜀), 그 밖 오류는 YoutubeError */
async function ytGet(path: string, params: Record<string, string>): Promise<Json | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.error("[youtube] YOUTUBE_API_KEY 미설정");
    throw new YoutubeError("UPSTREAM_ERROR");
  }
  const qs = new URLSearchParams({ ...params, key });
  let res: Response;
  try {
    res = await fetch(`${API}/${path}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    console.error(`[youtube] ${path} 네트워크 오류`);
    throw new YoutubeError("UPSTREAM_ERROR");
  }
  const body = obj(await res.json().catch(() => null));
  if (res.ok) return body;

  const err = obj(body.error);
  const first = Array.isArray(err.errors) ? obj(err.errors[0]) : {};
  const reason = str(first.reason) ?? "";
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    throw new YoutubeError("YT_QUOTA_EXCEEDED", nextQuotaReset().toISOString());
  }
  if (res.status === 404) return null;
  // 키 오류(keyInvalid·accessNotConfigured·forbidden 등)·rateLimitExceeded·5xx: 사유만 기록(키·URL 제외)
  console.error(`[youtube] ${path} 실패 status=${res.status} reason=${reason || "unknown"}`);
  throw new YoutubeError("UPSTREAM_ERROR");
}

function toChannel(item: unknown): YtChannel | null {
  const it = obj(item);
  const id = str(it.id);
  const snippet = obj(it.snippet);
  const stats = obj(it.statistics);
  const uploads = str(obj(obj(it.contentDetails).relatedPlaylists).uploads);
  if (!id || !uploads) return null;
  const customUrl = str(snippet.customUrl);
  return {
    ytChannelId: id,
    handle: customUrl ? (customUrl.startsWith("@") ? customUrl : `@${customUrl}`) : null,
    name: str(snippet.title) ?? id,
    subs: stats.hiddenSubscriberCount === true ? null : num(stats.subscriberCount),
    uploadsPlaylistId: uploads,
  };
}

const CHANNEL_PARTS = "snippet,statistics,contentDetails";

/** channels.list(forHandle | id) 1유닛. 없는 채널이면 null */
export async function lookupChannel(input: ChannelInput): Promise<YtChannel | null> {
  const body = await ytGet("channels", {
    part: CHANNEL_PARTS,
    ...(input.kind === "handle" ? { forHandle: input.value } : { id: input.value }),
  });
  const items = body && Array.isArray(body.items) ? body.items : [];
  return items.length ? toChannel(items[0]) : null;
}

/** channels.list(id 최대 50개) 1유닛: 스캔 때 이름·구독자 갱신용. 응답에 없는 채널은 빠진다 */
export async function getChannels(ids: string[]): Promise<Map<string, YtChannel>> {
  const out = new Map<string, YtChannel>();
  if (ids.length === 0) return out;
  const body = await ytGet("channels", { part: CHANNEL_PARTS, id: ids.slice(0, 50).join(","), maxResults: "50" });
  for (const item of body && Array.isArray(body.items) ? body.items : []) {
    const c = toChannel(item);
    if (c) out.set(c.ytChannelId, c);
  }
  return out;
}

/** playlistItems.list(업로드 재생목록 최근 50개) 1유닛. 재생목록이 없으면 null */
export async function recentUploads(playlistId: string): Promise<{ videoId: string; publishedAt: string }[] | null> {
  const body = await ytGet("playlistItems", { part: "contentDetails", playlistId, maxResults: "50" });
  if (!body) return null;
  const out: { videoId: string; publishedAt: string }[] = [];
  for (const item of Array.isArray(body.items) ? body.items : []) {
    const cd = obj(obj(item).contentDetails);
    const videoId = str(cd.videoId);
    const publishedAt = str(cd.videoPublishedAt);
    if (videoId && publishedAt) out.push({ videoId, publishedAt });
  }
  return out;
}

function thumbnail(snippet: Json): string | null {
  const t = obj(snippet.thumbnails);
  const url = str(obj(t.high).url) ?? str(obj(t.medium).url) ?? str(obj(t.default).url);
  return url && url.startsWith("https://i.ytimg.com/") ? url : null;
}

/** videos.list(ID 50개씩, 채널 무관 묶음) 묶음당 1유닛 */
export async function getVideos(ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const body = await ytGet("videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.slice(i, i + 50).join(","),
      maxResults: "50",
    });
    for (const item of body && Array.isArray(body.items) ? body.items : []) {
      const it = obj(item);
      const id = str(it.id);
      const snippet = obj(it.snippet);
      const stats = obj(it.statistics);
      const durationS = parseIsoDuration(str(obj(it.contentDetails).duration) ?? "");
      const publishedAt = str(snippet.publishedAt);
      if (!id || durationS === null || !publishedAt) continue;
      out.push({
        ytVideoId: id,
        title: str(snippet.title) ?? "",
        publishedAt,
        durationS,
        thumbnailUrl: thumbnail(snippet),
        views: num(stats.viewCount),
        likes: num(stats.likeCount),
        comments: num(stats.commentCount),
      });
    }
  }
  return out;
}
