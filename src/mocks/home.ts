/** 시안 Main 가짜 데이터 (task-012). 썸네일 색은 시안 그라데이션 그대로. */
export type HotItem = {
  id: string;
  title: string;
  channel: string;
  views: string;
  hours: string;
  bg: string;
  fresh: boolean;
};

export const HOT: HotItem[] = [
  { id: "h1", title: "Cat refuses to leave the Christmas tree", channel: "PawTwist", views: "278만", hours: "60시간", bg: "linear-gradient(160deg,#7a5b3a,#2b2016)", fresh: true },
  { id: "h2", title: "Mom lines the family up against the wall", channel: "HomeLaughs", views: "404만", hours: "41시간", bg: "linear-gradient(160deg,#b7a99a,#4a4038)", fresh: false },
  { id: "h3", title: "Tiny glasses made for a doll", channel: "MiniMaker", views: "20만", hours: "22시간", bg: "linear-gradient(160deg,#7d8f5a,#2d3520)", fresh: true },
  { id: "h4", title: "Girl finds her lost bird at the pet shop", channel: "FeatherNest", views: "31만", hours: "35시간", bg: "linear-gradient(160deg,#c88aa0,#3f2a33)", fresh: true },
  { id: "h5", title: "Rhino beetle opens its wings", channel: "BugLens", views: "96만", hours: "58시간", bg: "linear-gradient(160deg,#8a5a2b,#231509)", fresh: false },
];

export type Job = { id: number; title: string; meta: string; status: string; uploaded: boolean };

export const JOBS: Job[] = [
  { id: 1, title: "트리 지키는 집사 VS 트리 접수한 고양이", meta: "영상형 · 한국어 · 11.15. 오후 06:48 · xmas_cat.mp4", status: "편집 중", uploaded: false },
  { id: 2, title: "ツリーを守る飼い主 VS 占領した猫", meta: "영상형 · 일본어 · 11.15. 오후 06:52 · xmas_cat.mp4", status: "업로드됨", uploaded: true },
  { id: 3, title: "장수풍뎅이 날개가 다 들어가는 이유", meta: "대본형 · 한국어 · 11.13. 오후 02:16 · beetle.mp4", status: "업로드됨", uploaded: true },
  { id: 4, title: "이 각도 보면 이미 속은 거임", meta: "영상형 · 한국어 · 11.12. 오후 11:19 · domino.mp4", status: "편집 중", uploaded: false },
];

export const TYPE_CARDS = [
  { type: "video", name: "영상형", sub: "장면의 재미를 살리고 싶어요", desc: "영상만 봐도 재밌는 영상에 짧은 자막으로 웃음·공감·센스를 더해요.", bg: "linear-gradient(160deg,#9a6a2f,#3b2a17)", lines: ["눈치 하나로", "살아남은 강아지"], mark: false },
  { type: "script", name: "대본형", sub: "이유와 이야기를 알려주고 싶어요", desc: "영상만 보면 이해가 안 가는 영상에 상황·원리·배경을 풀어 몰입하게 해요.", bg: "linear-gradient(160deg,#5b7a8f,#22323d)", lines: ["이 새가", "벽에 붙는 이유"], mark: true },
] as const;

export const LEN_CHIPS = [
  { v: "keep", l: "원본 길이 유지", s: "원본 전체" },
  { v: "short", l: "짧게", s: "권장 10~15초" },
  { v: "mid", l: "보통", s: "권장 15~25초" },
  { v: "long", l: "길게", s: "권장 25~30초" },
];
export const LANG_CHIPS = [
  { v: "ko", l: "한국어" },
  { v: "ja", l: "일본어" },
  { v: "both", l: "한·일 동시 제작", n: true },
];
export const PRESET_CHIPS = [
  { v: "brand", l: "내 채널 기본" },
  { v: "shop", l: "쇼핑 쇼츠" },
  { v: "jp", l: "일본 채널" },
];

export const SOURCE_COMMENTS =
  "This is so me at 3am\nThe tree never stood a chance\nMy cat did the exact same thing lol";

export const LOGS = [
  { g: 0, label: "영상 확인", sec: "0초" },
  { g: 0, label: "효과음 시점 분석", sec: "1초" },
  { g: 1, label: "장면·틀·모자이크 프레임 추출", sec: "4초" },
  { g: 1, label: "장면 분석", sec: "2초" },
  { g: 1, label: "장면 경계 정밀 분석", sec: "1초" },
  { g: 1, label: "영상 틀 분석", sec: "1초" },
  { g: 2, label: "AI 화면·음성 분석 준비", sec: "5초" },
  { g: 2, label: "AI 제목 3안·대본 3안 생성", sec: "26초" },
  { g: 3, label: "밝은 전환 화면 제거", sec: "1초" },
  { g: 3, label: "기본 템플릿·스타일 적용", sec: "1초" },
];
export const STEP_T = ["영상 확인 중...", "장면 분석 중...", "제목·대본 생성 중...", "편집 마무리 중..."];
export const STEP_D = [
  "파일 형식과 길이를 확인하고 있어요.",
  "장면이 바뀌는 지점을 찾고 있어요.",
  "결과가 오면 컷과 자막을 함께 보여드릴게요.",
  "컷 경계와 화면 구도를 정리하고 있어요.",
];
export const STEP_L = ["영상 확인", "장면 분석", "제목·대본 생성", "편집 마무리"];
