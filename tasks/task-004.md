# task-004 구글 로그인 · 역할(RBAC) — 위험도 높음 (builder·opus)

근거: docs/PLAN.md#11-6 · #13-1(로그인 오류 문구) · #13-4 · supabase/migrations/20261116184706_studio_schema.sql(studio.profiles: role·approved_at, own_select) · `.claude/rules/web.md` · Next.js 16 문서(node_modules/next/dist/docs: proxy·cacheComponents)

## 사용자 결정 (2026-11-18)
- 승인제: `profiles.approved_at`이 null이면 '승인 대기' 화면만, 나머지 화면·API 차단. 승인은 지금은 운영자가 SQL로(관리 버튼은 task-010).
- 첫 운영자: SQL 수동. README에 SQL 한 줄 안내(role='operator', approved_at=now()).
- `/states`: 개발 전용 — 운영 빌드(NODE_ENV=production)에서 notFound(), 개발에서는 로그인 없이.

## 계획 (challenger 검토 반영)
1. `src/server/auth.ts`(`import "server-only"`): `getSession()` → `{ user, role, approved, displayName } | null`. 역할·승인은 `studio.profiles`만 근거(user_metadata 금지). 행 없음·오류 → role member·미승인(fail-closed). 표시 이름: user_metadata.full_name → 이메일 앞부분 → "회원".
2. `src/server/redirect.ts`: `safeNext(next, origin)` — `new URL(next, origin)` 파싱 후 origin 동일 + pathname이 `/login`·`/auth/` 아님일 때만 `pathname+search`, 아니면 `/`. 제어문자(탭·개행)·백슬래시 포함 시 거부. login 액션과 callback 양쪽에서 사용.
3. `src/proxy.ts`: @supabase/ssr 세션 갱신(getClaims). 비로그인 → 페이지는 `/login?next=`, `/api/*`는 401 JSON `{code:"UNAUTHENTICATED"}`. 예외: `/login`, `/auth/callback`, `/pending`, 정적 자원, 개발 시 `/states`. proxy는 1차 관문일 뿐 — 각 보호 페이지·액션·Route Handler에서 getSession을 다시 확인한다.
4. `src/app/auth/callback/route.ts`: exchangeCodeForSession → safeNext. 실패 시 `/login?error=`.
5. 로그인: 구글 버튼 → Server Action `signInWithOAuth({provider:"google", redirectTo: SITE_URL+"/auth/callback?next="})`. origin은 요청 Host가 아니라 `NEXT_PUBLIC_SITE_URL` 환경 변수. 이미 로그인 상태로 /login 오면 `/`(미승인이면 `/pending`).
6. `/pending` 승인 대기 화면(PLAN 13-1 문구, 로그아웃 버튼만). 미승인 사용자가 다른 화면·API에 오면 `/pending` 또는 403 `{code:"NOT_APPROVED"}`.
7. 헤더: mockSession 기본값 제거, 서버에서 getSession → role·이름. `cacheComponents: true`이므로 layout에서 SiteHeader를 `<Suspense>`로 감싸고 세션 null(로그인 화면) 처리. 로그아웃은 GET 링크 금지 → nav.ts의 로그아웃 항목을 form + Server Action(signOut 후 /login)으로, site-nav 데스크톱·모바일 둘 다.
8. `/admin`: 서버에서 role 검사, member → notFound(). 강사/운영자 탭 분리는 task-010.
9. `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` 이름만.
10. README `## 진행 현황` 아래 설정 안내: Supabase Auth Redirect URLs는 정확한 URL만(와일드카드 금지), 첫 운영자 SQL.

## 완료 조건
- `pnpm lint` · `pnpm typecheck` · `pnpm build` 통과
- safeNext 단위 테스트: `//evil.com`, `/\evil.com`, `/\t/evil.com`, `%2F%2Fevil.com`, `https://evil.com`, `/login`, `/auth/callback`, 정상 `/radar?x=1`
- (사용자 수동) 비로그인 → /login, 미승인 → /pending, member로 /admin → 404, 로그아웃 후 세션 쿠키 삭제

## 알려진 한계
- 승인 게이트는 화면·proxy 수준. DB RLS 반영은 tasks/README.md 발견한 문제 참조(새 마이그레이션 필요).
