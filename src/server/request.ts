import "server-only";

/**
 * JSON 본문 읽기. Content-Type이 application/json이 아니면 null — 다른 사이트의 폼 전송(CSRF)은
 * 이 헤더를 붙일 수 없어 여기서 막힌다. 객체가 아니면 null.
 */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
