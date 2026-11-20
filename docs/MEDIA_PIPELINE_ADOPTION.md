# 미디어 파이프라인 적용 메모 (WhisperX · HyperFrames)

작성일 2026-11-20. 상태: **제안**. 공용 기획 정본: `platform-docs:products/_platform-core/MEDIA_PIPELINE.md`. 코드·의존성은 바꾸지 않았다.

## 현황

| 항목 | 내용 | 근거 |
|---|---|---|
| 웹 | Remotion Player로 9:16 미리보기 | `AGENTS.md:11` |
| 워커 | Python: FFmpeg · PySceneDetect · Whisper | `docs/PLAN.md:271` |
| 막힌 결정 | task-007 편집은 "Remotion 라이선스 결정 필요" | `tasks/NOW.md:4` |
| FFmpeg | 서버 내부·이미지 비배포 조건으로 GPL 빌드 허용(2026-11-19) | `AGENTS.md:25` |

## 적용안

| ID | 내용 | 영향 | 선행 |
|---|---|---|---|
| G1 | task-007의 렌더 런타임 후보에 HyperFrames를 추가해 Remotion과 비교한 뒤 하나로 고정 | task-007 전제 | 스파이크 S2, S3 |
| G2 | 워커 STT를 Whisper에서 "단어 시각이 나오는 방식"으로 비교(WhisperX 포함) | 워커 STT, 자막 정밀도 | 스파이크 S1 |
| G3 | 레이더로 찾은 소재의 한국어·일본어 쇼츠 자막에 단어 하이라이트를 옵션으로 검토 | 스튜디오 편집 화면 | G1, G2 |

중요: 편집 상태 원본은 LLM 출력 JSON이고 미리보기와 렌더는 같은 코드를 쓰는 구조다(`docs/PLAN.md` 5-3). 런타임을 바꾸면 이 구조가 영향을 받으므로 **G1은 task-007 시작 전에 결정**해야 한다.

## 검증 (개발 전)

| ID | 방법 | 합격 기준(제안) |
|---|---|---|
| S1 | 소재 영상 3편에서 한국어·일본어 자막 싱크 비교 | 두 언어 모두 정렬 동작 |
| S2 | 같은 9:16 자막 컷 1종을 Remotion·HyperFrames로 제작 | 품질 동등, 제작 시간 비교 |
| S3 | Remotion 상업 이용 조건과 HyperFrames LICENSE 원문 확인 | 둘 중 하나가 상업 SaaS로 확정 가능 |

## 하지 않을 것

| 항목 | 이유 |
|---|---|
| 두 런타임 병행 | 편집 상태 JSON과 미리보기·렌더 일치 구조가 깨짐 |
| S3 전에 의존성 추가 | `secscan license` 규칙(`AGENTS.md:25`) |

## 결정이 필요한 것

| 질문 | 선택지 | 추천(제안) |
|---|---|---|
| task-007 렌더 런타임 | Remotion 유지(라이선스 확정 필요) / HyperFrames 전환 / FFmpeg만 | S2·S3 결과로 결정. 결과 전까지 task-007 착수 보류 |
