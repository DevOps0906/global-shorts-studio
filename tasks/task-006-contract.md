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
