// 가짜 데이터: 시안 Saved 전용.
export type ChannelGroup = "ref" | "ref200";
export type SavedChannel = {
  id: number;
  name: string;
  subs: string;
  avg: string;
  scan: string;
  grp: ChannelGroup;
  on: boolean;
};

export const savedChannels: SavedChannel[] = [
  { id: 1, name: "PawTwist", subs: "82만", avg: "1.8만", scan: "오후 9:48", grp: "ref", on: true },
  { id: 2, name: "BugLens", subs: "41만", avg: "9.2천", scan: "오후 9:48", grp: "ref", on: true },
  { id: 3, name: "BounceLab", subs: "12만", avg: "1.6만", scan: "오후 9:48", grp: "ref200", on: true },
  { id: 4, name: "ネコの日常", subs: "25만", avg: "3.4만", scan: "오후 9:48", grp: "ref200", on: true },
  { id: 5, name: "Daily Dose of Fun", subs: "230만", avg: "5.1만", scan: "오후 9:48", grp: "ref", on: false },
  { id: 6, name: "Kitchen Tricks JP", subs: "8.4만", avg: "7.7천", scan: "오후 9:48", grp: "ref200", on: true },
];

export const channelGroupNames: Record<ChannelGroup, string> = { ref: "레퍼런스채널", ref200: "레퍼런스채널200" };
