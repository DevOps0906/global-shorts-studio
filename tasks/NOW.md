# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-18 (세션 종료)
- 현재 작업: 시안 UI 단계(task-011~018) 완료 — 9화면 가짜 데이터 UI, 시안 대조·디자인 리뷰 반영. 다음: 개발 단계 재개 여부 사용자 결정(task-004 전 .env.local·스키마 노출·구글 OAuth 필요)
- 마지막으로 한 일: 시안 9화면 UI(가짜 데이터) 구현·시안 대조·디자인 리뷰 반영, 모바일 햄버거 메뉴·GNB 가운데 정렬·계정명, cn 글자 크기 병합 수정. 확인용: pnpm dev 후 /states 등, 시안은 design/prototypes(support.js 미리보기)
- 다음 한 걸음: 사용자 결정 후 개발 재개 — .env.local·Exposed schemas(studio/radar)·구글 OAuth 준비 → pnpm db:types → task-004. 미검증: 모바일 서랍 연 상태·포커스 복귀, 큰 글씨 켠 화면
- 열린 결정(사용자 확인 필요): 구글 OAuth 클라이언트 발급(task-004 전), 워커 호스팅·Remotion 라이선스(task-006 전)
- 주의: src/types/db.ts 미생성(스키마 노출 후). proxy.ts는 task-004. 성능 점검 WARN: 다중 permissive select 정책 4개(own+operator) — 나중에 OR 하나로 합칠지 검토
- SDLC 단계: 06 구현
- 담당 모델/역할: 팀장 Opus 5.5
- 수정 파일: src/** (화면·ui·mocks), design/tokens.css, docs/PLAN.md, tasks/**
- 테스트 상태: lint·typecheck·build 통과(3069399 기준)
- 남은 작업: tasks/README.md 표 참조
