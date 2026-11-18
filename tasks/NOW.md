# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-19
- 현재 작업: task-006 스튜디오 분석 (높음, 하위 006a~d) — 계획 검토(challenger), 계획 tasks/task-006.md. 사용자: "다음 단계도 자동으로 계속"
- 마지막으로 한 일: 고객문의 접수·내역 실데이터(POST /api/support/tickets), 설정 저장·되돌리기(PUT /api/settings, 화이트리스트), 큰 글씨 모드 <html> 연결. 자동 저장은 편집 초안용 선호값(설정 화면은 저장 버튼만)
- 다음 한 걸음(사용자): task-006 전 결정 — 워커 호스팅·Remotion 라이선스. 그 전에 .env.local·OAuth·운영자 SQL 후 수동 확인(로그인 4건, 레이더 채널 추가→스캔, 문의 접수, 설정 저장·큰 글씨, 3구간 화면)
- 후속(발견한 문제 표): 문의 멱등 키, 워커 승인 재확인(task-006), Storage 버킷 is_approved
- 주의: 큰 글씨는 첫 페인트 후 적용(깜빡임, cacheComponents 제약). YouTube 파생 지표 금지(III.E.4.h)로 떡상배율 '준비 중'. .env.example에 YOUTUBE_API_KEY 추가 필요(권한상 팀장 불가). src/types/db.ts 미생성
- SDLC 단계: 06 구현 · 담당: 팀장 Opus 5.5 · builder sonnet(008·009) · 리뷰 codex
- 테스트 상태: web test 23 · lint · typecheck · build 통과, run.sh 01~08 통과(DB 변경 없음)
