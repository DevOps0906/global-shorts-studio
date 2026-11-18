import { apiError, getApiSession } from "@/server/auth";
import { readJson } from "@/server/request";
import { createTicket } from "@/server/support";

/** 문의 접수: body `{ kind: "bug"|"pay"|"idea"|"etc", body: string(1~5000자) }` */
export async function POST(request: Request) {
  const session = await getApiSession();
  if (session instanceof Response) return session;
  const json = await readJson(request);
  if (!json) return apiError(400, "INVALID_REQUEST", "요청 형식이 올바르지 않아요.");

  const r = await createTicket(json.kind, json.body);
  if (!r.ok) return apiError(r.status, r.code, r.message);
  return Response.json({ ok: true, ticket: r.ticket }, { status: 201 });
}
