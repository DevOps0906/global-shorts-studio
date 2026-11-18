# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-19
- 현재 작업: task-019 승인제 DB 반영 완료(원격 적용 20261118152240_approval_gate). 다음 대기 작업 없음 — task-005~010 보류, 재개 순서 사용자 결정
- 마지막으로 한 일: is_approved()·approved_only RESTRICTIVE(profiles 외 13개 테이블)·is_operator/is_instructor_of 승인 조건, DB 테스트 06(카탈로그 누락 검사 포함). 원격 적용 후 누락 테이블 0 확인. 계획: tasks/task-019.md
- 다음 한 걸음: 사용자 .env.local·Redirect URLs·구글 OAuth → 첫 로그인 후 운영자 SQL(README, approved_at 포함) → task-004 수동 확인 4건 → 다음 개발 작업 선택(task-005 레이더 / task-006 스튜디오 분석 / task-008·009)
- 후속(발견한 문제 표): 워커 작업 전 승인 재확인(task-006), Storage 버킷 정책에 is_approved, 큰 글씨 모드(task-009)
- 열린 결정: 워커 호스팅·Remotion 라이선스(task-006 전), 다음 개발 작업 순서
- 주의: 승인 대기 중엔 고객문의도 불가(의도). /admin member 404는 HTTP 200일 수 있음. src/types/db.ts 미생성(pnpm db:types). 새 studio·radar 테이블엔 approved_only 필수(.claude/rules/db.md)
- SDLC 단계: 06 구현
- 담당 모델/역할: 팀장 Opus 5.5 · builder opus · 리뷰 codex(code)·reviewer(security)
- 테스트 상태: supabase/tests/run.sh 01~06 통과 · web test 18/18 · lint · typecheck · build 통과
