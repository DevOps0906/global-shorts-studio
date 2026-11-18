# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-18
- 현재 작업: task-004 구글 로그인·승인제·RBAC 완료(자동 검증). 다음 대기 작업 없음 — task-005~010 보류, 재개 순서 사용자 결정
- 마지막으로 한 일: proxy.ts(세션 갱신·비로그인 차단·/api 401), auth/callback(safeNext), /pending 승인 대기, Protected 감싸개(requireSession), /admin member→404, 로그아웃 form POST, /states 개발 전용, .env.example. 계획·결정: tasks/task-004.md
- 다음 한 걸음: 사용자 .env.local(URL·publishable 키·SITE_URL) 작성 → Supabase Redirect URLs에 <SITE_URL>/auth/callback 정확히 등록 → 구글 OAuth 등록 → 수동 확인 4건(비로그인→/login, 미승인→/pending, member /admin 404, 로그아웃 쿠키 삭제) → 첫 운영자 SQL(README)
- 후속 후보(높음): 승인제 DB RLS 반영(studio.is_approved, 새 마이그레이션) — tasks/README.md 발견한 문제
- 열린 결정: 워커 호스팅·Remotion 라이선스(task-006 전), 다음 개발 작업 순서
- 주의: /admin member 404는 Suspense 스트리밍이라 HTTP 200일 수 있음. 미승인 API 403(NOT_APPROVED)은 API 라우트 생길 때 구현. 이메일 링크 로그인·"둘러보기(샘플)" 링크는 아직 가짜. src/types/db.ts 미생성(pnpm db:types). .env.example 내용은 권한상 팀장 미확인(이름만 작성 지시)
- SDLC 단계: 06 구현
- 담당 모델/역할: 팀장 Opus 5.5 · builder opus · 리뷰 codex(code)·reviewer(security)
- 테스트 상태: test 18/18 · lint · typecheck · build 통과
