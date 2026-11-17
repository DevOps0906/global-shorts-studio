// 가짜 편집 데이터: 시안 Editor(/studio/demo) 전용. 실제 API·Supabase를 부르지 않는다.
// 편집 상태의 원본은 LLM 출력 JSON(PLAN 5-3)이고, 화면은 이 타입만 본다.
// 여기 있는 색(hex)은 UI 색이 아니라 "영상 안에 그려지는 내용" 데이터다(사용자가 고르는 제목 색·띠 색·장면 그림).

export type Lang = "ko" | "ja";

/** PLAN 5-3 LLM 출력 스키마 */
export type EditTitle = { line1: string; line2: string; hook: string; reason: string };
export type EditCut = {
  start: number;
  end: number;
  caption: string;
  scene: string;
  tts: boolean;
  keepOriginal: boolean;
  zoom: number;
};
export type EditScript = { label: string; cuts: EditCut[] };
export type SfxType = "pop" | "boing" | "sparkle" | "none";
export type MosaicKind = "logo" | "sub" | "face";
export type EditJson = {
  titles: EditTitle[];
  scripts: EditScript[];
  sfx: { at: number; type: SfxType }[];
  /** box: 영상 영역 기준 [x, y, w, h] 비율. kind·label은 화면 표시용 보조 필드 */
  mosaic: { from: number; to: number; box: [number, number, number, number]; kind: MosaicKind; label: string }[];
  /** cut: 1부터 세는 원본 컷 번호 */
  comments: { cut: number; text: string }[];
  meta: { description: string; hashtags: string[] };
};

const TIMES: [number, number][] = [
  [0, 3.0],
  [3.0, 5.6],
  [5.6, 8.8],
  [8.8, 11.6],
  [11.6, 14.6],
  [14.6, 17.3],
  [17.3, 20.2],
];
const SCENES = [
  "집사가 트리 아래에 투명한 가시 매트를 펼친다",
  "매트의 돌기가 가까이 보인다",
  "고양이가 매트를 사뿐히 건너 트리 밑으로 들어간다",
  "고양이가 빨간 장식 공을 앞발로 툭 친다",
  "다른 집, 트리 아래에 빨간 고양이 집이 놓여 있다",
  "두 집의 트리 아래가 위아래로 나란히 보인다",
  "고양이가 고양이 집 안에서 눈을 감는다",
];
const ZOOMS = [1, 1.5, 1, 1.2, 1, 1, 1.1];

function script(label: string, caps: string[]): EditScript {
  return {
    label,
    cuts: caps.map((caption, i) => ({
      start: TIMES[i][0],
      end: TIMES[i][1],
      caption,
      scene: SCENES[i],
      tts: true,
      keepOriginal: true,
      zoom: ZOOMS[i],
    })),
  };
}

const SHARED = {
  sfx: [
    { at: 6.0, type: "pop" },
    { at: 9.0, type: "boing" },
    { at: 18.0, type: "sparkle" },
  ],
  mosaic: [
    { from: 0, to: 20.2, box: [0.72, 0.02, 0.21, 0.04], kind: "logo", label: "원본 채널 로고 (오른쪽 위 · 전체 구간)" },
    { from: 0, to: 12, box: [0.1, 0.9, 0.8, 0.06], kind: "sub", label: "원본 자막 (아래 · 0:00~0:12)" },
    { from: 11.6, to: 17.3, box: [0.4, 0.18, 0.22, 0.22], kind: "face", label: "사람 얼굴 1 (5~6번 컷)" },
  ],
} satisfies Pick<EditJson, "sfx" | "mosaic">;

export const mockEdit: Record<Lang, EditJson> = {
  ko: {
    titles: [
      { line1: "트리 지키는 집사", line2: "VS 트리 접수한 고양이", hook: "contrast", reason: "추천 · 한 화면에 두 입장을 대비시켜 끝까지 보게 해요" },
      { line1: "집사 눈엔 장식인데", line2: "고양이 눈엔 놀이터", hook: "twist", reason: "같은 물건을 다르게 보는 반전" },
      { line1: "올해 트리도", line2: "결국 고양이 차지", hook: "empathy", reason: "결말을 먼저 보여주는 공감형" },
      { line1: "가시 매트 깔았더니", line2: "3초 만에 뚫림ㅋㅋ", hook: "fail", reason: "실패담으로 웃음을 노리는 유형" },
      { line1: "트리 밑 입주 경쟁", line2: "최종 승자는?", hook: "question", reason: "질문으로 끝까지 보게 하는 유형" },
    ],
    scripts: [
      script("1. AI 추천 · 집사 vs 고양이 대결", ["트리 밑, 막을까 내줄까?", "가시 매트까지 깔았는데", "고양이는 3초 만에 통과", "장식 공은 이미 장난감", "옆집은 아예 집을 넣어줌", "같은 트리, 다른 대접", "결론: 트리 밑은 고양이 거"]),
      script("2. 트리 장식의 진짜 용도 발견", ["트리 장식, 누구를 위한 걸까?", "사람 눈엔 안전장치", "고양이 눈엔 징검다리", "빨간 공은 사냥감 1호", "아예 장식 대신 집을 두면?", "트리가 놀이터로 변신", "이게 진짜 트리 활용법"]),
      script("3. 트리 아래를 부동산으로 보는 관점", ["트리 밑 원룸, 입주 경쟁", "보안 시설: 가시 매트", "입주자 무단 침입 성공", "인테리어 소품 파손 중", "옆 단지는 풀옵션 분양", "같은 평수, 다른 시세", "최종 입주자: 고양이"]),
    ],
    ...SHARED,
    comments: [{ cut: 7, text: "우리 집도 트리 밑이 고양이 방이에요 ㅋㅋ" }],
    meta: { description: "트리를 지키려는 집사와 트리를 접수한 고양이의 대결", hashtags: ["#shorts", "#고양이"] },
  },
  ja: {
    titles: [
      { line1: "ツリーを守る飼い主", line2: "VS 占領した猫", hook: "contrast", reason: "推薦 · 対比で最後まで見せる" },
      { line1: "飼い主には飾りでも", line2: "猫には遊び場", hook: "twist", reason: "同じ物を違う視点で見る反転" },
      { line1: "今年のツリーも", line2: "結局猫のもの", hook: "empathy", reason: "結末を先に見せる共感型" },
      { line1: "トゲマットを敷いたら", line2: "3秒で突破された", hook: "fail", reason: "失敗談で笑いを取る" },
      { line1: "ツリー下の入居争い", line2: "勝者は？", hook: "question", reason: "問いかけで最後まで見せる" },
    ],
    scripts: [
      script("1. AI推薦 · 飼い主 vs 猫", ["ツリーの下、守る？譲る？", "トゲマットまで敷いたのに", "猫は3秒で突破", "オーナメントはもうおもちゃ", "隣の家は猫ハウスを設置", "同じツリー、違う扱い", "結論：ツリーの下は猫のもの"]),
      script("2. オーナメントの本当の使い道", ["ツリーの飾り、誰のため？", "人には安全対策", "猫には飛び石", "赤い玉は獲物1号", "飾りの代わりに家を置いたら？", "ツリーが遊び場に", "これが本当のツリー活用法"]),
      script("3. ツリー下を物件として見ると", ["ツリー下ワンルーム、入居争い", "セキュリティ：トゲマット", "入居者、無断侵入に成功", "インテリア破損中", "隣は家具付き物件", "同じ広さ、違う家賃", "最終入居者：猫"]),
    ],
    ...SHARED,
    comments: [{ cut: 7, text: "うちもツリーの下は猫の部屋です笑" }],
    meta: { description: "ツリーを守る飼い主と占領した猫の対決", hashtags: ["#shorts", "#猫"] },
  },
};

/** 미리보기용 장면 그림(실제 영상 대신). 컷 순서대로 */
export const mockSceneArt = [
  { bg: "#3b2f25", floor: "#7a5a3c", catX: -60, catY: 250, mat: 1, house: 0 },
  { bg: "#2f2a24", floor: "#7a5a3c", catX: -60, catY: 250, mat: 1, house: 0 },
  { bg: "#3b2f25", floor: "#7a5a3c", catX: 150, catY: 228, mat: 1, house: 0 },
  { bg: "#352a20", floor: "#7a5a3c", catX: 112, catY: 196, mat: 0.4, house: 0 },
  { bg: "#2a2f3b", floor: "#8a6a4a", catX: -60, catY: 250, mat: 0, house: 1 },
  { bg: "#302c2c", floor: "#7f6044", catX: 90, catY: 236, mat: 0.6, house: 1 },
  { bg: "#2a2f3b", floor: "#8a6a4a", catX: 214, catY: 214, mat: 0, house: 1 },
] as const;

/** 장면 그림의 고정 색 */
export const sceneInk = {
  tree: ["#1f6b3a", "#227a42", "#26894a"],
  trunk: "#6b4423",
  balls: ["#e5484d", "#ffd83d", "#e5484d", "#f5f5f5"],
  mat: "#cfe9f2",
  house: "#c0392b",
  door: "#3b0d08",
  cat: "#3a3a3a",
  eye: "#ffd83d",
};

/** 영상 안 색: 띠·제목 기본 글자색 */
export const videoInk = { white: "#ffffff", black: "#000000", dark: "#111111", label: "#E5484D" };

/** 댓글 캡처 모양(영상 안에 그려짐) */
export const commentSkins = {
  youtube: { name: "@cat_daily · 2시간 전", bg: "#ffffff", fg: "#111111", border: "transparent", round: "4cqw" },
  insta: { name: "cat_daily", bg: "#efefef", fg: "#111111", border: "transparent", round: "6cqw" },
  community: { name: "ㅇㅇ (익명)", bg: "#f6f6f2", fg: "#222222", border: "#d8d8cf", round: "2cqw" },
} as const;
export const commentAvatar = "linear-gradient(135deg, #f9a8d4, #a78bfa)";
export type CommentStyle = keyof typeof commentSkins;

export const titleColors = [
  { label: "흰 + 노랑", hex: "#FFD83D" },
  { label: "흰 + 초록", hex: "#4ADE80" },
  { label: "흰 + 하늘", hex: "#38BDF8" },
  { label: "흰 + 핑크", hex: "#F472B6" },
  { label: "흰 + 빨강", hex: "#F87171" },
  { label: "흰 + 주황", hex: "#FB923C" },
] as const;

export const fonts = [
  { value: "Black Han Sans", label: "블랙한산스" },
  { value: "Do Hyeon", label: "도현체" },
  { value: "Jua", label: "주아체" },
  { value: "Gothic A1", label: "고딕 A1" },
  { value: "Gowun Dodum", label: "고운돋움" },
  { value: "Noto Sans KR", label: "본고딕" },
] as const;

export type VoiceId = "hanna" | "sehee" | "eunkyung" | "changsu" | "jihoon" | "jinwoo" | "sejin" | "dabin";
export const voices: { id: VoiceId; name: string; tags: string; rec: boolean }[] = [
  { id: "hanna", name: "한나", tags: "여성 · 청년 · Conversational", rec: true },
  { id: "sehee", name: "세희", tags: "여성 · 청년 · Documentary", rec: true },
  { id: "eunkyung", name: "은경", tags: "여성 · 청년 · Radio/Podcast", rec: true },
  { id: "changsu", name: "박창수", tags: "남성 · 청년 · TikTok/Reels/Shorts", rec: true },
  { id: "jihoon", name: "지훈", tags: "남성 · 청년 · Conversational", rec: true },
  { id: "jinwoo", name: "진우", tags: "남성 · 청년 · Documentary", rec: false },
  { id: "sejin", name: "세진", tags: "남성 · 청년 · Audiobook/Storytelling", rec: false },
  { id: "dabin", name: "다빈", tags: "여성 · 10대 · Shorts", rec: false },
];

export type Template = "topWhite" | "topBlack" | "bothWhite" | "bothBlack" | "insta";
export type TitleStyle = "basic" | "box" | "capsule" | "highlight" | "shadow" | "outline" | "label";
export type SubStyle = "stroke" | "box" | "yellow" | "pop";
export type PresetId = "brand" | "shop" | "info" | "jp";

/** 화면 꾸미기 상태(되돌리기 대상) */
export type EditorStyle = {
  preset: PresetId;
  template: Template;
  tplSize: number;
  tplMove: number;
  topSize: number;
  botSize: number;
  titleStyle: TitleStyle;
  colorIdx: number;
  titleFont: string;
  subFont: string;
  titleSize: number;
  subSize: number;
  subPos: "low" | "mid" | "high";
  subStyle: SubStyle;
  subFx: "none" | "bounce" | "type";
  zoom: number;
  videoY: number;
  mosaic: Record<MosaicKind, boolean>;
  cmtOn: boolean;
  cmtStyle: CommentStyle;
  cmtSound: "none" | "pop" | "tok" | "twinkle" | "beep";
};

export const defaultStyle: EditorStyle = {
  preset: "brand",
  template: "topBlack",
  tplSize: 100,
  tplMove: 0,
  topSize: 22,
  botSize: 18,
  titleStyle: "basic",
  colorIdx: 0,
  titleFont: "Black Han Sans",
  subFont: "Do Hyeon",
  titleSize: 26,
  subSize: 16,
  subPos: "low",
  subStyle: "stroke",
  subFx: "none",
  zoom: 100,
  videoY: 0,
  mosaic: { logo: true, sub: false, face: false },
  cmtOn: true,
  cmtStyle: "youtube",
  cmtSound: "pop",
};

export const presets: Record<PresetId, { label: string; patch: Partial<EditorStyle> }> = {
  brand: { label: "내 채널 기본", patch: { template: "topBlack", titleStyle: "basic", colorIdx: 0, titleFont: "Black Han Sans", subStyle: "stroke" } },
  shop: { label: "쇼핑 쇼츠", patch: { template: "topWhite", titleStyle: "box", colorIdx: 0, titleFont: "Do Hyeon", subStyle: "box" } },
  info: { label: "정보형", patch: { template: "topBlack", titleStyle: "highlight", colorIdx: 2, titleFont: "Black Han Sans", subStyle: "stroke" } },
  jp: { label: "일본 채널", patch: { template: "bothWhite", titleStyle: "basic", colorIdx: 4, titleFont: "Gothic A1", subStyle: "yellow" } },
};

/** 새 댓글 넣기에 쓰는 원본 인기 댓글(레이더에서 가져온 것으로 가정) */
export const pickedComment: Record<Lang, string> = { ko: "이거 완전 우리 집 얘기ㅋㅋ", ja: "これ完全にうちの話w" };

export const editCost = { reorg: 3 } as const;
