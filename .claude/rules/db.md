---
paths:
  - "supabase/**"
---
# DB 영역 규칙 (supabase/** 작업 때만 로드)
- 먼저 `~/.claude/skills/stack-supabase/SKILL.md`를 읽는다.
- 마이그레이션 파일명: `YYYYMMDDHHMMSS_<설명>.sql`. 적용된 파일 수정 금지.
- 새 테이블 = RLS 활성 + 정책 + 정책 컬럼 인덱스 + 코멘트 한 줄.
- 승인제: studio·radar 새 테이블(profiles 제외)에는 RESTRICTIVE `approved_only`(for all to authenticated, `(select studio.is_approved())`)를 붙인다. 누락은 `supabase/tests/06_approval_gate.sql`이 잡는다.
- 스키마를 바꾼 작업은 ERD와 타입을 갱신한다.
  - DB 초기화 · 타입: `supabase db reset` · `pnpm db:types` (원격 프로젝트 기준, 로컬 CLI 없음) · 로컬 검증은 `bash supabase/tests/run.sh`
  - ERD: `~/.claude/nomad/bin/sql2erd supabase/migrations -o docs/diagrams/erd.mmd`
