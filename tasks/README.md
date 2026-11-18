# 작업 표

| 번호 | 제목 | 웨이브 | 선행 | 위험도 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| task-001 | Next.js 앱 생성 · `design/tokens.css`·프리셋 적용 (PLAN 12-1·12-3) | W1 | — | 보통 | builder·sonnet | 완료 |
| task-002 | 공통 상단 메뉴 · 3구간 반응형 레이아웃 (PLAN 11-1, 시안 Main) | W1 | 001 | 낮음 | builder·haiku | 완료 |
| task-003 | Supabase 프로젝트 · `20261116184706_studio_schema.sql` 적용·API 노출 (PLAN 13-5) | W1 | — | 높음 | builder·opus | 완료 |
| task-004 | 구글 로그인 · 역할(RBAC) (PLAN 11-6, 시안 Login) | W1 | 001·003 | 높음 | builder·opus | 완료 |
| task-005 | 레이더·저장 채널: 스냅샷 수집 · 떡상배율 (PLAN 4-5) | W2 | 003 | 높음 | builder·opus | 완료 |
| task-006 | 스튜디오 분석 4단계 · 제목/대본 3안 (PLAN 5장) | W3 | 003 | 높음 | builder·opus | 보류 |
| task-007 | 편집 화면 · 캡컷 ZIP·SRT · 크레딧·마이페이지 (PLAN 4-4·4-7) | W4 | 006 | 높음 | builder·opus | 보류 |
| task-008 | 고객문의: FAQ 6개 · 문의 접수(진행률) · 내 문의 내역 (PLAN 11-2, 시안 Support) | W2 | 004 | 보통 | builder·sonnet | 완료 |
| task-009 | 설정: 기본값·알림·큰 글씨 모드(`.big-text` 연결)·자동 저장·변형도 경고, 저장·되돌리기 (PLAN 11-2, 시안 Settings) | W2 | 004 | 보통 | builder·sonnet | 진행 |
| task-010 | 관리 페이지: 개요 KPI · 작업 큐(재시도·삭제) · 회원·크레딧 지급·정지, 감사 기록 (PLAN 11-2·11-6, 시안 Admin. 정책 감시는 2차) | W4 | 004·006 | 높음 | builder·opus | 보류 |
| task-011 | 시안 UI 공통: 버튼 반응·진행률 막대·토스트·카드·KPI·빈/로딩/오류 상태 컴포넌트, 가짜 데이터 규칙 (시안 States, PLAN 11-3·13-1) | U1 | 002 | 보통 | builder·sonnet | 완료 |
| task-012 | 시안 UI: 홈·제작 설정·분석 진행 (`/`, `/studio/new`, `/studio/demo/analyzing`, 시안 Main) | U2 | 011 | 보통 | builder·sonnet | 완료 |
| task-013 | 시안 UI: 레이더·저장 채널 (`/radar`, `/channels`, 시안 Radar·Saved) | U2 | 011 | 보통 | builder·sonnet | 완료 |
| task-014 | 시안 UI: 고객문의·설정 (`/support`, `/settings`, 시안 Support·Settings) | U2 | 011 | 보통 | builder·sonnet | 완료 |
| task-015 | 시안 UI: 로그인 (`/login`, 시안 Login — 화면만, 인증은 task-004) | U2 | 011 | 높음 | builder·opus | 완료 |
| task-016 | 시안 UI: 관리 페이지 (`/admin`, 시안 Admin — 화면만, 권한은 task-010) | U2 | 011 | 높음 | builder·opus | 완료 |
| task-017 | 시안 UI: 마이페이지 (`/me`, 시안 MyPage — 충전은 화면만) | U2 | 011 | 높음 | builder·opus | 완료 |
| task-018 | 시안 UI: 편집 스튜디오 (`/studio/demo`, 시안 Editor) | U2 | 011 | 높음 | builder·opus | 완료 |
| task-019 | 승인제 DB 반영: `studio.is_approved()` + 본인 쓰기 테이블에 승인 조건 RLS(새 마이그레이션), DB 테스트 (task-004 후속, PLAN 11-6) | W1 | 004 | 높음 | builder·opus | 완료 |

> 2026-11-18 사용자 결정: 시안 UI(task-011~018, 가짜 데이터)를 먼저 완성하고 개발(task-004~010)은 보류. 개발 재개 시 각 작업은 완성된 화면에 데이터·기능만 연결한다.

상태: 대기 / 진행 / 완료 / 보류 · 위험도 = 위험·중요도·난이도 중 최고 → 워커 model: 낮음 haiku · 보통 sonnet · 높음 opus

## 발견한 문제 (범위 밖 — 나중 작업 후보)
| 날짜 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 2026-11-19 | src/server/support.ts | 문의 접수 응답이 끊긴 뒤 재전송하면 같은 문의가 두 번 저장됨(멱등 키 없음) | support_tickets에 idempotency_key 컬럼·unique 추가(새 마이그레이션) |
| 2026-11-19 | worker·Storage | service_role·Storage 경로는 RLS 승인 게이트를 건너뜀 | task-006 워커 작업 시작 전 is_approved 재확인, 버킷 정책에 is_approved 조건 |
| 2026-11-17 | src/app/layout.tsx | 큰 글씨 모드(.big-text) 켜는 경로 없음(CSS만 있음) | task-009에서 user_settings.big_text 연결 |

## 교훈 (다음 작업에 그대로 적용할 것만, 20줄 이내 유지)
- 원격 마이그레이션은 MCP apply_migration이 버전을 새로 매긴다 → 적용 후 list_migrations 버전으로 로컬 파일명을 맞춘다.
- Windows에서 `shot http://localhost:3000` 은 파일명 콜론 때문에 0바이트가 된다 → 경로를 붙여(`/radar`) 찍고 파일 크기를 확인한다.
- `next dev`가 AGENTS.md에 Next.js 주의 블록을 자동 추가한다 → 그대로 커밋.
- 착수 전 PLAN 12-4: 수강생 5명 인터뷰에서 3명 이상 "쓰겠다"가 나오면 W1 시작.
