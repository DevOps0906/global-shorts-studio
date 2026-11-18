import { apiError, getApiSession } from "@/server/auth";
import { startAnalyze } from "@/server/projects";
import { isUuid, licenseOf } from "@/server/projects-rules";
import { readJson } from "@/server/request";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 분석 시작(권리 확인·한도·크레딧 차감·큐 투입은 DB studio.start_analyze가 한 트랜잭션으로).
 * body `{ rightsConfirmed: boolean, licenseType: "own"|"permission"|"license"|"etc" }`
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const body = await readJson(request);
  if (!isUuid(id) || !body) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const r = await startAnalyze(id, licenseOf(body));
  if (!r.ok) return apiError(r.status, r.code, r.message, r.jobId ? { jobId: r.jobId } : undefined);
  return Response.json(r, { status: 202 });
}
