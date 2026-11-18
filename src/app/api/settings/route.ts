import { apiError, getApiSession } from "@/server/auth";
import { readJson } from "@/server/request";
import { parseSettings, saveSettings } from "@/server/settings";

/** 설정 저장: body `{ lang, preset, len, tg, mail, big, auto, warn }` 전체 */
export async function PUT(request: Request) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  const value = body && parseSettings(body);
  if (!value) return apiError(400, "INVALID_REQUEST", "설정 값이 올바르지 않아요.");
  if (!(await saveSettings(value, session.user.id))) return apiError(500, "UPSTREAM_ERROR", "잠시 후 다시 시도해 주세요.");
  return Response.json({ ok: true, value });
}
