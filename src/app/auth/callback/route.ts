import { connection, NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext, siteOrigin } from "@/server/redirect";

/** OAuth 콜백: code를 세션으로 바꾸고 검증된 next로 보낸다. 실패 → /login?error= */
export async function GET(request: NextRequest) {
  await connection(); // 요청마다 실행(빌드 시 미리 그리지 않음 — env는 런타임에 읽는다)
  const origin = siteOrigin();
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"), origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback", origin));
}
