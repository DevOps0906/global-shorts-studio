import { apiError, getApiSession } from "@/server/auth";
import { cancelJob } from "@/server/projects";
import { isUuid } from "@/server/projects-rules";
import { readJson } from "@/server/request";

type Ctx = { params: Promise<{ id: string }> };

/** 분석 취소: 3단계(제목·대본 생성) 시작 전이면 취소·환불. body `{}` */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  if (!isUuid(id) || !(await readJson(request))) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const r = await cancelJob(id);
  if (!r.ok) return apiError(r.status, r.code, r.message);
  return Response.json(r);
}
