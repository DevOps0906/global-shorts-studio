// 가짜 데이터: 시안 MyPage 전용. 실제 결제·OAuth·Supabase를 부르지 않는다.
// 크레딧은 정수만 쓴다(PLAN 13-3). 연동 예정 테이블: homework_progress · linked_accounts · jobs (PLAN 11-2)

export type MockCreditPack = { credits: number; label: string };

export type MockHomework = {
  id: number;
  title: string;
  desc: string;
  done: boolean;
  href: string;
};

export type MockJob = { id: number; title: string; meta: string };

export type MockAccount = { id: number; name: string; desc: string; connected: boolean };

export const mockPlanName = "강의 번들";

export const mockCredit = 320;

/** 목록에 안 보이는 지난 작업 수(시안: 목록 + 24) */
export const mockPastJobCount = 24;

export const mockCreditPacks: readonly MockCreditPack[] = [
  { credits: 100, label: "100 크레딧 · 9,900원" },
  { credits: 500, label: "500 크레딧 · 39,000원" },
  { credits: 1000, label: "1,000 크레딧 · 69,000원" },
];

export const mockHomework: readonly MockHomework[] = [
  { id: 1, title: "1강 · 계정 연결", desc: "유튜브(한·일)와 스레드를 연결해요", done: true, href: "/settings" },
  { id: 2, title: "2강 · 스레드 쇼핑 글 1개", desc: "상품 링크로 글 3안을 만들고 1개 게시", done: false, href: "/" },
  { id: 3, title: "3강 · 영상형 2개 + 대본형 1개", desc: "변형도 60점 이상으로 완성", done: false, href: "/" },
  { id: 4, title: "4강 · 한·일 동시 제작 1건", desc: "같은 소재를 두 나라 채널용으로", done: false, href: "/radar" },
  { id: 5, title: "5강 · 투트랙 수익 확인", desc: "쇼츠 + 스레드 수익을 한 화면에서 확인", done: false, href: "/radar" },
];

export const mockJobs: readonly MockJob[] = [
  { id: 1, title: "고양이 트리 소동", meta: "영상형 · 한국어 · 오늘 오후 9:12" },
  { id: 2, title: "ツリーを守る飼い主 VS 猫", meta: "영상형 · 일본어 · 어제" },
  { id: 3, title: "장수풍뎅이 날개의 비밀", meta: "대본형 · 한국어 · 11.13" },
];

export const mockAccounts: readonly MockAccount[] = [
  { id: 1, name: "YouTube · 고양이 쇼츠 (KR)", desc: "업로드·성과 분석", connected: true },
  { id: 2, name: "YouTube · ねこショート (JP)", desc: "업로드·성과 분석", connected: true },
  { id: 3, name: "Threads", desc: "쇼핑 글 예약 게시", connected: false },
  { id: 4, name: "텔레그램", desc: "떡상 알림·작업 완료 알림", connected: true },
];
