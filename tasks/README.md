# 작업 표

| 번호 | 제목 | 웨이브 | 선행 | 위험도 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| task-001 | Next.js 앱 생성 · `design/tokens.css`·프리셋 적용 (PLAN 12-1·12-3) | W1 | — | 보통 | builder·sonnet | 완료 |
| task-002 | 공통 상단 메뉴 · 3구간 반응형 레이아웃 (PLAN 11-1, 시안 Main) | W1 | 001 | 낮음 | builder·haiku | 완료 |
| task-003 | Supabase 프로젝트 · `20261116184706_studio_schema.sql` 적용·API 노출 (PLAN 13-5) | W1 | — | 높음 | builder·opus | 완료 |
| task-004 | 구글 로그인 · 역할(RBAC) (PLAN 11-6, 시안 Login) | W1 | 001·003 | 높음 | builder·opus | 대기 |
| task-005 | 레이더·저장 채널: 스냅샷 수집 · 떡상배율 (PLAN 4-5) | W2 | 003 | 높음 | builder·opus | 대기 |
| task-006 | 스튜디오 분석 4단계 · 제목/대본 3안 (PLAN 5장) | W3 | 003 | 높음 | builder·opus | 대기 |
| task-007 | 편집 화면 · 캡컷 ZIP·SRT · 크레딧·마이페이지 (PLAN 4-4·4-7) | W4 | 006 | 높음 | builder·opus | 대기 |
| task-008 | 고객문의: FAQ 6개 · 문의 접수(진행률) · 내 문의 내역 (PLAN 11-2, 시안 Support) | W2 | 004 | 보통 | builder·sonnet | 대기 |
| task-009 | 설정: 기본값·알림·큰 글씨 모드(`.big-text` 연결)·자동 저장·변형도 경고, 저장·되돌리기 (PLAN 11-2, 시안 Settings) | W2 | 004 | 보통 | builder·sonnet | 대기 |
| task-010 | 관리 페이지: 개요 KPI · 작업 큐(재시도·삭제) · 회원·크레딧 지급·정지, 감사 기록 (PLAN 11-2·11-6, 시안 Admin. 정책 감시는 2차) | W4 | 004·006 | 높음 | builder·opus | 대기 |

상태: 대기 / 진행 / 완료 / 보류 · 위험도 = 위험·중요도·난이도 중 최고 → 워커 model: 낮음 haiku · 보통 sonnet · 높음 opus

## 발견한 문제 (범위 밖 — 나중 작업 후보)
| 날짜 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 2026-11-17 | src/components/site-header.tsx | 역할이 항상 member(관리 메뉴 숨김), 로그아웃은 /login 이동만 | task-004에서 실제 역할·signOut 연결 |
| 2026-11-17 | src/app/layout.tsx | 큰 글씨 모드(.big-text) 켜는 경로 없음(CSS만 있음) | task-009에서 user_settings.big_text 연결 |

## 교훈 (다음 작업에 그대로 적용할 것만, 20줄 이내 유지)
- 원격 마이그레이션은 MCP apply_migration이 버전을 새로 매긴다 → 적용 후 list_migrations 버전으로 로컬 파일명을 맞춘다.
- Windows에서 `shot http://localhost:3000` 은 파일명 콜론 때문에 0바이트가 된다 → 경로를 붙여(`/radar`) 찍고 파일 크기를 확인한다.
- `next dev`가 AGENTS.md에 Next.js 주의 블록을 자동 추가한다 → 그대로 커밋.
- 착수 전 PLAN 12-4: 수강생 5명 인터뷰에서 3명 이상 "쓰겠다"가 나오면 W1 시작.
