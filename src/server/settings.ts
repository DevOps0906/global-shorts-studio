import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/auth";
import { defaultSettings, mockLangs, mockLengths, mockPresets, type SettingsValue } from "@/mocks/settings";

// 설정 화면(task-009). studio.user_settings 본인 행(RLS). 행이 없으면 기본값, 저장은 upsert.
// DB에 값 check 제약이 없어 허용값은 여기서 화이트리스트로 검증한다.

type Row = {
  lang: string;
  preset: string;
  length: string;
  notify_tg: boolean;
  notify_mail: boolean;
  big_text: boolean;
  autosave: boolean;
  warn_low_score: boolean;
};

const COLS = "lang, preset, length, notify_tg, notify_mail, big_text, autosave, warn_low_score";

const pick = (opts: { value: string }[], v: unknown, fallback: string) =>
  opts.find((o) => o.value === v)?.value ?? fallback;

function fromRow(r: Row): SettingsValue {
  return {
    lang: pick(mockLangs, r.lang, defaultSettings.lang),
    preset: pick(mockPresets, r.preset, defaultSettings.preset),
    len: pick(mockLengths, r.length, defaultSettings.len),
    tg: r.notify_tg,
    mail: r.notify_mail,
    big: r.big_text,
    auto: r.autosave,
    warn: r.warn_low_score,
  };
}

/** 본인 설정. 로그인 전·미승인은 null(기본값 아님), 조회 오류도 null — 오류와 구분이 필요하면 loadSettings 사용 */
export async function loadSettings(): Promise<{ ok: true; value: SettingsValue } | { ok: false }> {
  const session = await getSession();
  if (!session?.approved) return { ok: false };
  const sb = await createClient();
  const { data, error } = await sb
    .schema("studio")
    .from("user_settings")
    .select(COLS)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) {
    console.error("[settings] 조회 실패", error.code);
    return { ok: false };
  }
  return { ok: true, value: data ? fromRow(data as Row) : defaultSettings };
}

/** 큰 글씨 모드만 필요한 곳(루트 레이아웃)용. 실패·비로그인은 false */
export async function loadBigText(): Promise<boolean> {
  const session = await getSession();
  if (!session?.approved) return false;
  const sb = await createClient();
  const { data } = await sb
    .schema("studio")
    .from("user_settings")
    .select("big_text")
    .eq("user_id", session.user.id)
    .maybeSingle();
  return data?.big_text === true;
}

/** 요청 본문을 허용값만 담은 SettingsValue로. 하나라도 어긋나면 null */
export function parseSettings(body: Record<string, unknown>): SettingsValue | null {
  const inList = (opts: { value: string }[], v: unknown) => opts.some((o) => o.value === v);
  const { lang, preset, len, tg, mail, big, auto, warn } = body;
  if (!inList(mockLangs, lang) || !inList(mockPresets, preset) || !inList(mockLengths, len)) return null;
  if (![tg, mail, big, auto, warn].every((b) => typeof b === "boolean")) return null;
  return { lang, preset, len, tg, mail, big, auto, warn } as SettingsValue;
}

export async function saveSettings(v: SettingsValue, userId: string): Promise<boolean> {
  const sb = await createClient();
  const { error } = await sb
    .schema("studio")
    .from("user_settings")
    .upsert({
      user_id: userId,
      lang: v.lang,
      preset: v.preset,
      length: v.len,
      notify_tg: v.tg,
      notify_mail: v.mail,
      big_text: v.big,
      autosave: v.auto,
      warn_low_score: v.warn,
    });
  if (error) console.error("[settings] 저장 실패", error.code);
  return !error;
}
