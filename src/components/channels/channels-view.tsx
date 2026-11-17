"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Card, Chip, Kpi, Tag } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { channelGroupNames, savedChannels, type ChannelGroup, type SavedChannel } from "@/mocks/channels";

type Grp = "all" | ChannelGroup;
const GRPS: { l: string; v: Grp }[] = [
  { l: "전체", v: "all" },
  { l: "레퍼런스채널", v: "ref" },
  { l: "레퍼런스채널200", v: "ref200" },
];

export function ChannelsView() {
  const [grp, setGrp] = useState<Grp>("all");
  const [list, setList] = useState<SavedChannel[]>(savedChannels);
  const [url, setUrl] = useState("");
  const [add, setAdd] = useState(-1);
  const seq = useRef(100);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const { show, toast } = useToast(2200);

  useEffect(() => () => clearInterval(timer.current), []);

  const adding = add >= 0;
  const rows = list.filter((c) => grp === "all" || c.grp === grp);
  const paused = list.filter((c) => !c.on).length;
  const total = 391 + list.length;

  const addChannel = () => {
    const u = url.trim();
    if (!u) {
      show("채널 주소나 @핸들을 입력해 주세요.");
      return;
    }
    const name = u.replace(/^https?:\/\/(www\.)?youtube\.com\//, "").replace(/^@/, "") || u;
    let p = 0;
    setAdd(0);
    timer.current = setInterval(() => {
      p = Math.min(100, p + 12 + Math.floor(Math.random() * 18));
      if (p < 100) {
        setAdd(p);
        return;
      }
      clearInterval(timer.current);
      seq.current += 1;
      const n: SavedChannel = { id: seq.current, name, subs: "신규", avg: "집계 중", scan: "방금", grp: "ref", on: true };
      setAdd(-1);
      setUrl("");
      setList((l) => [n, ...l]);
      show(`${name} 채널을 저장했어요. 다음 스캔부터 추적해요.`);
    }, 260);
  };

  const flip = (c: SavedChannel) => {
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, on: !x.on } : x)));
    show(c.name + (c.on ? " 추적을 멈췄어요." : " 추적을 다시 시작해요."));
  };
  const remove = (c: SavedChannel) => {
    setList((l) => l.filter((x) => x.id !== c.id));
    show(`${c.name} 채널을 삭제했어요.`);
  };

  return (
    <main className="mx-auto flex w-full max-w-[65rem] flex-1 flex-col gap-4 px-3 pb-12 md:px-5 md:pb-[3.75rem]">
      <Card className="p-4 md:p-[1.375rem]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="mb-1.5 text-lg font-black md:text-xl xl:text-2xl">
              저장 채널 <small className="text-caption font-normal text-sub">레퍼런스로 추적하는 채널</small>
            </h1>
            <p className="text-sub">여기 저장한 채널에서 떡상 영상이 나오면 레이더에 모아 보여줘요.</p>
          </div>
          <Link href="/radar" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cta px-[1.125rem] text-sm font-black text-bg hover:brightness-[1.08]">
            레이더에서 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="저장 채널" value={total} />
          <Kpi label="추적 중" value={total - paused} accent />
          <Kpi label="일시 중지" value={paused} />
          <Kpi label="YouTube 쿼터 사용" value={`${(6420 + list.length * 3).toLocaleString("en-US")} / 10,000`} />
        </div>
      </Card>

      <Card className="p-4 md:p-[1.375rem]">
        <h2 className="text-md font-black md:text-lg">
          채널 추가<small className="ml-2 text-caption font-medium text-sub">주소·@핸들·여러 줄 붙여넣기</small>
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input
            aria-label="채널 주소 또는 핸들"
            className="min-h-[2.625rem] min-w-0 flex-[1_1_15rem] rounded-[0.625rem] border border-line bg-card px-3 text-sm text-text"
            placeholder="https://youtube.com/@handle 또는 @handle"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Btn variant="cta" size="md" className="min-h-10 px-[1.125rem] text-sm" loading={adding} onClick={addChannel}>
            {adding ? "확인 중…" : "+ 채널 추가"}
          </Btn>
        </div>
        {adding && (
          <div className="mx-auto mb-1.5 mt-3.5 w-full max-w-[26.25rem]">
            <div className="mb-1.5 flex justify-between text-xs text-sub">
              <span>채널 정보 확인 중…</span>
              <b className="font-black text-brand">{add}%</b>
            </div>
            <Progress value={add} label="채널 정보 확인 진행률" />
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-[1.375rem]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-md font-black md:text-lg">
            채널 목록<small className="ml-2 text-caption font-medium text-sub">{rows.length}개 표시</small>
          </h2>
          <div className="flex flex-wrap gap-2">
            {GRPS.map((o) => (
              <Chip key={o.v} selected={grp === o.v} onClick={() => setGrp(o.v)}>
                {o.l}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((c) => (
            <div key={c.id} className={cn("flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3", !c.on && "opacity-55")}>
              <div className="min-w-0 flex-[1_1_11.25rem]">
                <b className="block">{c.name}</b>
                <span className="block text-caption text-sub">구독자 {c.subs} · 평균 조회 {c.avg} · 마지막 스캔 {c.scan}</span>
              </div>
              <Tag className="self-center">{channelGroupNames[c.grp]}</Tag>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={c.on}
                  aria-label="추적 켜기/끄기"
                  onClick={() => flip(c)}
                  className={cn("relative h-6 w-[2.625rem] flex-none cursor-pointer rounded-full border-0 p-0 transition-colors", c.on ? "bg-ok" : "bg-line")}
                >
                  <i className={cn("absolute top-[0.1875rem] size-[1.125rem] rounded-full bg-text transition-[left] duration-200", c.on ? "left-[1.3125rem]" : "left-[0.1875rem]")} />
                </button>
                <Btn size="sm" className="border-0 text-danger" onClick={() => remove(c)}>삭제</Btn>
              </div>
            </div>
          ))}
        </div>
        {rows.length === 0 && <p className="text-caption text-sub">조건에 맞는 채널이 없어요.</p>}
      </Card>
      {toast}
    </main>
  );
}
