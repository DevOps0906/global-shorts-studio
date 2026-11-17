// 가짜 데이터: 시안 Admin 확인 전용. 실제 회원 정보·API·Supabase를 쓰지 않는다.
// 회원 이름은 화면에 오기 전에 가린다(PLAN 11-6). 실제 구현에서는 서버가 가린 값만 내려준다.

/** 앞 4글자만 남기고 가린다: richard → rich*** */
export function maskName(name: string) {
  return `${name.slice(0, 4)}***`;
}

export type JobStatus = "run" | "done" | "fail";
export type AdminJob = { id: string; user: string; type: string; pct: number; status: JobStatus };
export type AdminMember = { id: number; name: string; plan: string; credit: number; active: boolean };
export type PolicyFlag = { id: number; title: string; user: string; reason: string; sent: boolean };

export const mockOverviewKpis = { signups: "12", madeBase: 184, creditsUsed: "1,240" } as const;

export const mockQuota = { pct: 64, label: "YouTube API 쿼터 (일 10,000 유닛)", note: "6,420 / 10,000 사용 · 초기화 오후 4시(KST)" } as const;
export const mockHomework = { pct: 58, label: "숙제 제출 진도 (수강생 42명)", note: "3강 숙제 제출 24명 · 평균 변형도 63점" } as const;

export const mockJobs: AdminJob[] = [
  { id: "J-2041", user: maskName("richard"), type: "영상형 · KR", pct: 72, status: "run" },
  { id: "J-2040", user: maskName("mina"), type: "대본형 · JP", pct: 100, status: "done" },
  { id: "J-2039", user: maskName("jun"), type: "영상형 · KR+JP", pct: 35, status: "run" },
  { id: "J-2038", user: maskName("sora"), type: "영상형 · KR", pct: 0, status: "fail" },
];

export const mockMembers: AdminMember[] = [
  { id: 1, name: maskName("richard"), plan: "프로", credit: 320, active: true },
  { id: 2, name: maskName("mina"), plan: "스타터", credit: 48, active: true },
  { id: 3, name: maskName("jun"), plan: "강의 번들", credit: 120, active: true },
  { id: 4, name: maskName("sora"), plan: "스타터", credit: 0, active: false },
];

export const mockPolicyKpis = [
  { label: "변형도 60점 미만 업로드", value: "7", accent: true },
  { label: "같은 원본 반복 사용", value: "3" },
  { label: "권리 확인 누락 시도", value: "9" },
  { label: "원작자 신고", value: "0" },
] as const;

export const mockFlags: PolicyFlag[] = [
  { id: 1, title: "고양이 트리 소동", user: maskName("mina"), reason: "변형도 42점 · 목소리·자막 수정 없음", sent: false },
  { id: 2, title: "요리 꿀팁 5가지", user: maskName("jun"), reason: "같은 원본 채널 4회 연속 사용", sent: false },
  { id: 3, title: "웃긴 앵무새", user: maskName("sora"), reason: "권리 확인 누락 시도 3회", sent: true },
];
