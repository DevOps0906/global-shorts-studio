# task-006 스튜디오 분석 4단계 · 제목/대본 3안 — 위험도 높음

근거: docs/PLAN.md#4-1~4-3(새 영상·설정·분석 진행 화면) · #4-7(크레딧) · #5(AI 파이프라인, 5-3 스키마) · #7-3(정책 대응: 권리 확인·변형도·반복 원본) · #13-1~13-5 · supabase/migrations/*(projects·drafts·jobs·job_steps·credit_ledger·spend/grant/refund_credits·queues(pgmq analyze)·approval_gate) · 시안 design/prototypes/Main.dc.html · 현재 UI src/app/studio/** · src/components/home/** · `.claude/rules/*`
Claude API: 스킬 claude-api의 `python/claude-api/README.md`·`tool-use.md`(structured outputs) — 기본 경로 `C:\Users\skydy\AppData\Local\Temp\claude\bundled-skills\2.1.323\89c741627becac67ac3c86ea5f816e3f\claude-api\`

## 사용자 결정 (2026-11-19)
- 워커 호스팅: Railway(이번엔 `worker/Dockerfile`·설정까지만, 배포 안 함).
- 비전 LLM: Claude Sonnet 5.5 (`claude-sonnet-5-5`), 공식 Python SDK `anthropic`, 키 `ANTHROPIC_API_KEY`는 워커 환경 변수에만. 구조화 출력(`output_config.format` JSON Schema, PLAN 5-3), `stop_reason == "refusal"` 처리, 서버 측 fallback(`server-side-fallback-2026-07-01` + `fallbacks: "default"`) 기본 사용.
- 받아쓰기: 워커 안 faster-whisper(CPU, small).
- Remotion 라이선스: task-007 전에 다시 묻는다(이번 작업엔 렌더 없음).

## 하위 작업 (위험도 = 위험·중요도·난이도 중 최고)
| 번호 | 내용 | 위험도 | 담당 |
|---|---|---|---|
| 006a | DB·API: Storage 버킷 `sources`(본인 폴더 + is_approved 정책), `POST /api/projects`(작업물 생성 + 서명 업로드 URL 10분), `POST /api/projects/:id/analyze`(권리 확인·크레딧 잔액 확인 → definer 함수가 jobs 행·pgmq `analyze` 메시지를 한 트랜잭션으로) | 높음 | builder·opus |
| 006b | 워커 뼈대(`worker/`): pgmq 소비(service_role), 승인·권리 재확인, 크레딧 차감(spend_credits, 멱등 키 `job_id:spend:attempt`), 단계 1·2·4(ffprobe·PySceneDetect·cropdetect·faster-whisper·프록시), job_steps 기록, 실패 시 자동 환불(refund_credits), Dockerfile(Railway), pytest | 높음 | builder·opus |
| 006c | 워커 LLM 단계 3: 대표 프레임 ≤12장 + 받아쓰기 + 유형·길이·언어 → Claude 구조화 출력(5-3), 스키마 위반 1회 재생성 후 `LLM_SCHEMA_INVALID` 실패·환불, drafts 저장 | 높음 | builder·opus |
| 006d | 화면: `/studio/new` 실제 업로드(진행률·형식/크기 오류·권리 체크), 분석 진행 화면 Realtime(job_steps, 끊기면 2초 폴링), 결과 제목 3안·대본 3안 선택 → draft | 보통 | builder·sonnet |

순서: 006a → (006b+006c 한 워커 builder) ∥ 006d. 각 단계 후 리뷰(높음: codex code + reviewer security).

## 열린 질문 (challenger에게)
- 웹은 service_role 금지 → 크레딧 차감을 워커가 하면 "잔액 확인(웹)→차감(워커)" 사이 경쟁. 대안: 분석 시작 definer 함수가 같은 트랜잭션에서 hold/차감까지?
- 업로드 검증(500MB·3분·형식): 서명 URL 단계 vs 워커 ffprobe. 원본 30일 삭제(PLAN 7)?
- 반복 원본 경고(source_sha256)·변형도 점수(7-3)는 이번 범위인가?

## 계획 수정 (challenger 검토 반영, 2026-11-19)
1. **분석 시작 = definer 함수 `studio.start_analyze(p_project uuid, p_license text)`** (authenticated 실행): 한 트랜잭션에서 소유 → `is_approved()` → 원본(`source_path`가 `{uid}/{project_id}/source.{ext}` 형식이고 storage.objects에 실제 존재, `source_url` 원본은 이번엔 거부) → 권리(라이선스 유형 own/permission/license/etc 필수, `rights_confirmed_at`·`license_type` 기록, 누락이면 `RIGHTS_NOT_CONFIRMED` + `policy_flags(no_rights)`) → 동시 진행 한도(사용자 2개, `CONCURRENCY_LIMIT`)·하루 시작 상한 → jobs insert → `spend_credits`(금액은 함수 안 상수 = PLAN 13-3, 키 `job_id:spend:1`, 부족이면 `INSUFFICIENT_CREDITS`) → `pgmq.send('analyze', {job_id})`. 부분 unique index `(project_id) where kind='analyze' and status in ('queued','running')`.
2. **취소**: `studio.cancel_analyze(p_job)` — 3단계(LLM) 시작 전이면 canceled + 환불, 이후면 거부(PLAN 4-3). 자동 재시도 2회(13-2)는 이번 범위 밖(후속).
3. **projects 쓰기 축소**: authenticated의 `source_path`·`source_url` 직접 쓰기를 막고 작업물 생성은 `POST /api/projects` → definer `studio.create_project(type, lang, length, ext)`가 경로를 정해 반환. drafts insert도 사용자 권한 회수(워커만 version 1 생성, 이후 PATCH는 task-007).
4. **Storage**: 버킷 `sources`(비공개, `file_size_limit` 500MB, `allowed_mime_types` 영상 형식), 정책 = 본인 폴더 + `is_approved()`. 서명 업로드 URL(Supabase 고정 유효시간 — 10분 아님, PLAN 13-4 수정). 원본 보관 7일(정리 크론은 후속).
5. **워커**: 메시지는 `job_id`만 신뢰하고 DB에서 다시 읽는다. `update jobs set status='running' where id=? and status='queued'`로 점유, pgmq vt·read_ct(3회 초과 = 실패·환불·archive). 승인 재확인은 `profiles.approved_at`을 user_id로 직접 조회(is_approved()는 auth.uid() 고정이라 워커에서 못 씀). 경로 정규식 재검증. 차감은 하지 않고 실패 시 `refund_credits`만. 1단계에서 sha256 → 30일 안 같은 원본 3번째면 `policy_flags(repeat_source)` 기록·경고(7-3).
6. **진행 화면**: Realtime publication에 `studio.jobs` 추가, job_steps에 `started_at`·`error_code` 컬럼(4-3 소요 초·실패 단계). 대본형 우선 추천을 006d 기본값으로(7-3).
7. **LLM**: 거부·스키마 위반 유도 남용은 동시 한도·하루 상한으로 제한. fallback이 `output_config.format`과 함께 동작하는지 SDK 문서로 확인하고 안 되면 fallback 끄고 refusal → 실패·환불.
8. 006a 완료 조건에 `supabase/tests` 09(start_analyze 경쟁·중복·권리·한도·경로 위조·cancel)와 06 카탈로그 통과, API 응답·오류 코드 계약을 `tasks/task-006-contract.md`로 확정(006d 근거).
