# task-005 레이더·저장 채널 (핵심, 원본 지표만) — 위험도 높음 (builder·opus)

근거: docs/PLAN.md#4-5 · #11-2(저장 채널 행) · #13-1(빈·오류 상태) · #13-4(서버 계약·YT_QUOTA_EXCEEDED) · #13-5(radar.videos) · supabase/migrations(radar.channels·approval_gate, studio.projects.source_video_id) · 시안 design/prototypes/Radar·Saved.dc.html · 현재 UI src/components/radar/radar-view.tsx·channels/channels-view.tsx(가짜 데이터 src/mocks/radar.ts·channels.ts) · src/server/auth.ts · `.claude/rules/web.md`·`db.md`

## 사용자 결정 (2026-11-19)
- YouTube Data API v3 서버 공용 키 `YOUTUBE_API_KEY`(서버 전용, NEXT_PUBLIC 금지). BYOK 나중.
- 스캔은 Next.js 서버(`src/server/**`). PLAN 13-4 레이더 행을 이에 맞게 고친다.
- 범위 제외: 예약 스캔·알림·"국내 미등장"·"제작함"·성과 추적.
- **원본 지표만**: YouTube 개발자 정책 III.E.4.h(API 데이터로 파생 지표 생성 금지)에 따라 떡상배율·채널 평균 조회수 같은 계산 지표는 만들지 않는다. 조회수·구독자·게시 경과(시간)만 표시·정렬·필터. 떡상배율 필터·칸과 평균 조회는 "준비 중"(비활성)으로 두고, PLAN 4-5·13-5와 7장(정책 리스크)에 기록.
- 쿼터 소진 시 전체 사용자 스캔 차단 허용(초기화 시각 표시).

## 계획 (challenger 검토 반영)
1. 새 마이그레이션 `<ts>_radar_videos.sql` (원격 radar.channels 행 수 0 확인 후)
   - channels: `yt_channel_id text not null`, `uploads_playlist_id text not null`, `unique(user_id, yt_channel_id)`, `unique(id, user_id)`. **권한 재설정**: authenticated의 channels insert·update 회수, `update (tracking, grp)`만 컬럼 단위 부여, delete 유지. insert는 definer 함수 경유.
   - `radar.videos`(id, user_id, channel_id, yt_video_id, title, published_at, duration_s, thumbnail_url, views, likes, comments, first_seen_at, updated_at, unique(channel_id, yt_video_id), 복합 FK (channel_id, user_id)→channels(id, user_id) on delete cascade, user_id 인덱스).
   - 스냅샷 테이블은 만들지 않는다(파생 지표 없음, 성과 추적 task로).
   - studio.projects.source_video_id → radar.videos(id) FK `on delete set null`(출처는 projects.source_url 텍스트로 남음).
   - RLS: own select + approved_only. videos는 authenticated select만(쓰기는 함수).
   - 쓰기·남용 방지 definer 함수(auth.uid·is_approved 확인, `search_path=''`, authenticated만 실행):
     - `radar.add_channel(handle, name, yt_channel_id, uploads_playlist_id, subs, grp)`: 사용자 채널 50개 상한·채널 추가 일일 횟수 상한.
     - `radar.claim_scan(units int)`: 사용자 10분 간격·사용자 일일 1,000유닛·전역 일일 8,000유닛·전역 소진 표시를 사용자가 못 쓰는 테이블(`radar.quota_usage`, America/Los_Angeles 날짜 기준)에서 advisory lock으로 한 번에 확인·기록. 거절 사유 반환.
     - `radar.mark_quota_exhausted()`: 403 quotaExceeded 시 그날 전역 차단.
     - `radar.upsert_videos(channel_id, jsonb)`: 본인 채널 확인 후 upsert(채널당 최대 50).
   - 30일 정책: pg_cron 매일 — videos.updated_at 30일 초과 삭제, channels의 subs·name은 30일 넘게 갱신 안 되면 null. (pg_cron 사용 불가면 보고)
2. `src/server/youtube.ts`(server-only, fetch): 허용 입력은 `@핸들`·`youtube.com/@핸들`·`youtube.com/channel/UC…`만. search.list 금지. channels.list(forHandle|id) 1유닛, playlistItems.list(최근 50) 1유닛, videos.list(ID 50개씩, 채널 무관 묶음) 1유닛. 쇼츠 판정 duration ≤ 180초. 오류 구분: quotaExceeded → YT_QUOTA_EXCEEDED(초기화 = 다음 LA 자정), rateLimitExceeded·5xx → UPSTREAM_ERROR, 키 오류 → 서버 로그(키 값 제외)+UPSTREAM_ERROR, 채널 404 → 해당 채널만 건너뜀(부분 실패 보고). 키는 로그·응답에 넣지 않는다.
3. `src/server/radar.ts`: addChannel, scanChannels(추적 켠 채널 최대 50, claim_scan 먼저), 목록 조회.
4. API용 인증: `src/server/auth.ts`에 redirect 없는 `getApiSession()` → 401 `UNAUTHENTICATED`·403 `NOT_APPROVED` JSON. Route Handler: `POST /api/radar/channels`, `PATCH·DELETE /api/radar/channels/:id`, `POST /api/radar/scan`(PLAN 13-4 오류 코드).
5. 화면(/channels·/radar·홈 오늘의 소재): 실데이터 연결, 빈·로딩·오류 상태(13-1). 정렬: 조회수·최신순. "새 영상" = first_seen_at 24시간 이내. 떡상배율·평균 조회·국내 미등장은 비활성 "준비 중". 시안 레이아웃 변경 금지. 약관·개인정보 링크(YouTube 약관, Google 개인정보처리방침)를 레이더·저장 채널 화면 하단에 노출(정책 III.A).
6. 테스트: 핸들/주소 파싱·duration 파싱·LA 쿼터 날짜 단위 테스트(node --test). DB 테스트 07: 채널 직접 insert/컬럼 update 거부, 50개 상한, claim_scan 10분·일일·전역 한도·동시 호출 1건만 통과, 남의 채널에 upsert 거부, 복합 FK, approved_only 카탈로그 통과.
7. `.env.example`에 `YOUTUBE_API_KEY` 이름 추가. ERD 갱신(`sql2erd`).

## 완료 조건
- `q pnpm lint` · `q pnpm typecheck` · `q pnpm build` · `q pnpm test` · `q bash supabase/tests/run.sh` 통과
- (사용자 수동, 키 필요) 채널 추가 → 스캔 → 레이더 목록 표시
