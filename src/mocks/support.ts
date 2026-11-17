export const mockFaqs = [
  { q: "영상을 올렸는데 분석이 멈췄어요", a: "창을 닫아도 서버에서 계속 진행돼요. 10분이 지나도 끝나지 않으면 마이페이지의 내 작업에서 다시 시작해 주세요." },
  { q: "크레딧은 언제 차감되나요", a: "제목·대본 생성, 번역, 음성 생성처럼 AI 비용이 드는 단계에서만 차감돼요. 편집과 저장은 무료예요." },
  { q: "수익화 심사에서 거절될까 걱정돼요", a: "원본에 내 해설·목소리·자막을 더해 변형도 60점 이상으로 만들어 주세요. 같은 원본 채널을 반복해서 쓰지 않는 것도 중요해요." },
  { q: "일본어판은 어떻게 만드나요", a: "편집 화면에서 일본어판 만들기를 누르면 제목·자막·목소리만 바뀌고 스타일은 그대로 유지돼요." },
  { q: "캡컷에서 이어서 편집할 수 있나요", a: "캡컷 ZIP 저장을 누르면 원본, 컷별 음성, SRT, 제목 이미지가 함께 내려가요." },
  { q: "환불은 어떻게 하나요", a: "사용하지 않은 크레딧은 결제 후 7일 안에 문의로 요청하면 환불해 드려요." },
];

export const mockKinds = [
  { label: "오류 신고", value: "bug" },
  { label: "결제·환불", value: "pay" },
  { label: "기능 제안", value: "idea" },
  { label: "기타", value: "etc" },
] as const;

export type Ticket = { id: number; title: string; meta: string; status: "done" | "wait" };

export const mockTickets: Ticket[] = [
  { id: 1, title: "[결제·환불] 크레딧 환불 요청", meta: "11.12 접수", status: "done" },
];
