import { apiError, getApiSession } from "@/server/auth";
import { deleteChannel, updateChannel, type ChannelGroup } from "@/server/radar";
import { readJson } from "@/server/request";

type Ctx = { params: Promise<{ id: string }> };

async function channelId(ctx: Ctx) {
  const { id } = await ctx.params;
  return /^\d{1,15}$/.test(id) ? Number(id) : null;
}

/** 추적 켜기/끄기·그룹 변경: body `{ tracking?: boolean, grp?: "ref" | "ref200" }` */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const id = await channelId(ctx);
  const body = await readJson(request);
  if (id === null || !body) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const patch: { tracking?: boolean; grp?: ChannelGroup } = {};
  if (typeof body.tracking === "boolean") patch.tracking = body.tracking;
  if (body.grp === "ref" || body.grp === "ref200") patch.grp = body.grp;
  if (Object.keys(patch).length === 0) return apiError(400, "INVALID_REQUEST", "바꿀 항목이 없어요.");

  const r = await updateChannel(id, patch);
  if (!r.ok) return apiError(r.status, r.code, r.message);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const id = await channelId(ctx);
  if (id === null) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const r = await deleteChannel(id);
  if (!r.ok) return apiError(r.status, r.code, r.message);
  return Response.json({ ok: true });
}
