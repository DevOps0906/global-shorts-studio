import { apiError, getApiSession } from "@/server/auth";
import { createProject } from "@/server/projects";
import { parseNewProject } from "@/server/projects-rules";
import { readJson } from "@/server/request";

/**
 * 작업물 생성 + 원본 서명 업로드 URL.
 * body `{ type: "video"|"script", lang: "ko"|"ja"|"both", length: "keep"|"short"|"mid"|"long", mimeType, size }`
 * 계약: tasks/task-006-contract.md
 */
export async function POST(request: Request) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const body = await readJson(request);
  if (!body) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const input = parseNewProject(body);
  if ("ok" in input) return apiError(input.status, input.code, input.message);

  const r = await createProject(input);
  if (!r.ok) return apiError(r.status, r.code, r.message);
  return Response.json(r, { status: 201 });
}
