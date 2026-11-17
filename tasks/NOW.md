# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-18 (task-008~010 추가, 토큰 정본 일원화: globals.css가 design/tokens.css import, tailwind.preset.ts 삭제 — 미커밋)
- 현재 작업: task-011 완료(fcf0ce6). task-012~018 시안 화면 7묶음 병렬 진행(공유 dev 서버 :3311, 시안 서버 :4000). 개발 task-004~010 보류(2026-11-18 사용자 결정)
- 마지막으로 한 일: task-003 완료 — 원격 프로젝트 rcuqmmupqnmhuxawtdud(서울)에 studio_schema·queues·fk_indexes 적용, 보안 점검 0건, 로컬 파일명 원격 버전과 일치
- 다음 한 걸음: 사용자 3가지(.env.example·.env.local·Exposed schemas studio/radar) 확인 → pnpm db:types → task-004
- 열린 결정(사용자 확인 필요): 구글 OAuth 클라이언트 발급(task-004 전), 워커 호스팅·Remotion 라이선스(task-006 전)
- 주의: src/types/db.ts 미생성(스키마 노출 후). proxy.ts는 task-004. 성능 점검 WARN: 다중 permissive select 정책 4개(own+operator) — 나중에 OR 하나로 합칠지 검토
- SDLC 단계: 06 구현
- 담당 모델/역할: 팀장 Opus 5.5
- 수정 파일: supabase/**, src/lib/supabase/**, package.json
- 테스트 상태: lint·typecheck·build 통과, DB 로컬 테스트 5종 통과, 원격 보안 점검 0건
- 남은 작업: tasks/README.md 표 참조
