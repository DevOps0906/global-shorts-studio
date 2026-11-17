// 가짜 데이터 규칙: 시안·/states 확인 화면 전용. 실제 API·Supabase를 부르지 않고, 화면은 이 타입만 본다.
// 오류 코드 이름은 시안용 예시이며 확정 목록은 PLAN 13-4를 따른다.
export type MockErrorCode =
  | "UPSTREAM_ERROR"
  | "VERSION_CONFLICT"
  | "FILE_TOO_LARGE"
  | "YT_QUOTA_EXCEEDED"
  | "INSUFFICIENT_CREDITS";

export const mockProgress = { pct: 64, label: "전체 진행률", eta: "약 2분 남음" } as const;

export const mockKpis = [
  { label: "보유 크레딧", value: "12", accent: true },
  { label: "이번 달 제작", value: "8" },
  { label: "평균 변형도", value: "63점" },
  { label: "저장한 소재", value: "27" },
] as const;

export const mockChips = ["전체", "한국어", "일본어", "24시간"] as const;
