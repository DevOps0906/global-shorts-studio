# task-006 계약 — 작업물·분석 시작·취소 API, DB 함수, 큐 메시지

> 정본(006b 워커·006d 화면 근거). 구현: `supabase/migrations/20261119100000_studio_analyze.sql` · `src/server/projects*.ts` · `src/app/api/{projects,jobs}/**`.
> 모든 API: 로그인 쿠키 세션, `Content-Type: application/json` 필수(아니면 400 `INVALID_REQUEST`). 오류 본문 `{ error: { code, message, ...extra } }`.
> 공통 오류: 401 `UNAUTHENTICATED` · 403 `NOT_APPROVED` · 400 `INVALID_REQUEST` · 500/502 `UPSTREAM_ERROR`.

## 1. POST /api/projects — 작업물 생성 + 서명 업로드 URL

요청 `{ type: "video"|"script", lang: "ko"|"ja"|"both", length: "keep"|"short"|"mid"|"long", mimeType: "video/mp4"|"video/quicktime"|"video/webm", size: <바이트 정수> }`

응답 201
```json
{ "ok": true, "projectId": "<uuid>",
  "upload": { "bucket": "sources", "path": "<uid>/<projectId>/source.<mp4|mov|webm>", "token": "...", "signedUrl": "..." } }
```
- 업로드: 브라우저 `supabase.storage.from("sources").uploadToSignedUrl(path, token, file)`(진행률이 필요하면 `signedUrl`에 PUT). 유효시간은 Supabase 고정 2시간. 덮어쓰기(upsert) 불가 → 같은 작업물에 다시 올리려면 새 작업물을 만든다.
- 버킷이 500MB·MIME 3종을 다시 강제한다. 업로드 정책: 승인된 본인 + 본인 폴더 + `create_project`가 정한 경로 + 작업물 `status='draft'`.

| 상태 | code | 언제 |
|---|---|---|
| 400 | `UNSUPPORTED_FORMAT` | mimeType이 3종 아님 |
| 413 | `FILE_TOO_LARGE` | size > 500MB(524,288,000) |
| 429 | `RATE_LIMITED` | 하루(KST) 작업물 30개 초과 |
| 502 | `UPSTREAM_ERROR` | 서명 URL 발급 실패(작업물 행은 남음, draft) |

길이 3분 초과(`DURATION_TOO_LONG`)는 업로드 후 워커 ffprobe가 판정한다(1단계 실패·환불).

## 2. POST /api/projects/:id/analyze — 분석 시작

요청 `{ rightsConfirmed: true, licenseType: "own"|"permission"|"license"|"etc" }` (PLAN 7-3: 직접 촬영/허락/라이선스/기타)

응답 202 `{ "ok": true, "jobId": "<uuid>" }` → 진행 화면 `/studio/:id/analyzing`으로.

| 상태 | code | 언제 · 화면 처리 |
|---|---|---|
| 400 | `RIGHTS_NOT_CONFIRMED` | 체크 안 함·유형 누락. DB가 `policy_flags(no_rights)` 기록 → 체크박스로 이동 |
| 400 | `UNSUPPORTED_FORMAT` | 원본 경로가 서버 형식 아님·URL 원본(이번 범위 밖) |
| 402 | `INSUFFICIENT_CREDITS` | 잔액 < 1 → 충전 버튼 |
| 404 | `NOT_FOUND` | 없음·남의 작업물·삭제됨 |
| 409 | `SOURCE_NOT_UPLOADED` | Storage에 원본 객체 없음(업로드 미완료) |
| 409 | `JOB_ALREADY_RUNNING` | 같은 작업물 분석 진행 중. `error.jobId` 포함 → 진행 화면으로 |
| 409 | `INVALID_STATE` | 작업물 상태가 draft·failed 아님(이미 분석 끝남) |
| 429 | `CONCURRENCY_LIMIT` | 사용자 진행 중(queued·running) 분석 2개 |
| 429 | `RATE_LIMITED` | 하루(KST) 분석 시작 20회 |

## 3. POST /api/jobs/:id/cancel — 분석 취소

요청 `{}` · 응답 200 `{ "ok": true }` (크레딧 1 환불, 작업물 `draft`로 복귀 → 설정 화면에서 다시 시작 가능)

| 상태 | code | 언제 |
|---|---|---|
| 404 | `NOT_FOUND` | 없음·남의 작업·analyze 아님 |
| 409 | `NOT_CANCELABLE` | 이미 done·failed·canceled |
| 409 | `CANCEL_TOO_LATE` | 3단계(제목·대본 생성) 시작됨(PLAN 4-3) |

## 4. DB 함수(authenticated 실행, security definer)

| 함수 | 반환 | 하는 일 |
|---|---|---|
| `studio.create_project(type, lang, length, ext)` | jsonb `{result, project_id, source_path}` | 승인·입력 검사, 하루 30개, 경로 `{uid}/{project_id}/source.{ext}` 지정 |
| `studio.start_analyze(project, license)` | jsonb `{result, job_id}` | 사용자 크레딧 잠금 → 소유 → 진행 중 → 상태 → 원본(경로 정규식+객체 존재) → 권리 → 동시 2 → 하루 20 → 잔액 → projects(analyzing·license·rights_confirmed_at) → jobs(queued, cost 1) → job_steps 4행 → `spend_credits(key=job_id:spend:1)` → `pgmq.send('analyze')` |
| `studio.cancel_analyze(job)` | text | 3단계 전이면 jobs canceled·finished_at, projects draft, `refund_credits(key=job_id:refund:<attempt>)` |

- `result` 값: ok · not_approved · not_found · invalid_state · source_missing · invalid_source · rights_not_confirmed · already_running · concurrency_limit · daily_limit · insufficient_credits (API 매핑은 `src/server/projects-rules.ts`).
- 부분 unique index `jobs_one_active_analyze (project_id) where kind='analyze' and status in ('queued','running')`.
- 사용자 직접 쓰기 회수: `projects` insert(수정은 lang·length_preset만), `drafts` insert.

## 5. 워커(006b) 계약

- 큐 메시지(`analyze`): `{ job_id, project_id, kind: "analyze", idempotency_key: "<job_id>:spend:1" }`. **job_id만 신뢰**하고 DB에서 다시 읽는다.
- 차감은 이미 끝났다(start_analyze). 워커는 차감하지 않고, 실패 시 `refund_credits(user, cost_credits, job, attempt_no, "<job_id>:refund:<attempt_no>")`만.
- 점유: `update jobs set status='running', started_at=now() where id=? and status='queued'` 1행일 때만 진행(canceled면 메시지 archive).
- `job_steps`는 4행(step_no 1~4: 영상 확인·장면 분석·제목·대본 생성·편집 마무리)이 미리 있다. 워커는 `started_at`·`done_at`·실패 시 `error_code`만 갱신.
- **3단계 시작 규칙(취소 경쟁 방지)**: 한 트랜잭션에서 `select ... from jobs where id=? for update` → `status='running'` 확인 → `job_steps(step_no=3).started_at=now()` → 커밋 후 LLM 호출. canceled면 중단·archive(환불은 cancel이 이미 함).
- 성공: jobs `done`·finished_at, projects `editing`. 최종 실패: jobs `failed`, projects `failed`, 환불.

## 6. 진행 화면(006d) 계약

- Realtime(`supabase_realtime`): `studio.jobs`(status·step_name·finished_at)와 `studio.job_steps`(started_at·done_at·error_code), RLS로 본인 행만. 끊기면 2초 폴링(같은 두 테이블 select).
- 소요 초 = `done_at - started_at`. 실패 단계 = `error_code`가 있는 step.

## 7. 워커(006b) 운영 보강 — 리뷰 반영

- **lease(중복 점유 방지)**: 소유 토큰 = 워커가 읽은 큐 메시지 `(msg_id, read_ct)`. 처리 중 vt/3마다 별도 연결로 `q_analyze.vt`를 연장(`read_ct` 일치할 때만). vt가 만료돼 다른 워커가 다시 읽으면 `read_ct`가 늘어 옛 워커는 소유권을 잃고 **쓰기·실패·환불·archive를 하지 않는다**(새 소유 워커가 running 작업을 이어서 처리). jobs 컬럼 추가 없음.
- **잠금 순서**(cancel_analyze와 같음, 교착 방지): 사용자 advisory lock(환불·반복 원본 판정만) → `jobs for update` → 큐 메시지 행 `for update`. 반복 원본(30일 3번째) 판정은 사용자 lock으로 직렬화.
- **취소**: 매 단계 시작·완료와 완료 저장 때 jobs가 running이 아니면 멈추고 메시지만 archive. canceled를 done·failed로 덮어쓰거나 다시 환불하지 않는다. 4단계에서 올린 프록시는 실패·중단 시 지운다(lease 상실 때는 새 소유 워커 파일일 수 있어 두고 간다).
- **미디어 입력 고정**: 형식은 Content-Type·확장자가 아니라 ffprobe 내용으로만 판정. 모든 ffmpeg/ffprobe에 `-protocol_whitelist file,pipe`, ffprobe `-format_whitelist mov,matroska`, 이후 `-f mov|matroska` 고정. OpenCV `OPENCV_FFMPEG_CAPTURE_OPTIONS=protocol_whitelist;file`. 받아쓰기는 ffmpeg로 PCM을 뽑아 넘긴다(PyAV가 원본을 직접 열지 않음).
- **리소스 한도**: 해상도 한 변 ≤4096·총 픽셀 ≤4096×2304, 디코딩 `-t 185`·`-threads 2`, 장면 분석 180초·받아쓰기 300초 벽시계 타임아웃(자식 프로세스 종료), 프록시 ≤200MB(`-fs`)·스트리밍 업로드.
- **프록시**: `sources/{uid}/{project_id}/proxy.mp4`(본인 select 정책으로 읽힘). edit_state(5-3)에는 넣지 않는다.
- **comments.cut**: 기본안 `scripts[0]`의 컷 번호. 4단계 컷 정리 후 다시 매기고 버려진 컷의 댓글은 뺀 뒤 최종 재검증.
- **job_steps.error_code**(006d 문구 매핑): `NOT_APPROVED` · `RIGHTS_NOT_CONFIRMED` · `INVALID_SOURCE` · `SOURCE_MISSING` · `FILE_TOO_LARGE` · `UNSUPPORTED_FORMAT` · `DURATION_TOO_LONG` · `RESOLUTION_TOO_HIGH` · `MEDIA_PROCESSING_FAILED` · `LLM_REFUSED` · `LLM_SCHEMA_INVALID` · `LLM_UPSTREAM` · `MAX_ATTEMPTS` · `INTERNAL_ERROR`.
- **DB 연결**: `DATABASE_URL`은 워커 전용 롤(pgmq `analyze` 읽기·archive, studio jobs·job_steps·projects·drafts·policy_flags 쓰기, `refund_credits` 실행만) + `sslmode=require` 권장. 롤 생성은 별도 마이그레이션(팀장 결정).
- **라이선스 예외**: FFmpeg(Debian GPL 빌드·libx264)는 사용자 승인으로 허용 — 서버 내부 실행만, 이미지·바이너리 비배포. psycopg는 LGPL-3.0(동적 링크).
