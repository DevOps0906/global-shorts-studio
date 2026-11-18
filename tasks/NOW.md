# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-19 (세션 종료)
- 현재 작업: task-006 스튜디오 분석 완료(006a DB·API 원격 적용 20261118193428_studio_analyze, 006b·c 워커, 006d 화면). 다음: task-007 편집(Remotion 라이선스 결정 필요) → task-010 관리
- 마지막으로 한 일: create_project·start_analyze·cancel_analyze definer, sources 버킷·Storage 정책, 파이썬 워커(pgmq lease·ffmpeg 고정·한도·Claude Sonnet 5.5 구조화 출력·환불), 업로드·진행 화면. 계약: tasks/task-006-contract.md
- 다음 한 걸음(사용자): .env.local·.env.example(YOUTUBE_API_KEY)·OAuth·운영자 SQL → 수동 확인. Supabase 플랜 확인(Free 업로드 50MB). Railway 워커 배포(ANTHROPIC_API_KEY·DATABASE_URL 워커 전용 롤·sslmode=require·service_role). worker/.env.example 주석 2줄(전용 롤·WHISPER_MODEL=/opt/whisper-small)은 권한상 팀장 불가
- 후속(발견한 문제 표): 문의 멱등 키, 업로드 원본 정리 크론, 레이더→작업물, 워커 전용 DB 롤 마이그레이션, 분석 자동 재시도 2회, 제목·대본 선택 저장(task-007)
- 결정 기록: FFmpeg GPL 예외(서버 내부·비배포, AGENTS.md), YouTube 파생 지표 금지(떡상배율 준비 중), 한도(작업물 30/일·분석 20/일·동시 2)
- 주의: 4dec097 커밋에 리뷰 전 워커 초안이 섞임(248e836이 최종). Storage 정책은 원격 생성 확인, 실제 업로드는 미검증. src/types/db.ts 미생성(pnpm db:types)
- SDLC 단계: 06 구현 · 담당: 팀장 Opus 5.5 · builder opus/sonnet · 리뷰 codex·reviewer
- 테스트 상태: run.sh 01~09 · web test · lint · typecheck · build · worker pytest 166 통과
