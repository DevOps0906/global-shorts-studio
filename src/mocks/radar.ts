// 가짜 데이터: 시안 Radar 전용. 썸네일 색은 자리표시용 그라데이션(hsl).
export type RadarGroup = "ref" | "ref200";
export type RadarVideo = {
  id: number;
  title: string;
  channel: string;
  subs: number;
  views: number;
  hours: number;
  mult: number;
  group: RadarGroup;
  seen: boolean;
  fresh: boolean;
  dur: string;
  bg: string;
};

const g = (a: string, b: string) => `linear-gradient(160deg, ${a}, ${b})`;

export const radarVideos: RadarVideo[] = [
  { id: 1, title: "Cat refuses to leave the Christmas tree", channel: "PawTwist", subs: 42000, views: 2780000, hours: 60, mult: 571.5, group: "ref200", seen: true, fresh: true, dur: "0:14", bg: g("hsl(32 36% 35%)", "hsl(30 36% 13%)") },
  { id: 2, title: "Mom lines the family up against the wall", channel: "HomeLaughs", subs: 76000, views: 4040000, hours: 41, mult: 149.6, group: "ref200", seen: true, fresh: false, dur: "0:22", bg: g("hsl(30 16% 65%)", "hsl(25 12% 25%)") },
  { id: 3, title: "Tiny glasses made for a doll", channel: "MiniMaker", subs: 23000, views: 200000, hours: 22, mult: 48.2, group: "ref", seen: false, fresh: true, dur: "0:31", bg: g("hsl(80 24% 44%)", "hsl(80 28% 16%)") },
  { id: 4, title: "Girl finds her lost bird at the pet shop", channel: "FeatherNest", subs: 37000, views: 310000, hours: 35, mult: 27.4, group: "ref", seen: false, fresh: true, dur: "0:27", bg: g("hsl(340 34% 64%)", "hsl(340 18% 20%)") },
  { id: 5, title: "Rhino beetle opens its wings", channel: "BugLens", subs: 79000, views: 960000, hours: 58, mult: 13.7, group: "ref200", seen: true, fresh: false, dur: "0:16", bg: g("hsl(28 52% 35%)", "hsl(28 70% 8%)") },
  { id: 6, title: "Bowling balls shatter, then rebuild", channel: "BounceLab", subs: 36000, views: 8570000, hours: 46, mult: 12.4, group: "ref", seen: false, fresh: false, dur: "0:18", bg: g("hsl(173 66% 50%)", "hsl(175 77% 26%)") },
  { id: 7, title: "Puppy meets a cucumber for the first time", channel: "DoggoDaily", subs: 88000, views: 1210000, hours: 18, mult: 11.2, group: "ref", seen: false, fresh: true, dur: "0:12", bg: g("hsl(33 70% 66%)", "hsl(33 52% 28%)") },
  { id: 8, title: "Nobody uses the space under the stairs like this", channel: "BuildBrain", subs: 25000, views: 274000, hours: 82, mult: 10.0, group: "ref200", seen: true, fresh: false, dur: "0:58", bg: g("hsl(40 93% 33%)", "hsl(40 80% 14%)") },
  { id: 9, title: "Grandma reacts to her first VR headset", channel: "FamilyFun", subs: 140000, views: 690000, hours: 30, mult: 6.8, group: "ref200", seen: false, fresh: true, dur: "0:24", bg: g("hsl(239 84% 67%)", "hsl(243 47% 20%)") },
  { id: 10, title: "Parrot was NOT happy with this juice", channel: "FeatherNest", subs: 37000, views: 438000, hours: 60, mult: 5.2, group: "ref", seen: true, fresh: false, dur: "0:11", bg: g("hsl(220 9% 65%)", "hsl(217 19% 27%)") },
];

export const radarGroupCounts = { all: 399, ref: 100, ref200: 299 } as const;

export const radarPerf = [
  { title: "트리 지키는 집사 VS 트리 접수한 고양이", ch: "고양이 쇼츠 (KR)", src: "PawTwist", views: "12.4만", mult: "8.3x", hook: "대비형" },
  { title: "ツリーを守る飼い主 VS 占領した猫", ch: "ねこショート (JP)", src: "PawTwist", views: "31.2만", mult: "14.1x", hook: "대비형" },
  { title: "장수풍뎅이 날개가 다 들어가는 이유", ch: "고양이 쇼츠 (KR)", src: "BugLens", views: "4.1만", mult: "2.7x", hook: "호기심형" },
  { title: "이 각도 보면 이미 속은 거임", ch: "고양이 쇼츠 (KR)", src: "BounceLab", views: "1.9만", mult: "1.2x", hook: "도발형" },
] as const;
