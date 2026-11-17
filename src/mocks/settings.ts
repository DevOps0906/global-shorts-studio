export const mockLangs = [
  { label: "한국어", value: "ko" },
  { label: "일본어", value: "ja" },
  { label: "한·일 동시", value: "both" },
];
export const mockPresets = [
  { label: "내 채널 기본", value: "brand" },
  { label: "쇼핑 쇼츠", value: "shop" },
  { label: "일본 채널", value: "jp" },
];
export const mockLengths = [
  { label: "원본 유지", value: "keep" },
  { label: "짧게", value: "short" },
  { label: "보통", value: "mid" },
  { label: "길게", value: "long" },
];
export const mockToggles = [
  { key: "tg", label: "텔레그램 알림", desc: "떡상 소재와 작업 완료를 알려줘요" },
  { key: "mail", label: "이메일 주간 요약", desc: "매주 월요일 성과 요약을 보내요" },
  { key: "big", label: "큰 글씨 모드", desc: "글자와 버튼을 크게 보여줘요" },
  { key: "auto", label: "자동 저장", desc: "고치면 3초 뒤 자동으로 저장해요" },
  { key: "warn", label: "변형도 낮음 경고", desc: "60점 미만이면 업로드 전에 알려줘요" },
] as const;

export type ToggleKey = (typeof mockToggles)[number]["key"];
export type SettingsValue = {
  lang: string;
  preset: string;
  len: string;
} & Record<ToggleKey, boolean>;

export const defaultSettings: SettingsValue = {
  lang: "ko", preset: "brand", len: "keep", tg: true, mail: false, big: false, auto: true, warn: true,
};
