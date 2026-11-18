import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** 로그인 없이 열리는 경로. /pending은 화면 안에서 세션을 다시 확인한다 */
function isPublic(pathname: string) {
  if (pathname === "/login" || pathname === "/auth/callback" || pathname === "/pending") return true;
  return process.env.NODE_ENV !== "production" && pathname === "/states";
}

/**
 * 1차 관문: Supabase 세션 쿠키 갱신 + 비로그인 차단.
 * 승인·역할 검사는 각 화면·액션·Route Handler의 getSession이 다시 한다.
 */
export async function proxy(request: NextRequest) {
  // setAll이 여러 번 불려도 앞 쿠키를 잃지 않게 모아 두었다가 최종 응답 하나에 싣는다
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const pendingHeaders = new Map<string, string>();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach((cookie) => {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.set(cookie.name, cookie);
          });
          // Cache-Control 등: 세션 쿠키가 담긴 응답을 CDN이 캐시하지 않게
          Object.entries(headers ?? {}).forEach(([key, value]) => pendingHeaders.set(key, value));
        },
      },
    },
  );

  // createServerClient와 getClaims 사이에 다른 코드를 두지 않는다(세션 갱신 누락 방지)
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  let response: NextResponse;
  if (data?.claims || isPublic(pathname)) {
    response = NextResponse.next({ request }); // 갱신된 요청 쿠키를 서버 컴포넌트에 넘긴다
  } else if (pathname.startsWith("/api/")) {
    response = NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  } else {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    response = NextResponse.redirect(loginUrl);
  }

  // 통과·차단 응답 모두에 갱신·삭제된 세션 쿠키와 헤더를 싣는다
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  pendingHeaders.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
