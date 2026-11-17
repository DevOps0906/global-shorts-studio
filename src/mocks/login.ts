// 가짜 로그인 규칙: 시안 Login 전용. 실제 인증·OAuth·Supabase를 부르지 않는다(task-004에서 연결).
export type LoginMode = "google" | "link";

export const loginCopy = {
  loggedOut: "로그아웃했어요. 다시 로그인해 주세요.",
  ready: "준비가 끝났어요.",
  google: "구글 계정으로 계속하기",
  busy: "확인 중…",
  link: "이메일로 로그인 링크 받기",
  start: "스튜디오 시작하기 →",
  emailRequired: "이메일을 먼저 입력해 주세요.",
  note: "처음이라면 로그인과 동시에 가입돼요 · 강의 수강생은 강의 번들이 자동 적용돼요",
  browse: "로그인 없이 둘러보기(샘플)",
} as const;

export const loginProgress: Record<LoginMode, { label: string; done: string }> = {
  google: { label: "계정 확인 중…", done: "로그인했어요. (샘플)" },
  link: { label: "로그인 링크 보내는 중…", done: "로그인 링크를 보냈어요. (샘플)" },
};

/** 진행률 한 칸: tickMs마다 min~min+spread % 오른다 (시안 240ms · 10~25%) */
export const loginTick = { tickMs: 240, min: 10, spread: 16 } as const;
