// 로그인 뒤 돌아갈 주소 검증. 순수 함수(테스트: redirect.test.mjs, `pnpm test`).

/** 제어문자(탭·개행 포함)·백슬래시: 브라우저가 지우거나 `/`로 바꿔 다른 사이트로 새는 우회 수단 */
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/;

/** 돌아가면 안 되는 경로: 로그인 화면·인증 콜백(루프·코드 재사용 방지) */
function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname === "/auth" || pathname.startsWith("/auth/");
}

/**
 * `next`가 같은 출처의 일반 화면이면 `pathname+search`, 아니면 `/`.
 * login Server Action과 /auth/callback 양쪽에서 쓴다.
 */
export function safeNext(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || UNSAFE_CHARS.test(next)) return "/";
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return "/";
  }
  const expected = new URL(origin).origin;
  // 점 경로 정규화(`/a/..//evil.com`)로 `//`·`/\`가 다시 생기면 거부
  if (url.origin !== expected || /^\/[/\\]/.test(url.pathname) || isAuthPath(url.pathname)) return "/";
  const result = url.pathname + url.search;
  return new URL(result, expected).origin === expected ? result : "/";
}

/** OAuth 돌아올 주소의 출처. 요청 Host가 아니라 환경 변수만 믿는다(호스트 헤더 위조 방지) */
export function siteOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
  return new URL(site).origin;
}
