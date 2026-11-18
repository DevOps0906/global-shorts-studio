# task-019 승인제 DB 반영 — 위험도 높음 (builder·opus)

근거: supabase/migrations/20261116184706_studio_schema.sql(profiles.approved_at, is_operator·is_instructor_of, RLS·grant, instructor_job_queue 뷰) · supabase/tests/ · tasks/task-004.md · `.claude/rules/db.md`

## 결정 (challenger 검토 반영, 2026-11-19)
- 미승인(승인 취소 포함) = DB에서 **profiles 본인 행 읽기 외 전부 차단**. 이력(크레딧·작업)도 승인 상태일 때만 보인다. 가장 단순하고 승인 취소에도 같은 규칙.
- Storage 버킷 정책·service_role(워커·서버) 경로는 RLS를 건너뛴다 → 앱 수준 게이트(getSession/requireSession, 큐 투입 전 승인 확인)에 맡긴다. 이 문서에 명시만.

## 계획
1. 새 마이그레이션 `supabase/migrations/<ts>_approval_gate.sql` (적용된 파일 수정 금지)
   - `studio.is_approved()`: security definer, stable, `set search_path = ''`, 본인 profiles.approved_at not null. public·anon 실행 회수, authenticated·service_role 부여.
   - `is_operator()`·`is_instructor_of()`를 `create or replace`로 바꿔 **승인된** 운영자·강사만 참(강사는 본인 승인 조건). 뷰 instructor_job_queue는 이 함수에 기대므로 자동으로 막힌다.
   - RESTRICTIVE 정책 `approved_only ... for all to authenticated using ((select studio.is_approved())) with check (같음)`을 RLS가 켜진 studio·radar의 **profiles 제외 모든 테이블**에 추가.
2. 테스트
   - run.sh에 새 마이그레이션 적용 줄과 06 등록.
   - 기존 01~05: 사용자 승인 처리(postgres로 approved_at 설정) 추가, 02의 운영자 기대도 승인 포함으로 수정.
   - 06_approval_gate.sql: 미승인 select·insert·update·delete 거부(0행 또는 오류), 승인 후 허용, 승인된 B가 미승인 A 행에 영향 없음, 본인 approved_at 수정 거부, 미승인 운영자·강사의 is_operator/is_instructor_of 거짓·instructor_job_queue 0건, 승인 취소 후 다시 차단.
   - 카탈로그 검사: RLS 켜진 studio·radar 테이블 중 profiles 외에 `approved_only` 없는 테이블이 있으면 실패(앞으로 추가될 테이블 누락 방지). `.claude/rules/db.md`에 규칙 한 줄 추가.
3. 원격 적용(팀장, 사용자 확인 후): 적용 전 `select user_id, role from studio.profiles where approved_at is null` 확인 → MCP apply_migration → list_migrations 버전으로 로컬 파일명 맞춤.

## 완료 조건
- `bash supabase/tests/run.sh` 전부 통과(Docker 필요)
- 웹 영향 없음: `pnpm typecheck` 통과

## 의도된 동작·후속 (보안 리뷰 🟡, 2026-11-19)
- 승인 대기 중에는 고객문의(support_tickets) 작성도 막힌다(의도: /pending은 로그아웃만).
- 강사 판정은 강사 본인 승인만 본다. 미승인·취소 수강생의 이력도 강사에게 보인다(영향 작음, 의도).
- 후속: 워커는 작업 시작·크레딧 차감 전에 사용자 승인을 다시 확인(task-006). Storage 버킷 정책 추가 시 is_approved 조건 필수(카탈로그 테스트는 storage.objects를 못 잡음).
