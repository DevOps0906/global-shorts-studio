# AGENTS.md — global-shorts-studio

> 모든 AI 도구 공통 정본(80줄 이내). Codex 팀 설정: NOMAD `global/nomad/CODEX_TEAM.md`(초기 비활성).

## 1. 무엇인가
소재 발굴(레이더) → 한·일 쇼츠 제작(스튜디오) → 업로드 → 성과 추적 SaaS. 정본: `docs/PLAN.md`. 앱 코드 아직 없음.

## 2. 스택 (작업 시 최신 stable 확인 후 버전 고정)
| 영역 | 선택 | 위치 |
|---|---|---|
| 웹 | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Zustand · Remotion Player | `src/` |
| DB·인증 | Supabase(Auth·Storage·Realtime·Queues), 스키마 `radar`·`studio` | `supabase/` |
| 워커 | Python: FFmpeg · PySceneDetect · Whisper · LLM·Typecast·YouTube API 호출 | `worker/` |

## 3. 명령 (앱 생성 후 task-001에서 확정)
`pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `cd worker && pytest -q`. 긴 출력은 `~/.claude/nomad/bin/q <명령>`.

## 4. 절대 규칙 (위반 = 리뷰 🔴)
- 비밀(LLM·TTS·YouTube 키 · service_role · 결제 키)은 저장소·클라이언트 번들·로그에 넣지 않는다. `.env.example`에 이름만. BYOK 키는 서버에서 암호화 저장.
- 모든 테이블 RLS(본인 작업만). 적용된 마이그레이션은 수정하지 않고 새 파일로 추가한다.
- 크레딧은 정수, `credits_ledger`에만 기록. 차감·환불 요청에는 멱등 키. 분석 실패는 자동 환불(PLAN 4-7).
- UI는 반응형 3구간(~767 / 768~1199 / 1200~), 색·크기는 `design/tokens.css` 토큰만(hex·px 직접 금지).
- 편집 상태 원본은 LLM 출력 JSON(PLAN 5-3). 미리보기·렌더는 같은 Remotion 코드.
- 정책 대응(권리 확인 · 변형도 점수 · 반복 원본 경고, PLAN 7-3)을 빼거나 우회 금지.
- 문서·커밋·화면 문구는 한국어, 코드 식별자는 영어. 새 의존성은 `secscan license`로 확인(GPL·AGPL 거부).

## 5. 문서 지도 (필요한 장만 읽는다 — `grep -n "^##" docs/PLAN.md`로 목차 먼저)
`docs/PLAN.md`: 3 IA·흐름 · 4 화면 명세 · 5 AI 파이프라인 · 6 데이터 모델 · 7 정책 리스크 · 8 디자인 · 11 메뉴·계정 · 12 일정 · 13 구현 근거
`design/prototypes/`(시안 9화면) · `design/tokens.css`(토큰 정답) · `tasks/README.md`(작업 표)·`NOW.md`

## 6. 작업 방식
`tasks/README.md` 순서대로 하나씩, 작업의 근거·금지를 지키고 완료 조건을 실행으로 확인 후 커밋 `[task-NNN] 요약`.

## 7. 영역 규칙 (규칙 정본은 `.claude/rules/` 한 곳)
아래 경로를 만들거나 고치기 **전에** 해당 규칙 파일을 읽는다(Claude Code는 `paths:`로 자동 로드).
| 작업 경로 | 규칙 파일 |
|---|---|
| `src/**` · `public/**` | `.claude/rules/web.md` |
| `worker/**` | `.claude/rules/api.md` |
| `supabase/**` | `.claude/rules/db.md` |
| `docs/**` · `design/**` | `.claude/rules/docs.md` |
- 읽지 않는 파일: `.env*` · lock · `node_modules/` · `.next/` · `dist/` · `build/`.
