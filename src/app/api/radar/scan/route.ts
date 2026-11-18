import { apiError, getApiSession } from "@/server/auth";
import { scanChannels } from "@/server/radar";
import { readJson } from "@/server/request";

/** 수동 스캔(사용자 10분 간격·일일·전역 쿼터는 DB radar.claim_scan이 판정) */
export async function POST(request: Request) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  if (!(await readJson(request))) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const r = await scanChannels();
  if (!r.ok) return apiError(r.status, r.code, r.message, r.resetAt ? { resetAt: r.resetAt } : undefined);
  return Response.json(r);
}
