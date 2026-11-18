import { apiError, getApiSession } from "@/server/auth";
import { addChannel } from "@/server/radar";
import { readJson } from "@/server/request";

/** 채널 추가: body `{ input: "@핸들" | 채널 주소, grp?: "ref" | "ref200" }` */
export async function POST(request: Request) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  if (!body) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const r = await addChannel(body.input, body.grp);
  if (!r.ok) return apiError(r.status, r.code, r.message, r.resetAt ? { resetAt: r.resetAt } : undefined);
  return Response.json({ ok: true, name: r.name }, { status: 201 });
}
