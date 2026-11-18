# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-19
- 현재 작업: task-005 레이더·저장 채널(원본 지표만) 완료, 원격 적용 20261118160922_radar_videos + pg_cron 정리 작업(radar-purge-stale 매일). 다음 대기 작업 없음 — task-006~010 보류
- 마지막으로 한 일: YouTube Data API 서버 호출(공용 키, search.list 금지), 쿼터 한도(사용자 1,000·전역 8,000/일, 스캔 10분 간격, 채널 50개·확인 50회/일) definer 함수, 30일 정리, 레이더·저장 채널·홈 실데이터. 계획: tasks/task-005.md
- 정책 결정: YouTube 개발자 정책 III.E.4.h(파생 지표 금지) → 떡상배율·평균 조회 '준비 중'. 핵심 기능이라 원문·법률 확인 필요(사용자)
- 다음 한 걸음(사용자): .env.local(Supabase URL·publishable·SITE_URL·YOUTUBE_API_KEY), .env.example에 YOUTUBE_API_KEY= 추가(권한상 팀장 불가), Redirect URLs·구글 OAuth, 첫 운영자 SQL → 수동 확인(로그인 4건 + 채널 추가→스캔→레이더 표시, 3구간 화면)
- 후속(발견한 문제 표): 워커 승인 재확인(task-006), Storage 버킷 is_approved, 큰 글씨(task-009). 설정 화면 ?src=<영상 id> 실데이터 연결(task-006)
- 열린 결정: 워커 호스팅·Remotion 라이선스(task-006 전), 다음 작업 순서
- 주의: ERD 도구가 ALTER ADD COLUMN 미인식(channels 새 컬럼 ERD 누락). src/types/db.ts 미생성(pnpm db:types). 새 studio·radar 테이블엔 approved_only 필수
- SDLC 단계: 06 구현 · 담당: 팀장 Opus 5.5 · builder opus · 리뷰 codex·reviewer
- 테스트 상태: run.sh 01~08 · web test · lint · typecheck · build 통과
