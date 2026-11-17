"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Card, Chip } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/state-blocks";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { radarGroupCounts, radarPerf, radarVideos, type RadarVideo } from "@/mocks/radar";

type Opt<T> = { l: string; v: T };
type Group = "all" | "ref" | "ref200";
type Sort = "mult" | "fresh" | "recent" | "pop" | "subs";

const GROUPS: Opt<Group>[] = [
  { l: "전체", v: "all" },
  { l: "레퍼런스채널", v: "ref" },
  { l: "레퍼런스채널200", v: "ref200" },
];
const HOURS: Opt<number>[] = [
  { l: "24시간", v: 24 },
  { l: "72시간", v: 72 },
  { l: "120시간", v: 120 },
  { l: "10일", v: 240 },
];
const MULTS: Opt<number>[] = [
  { l: "전체", v: 0 },
  { l: "5배+", v: 5 },
  { l: "10배+", v: 10 },
  { l: "50배+", v: 50 },
];
const SORTS: Opt<Sort>[] = [
  { l: "떡상순", v: "mult" },
  { l: "국내 미등장 먼저", v: "fresh" },
  { l: "최신순", v: "recent" },
  { l: "인기순", v: "pop" },
  { l: "구독자순", v: "subs" },
];

const sorters: Record<Sort, (a: RadarVideo, b: RadarVideo) => number> = {
  mult: (a, b) => b.mult - a.mult,
  recent: (a, b) => a.hours - b.hours,
  pop: (a, b) => b.views - a.views,
  subs: (a, b) => b.subs - a.subs,
  fresh: (a, b) => Number(b.fresh) - Number(a.fresh) || b.mult - a.mult,
};

function fmt(n: number) {
  return n >= 10000 ? `${Math.round(n / 1000) / 10}만` : n.toLocaleString("ko-KR");
}
function nowLabel() {
  const d = new Date();
  const h = d.getHours();
  return `${d.getMonth() + 1}.${d.getDate()}. ${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ChipGroup<T>({ label, opts, value, onPick }: { label: string; opts: Opt<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <div>
      <span className="mb-2 block text-caption font-bold text-sub">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <Chip key={o.l} selected={value === o.v} className="min-h-9 px-[0.8125rem] text-caption" onClick={() => onPick(o.v)}>
            {o.l}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const badge = "absolute inline-flex items-center gap-[0.1875rem] rounded-md px-1.5 py-0.5 text-2xs font-bold";

export function RadarView() {
  const [group, setGroup] = useState<Group>("all");
  const [hours, setHours] = useState(120);
  const [mult, setMult] = useState(5);
  const [sort, setSort] = useState<Sort>("mult");
  const [made, setMade] = useState<Record<number, boolean>>({ 2: true });
  const [runs, setRuns] = useState(1);
  const [runAt, setRunAt] = useState("11.15. 오후 9:48");
  const [scan, setScan] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const done = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { show, toast } = useToast(2200);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      clearTimeout(done.current);
    },
    [],
  );

  const scanning = scan >= 0;
  const run = () => {
    if (scanning) return;
    let p = 0;
    setScan(0);
    timer.current = setInterval(() => {
      p = Math.min(100, p + 5 + Math.floor(Math.random() * 12));
      setScan(p);
      if (p >= 100) {
        clearInterval(timer.current);
        done.current = setTimeout(() => {
          setScan(-1);
          setRuns((r) => r + 1);
          setRunAt(nowLabel());
          show("스캔 완료 — 결과를 새로 불러왔어요.");
        }, 450);
      }
    }, 300);
  };

  const rows = radarVideos
    .filter((v) => (group === "all" || v.group === group) && v.hours <= hours && v.mult >= mult)
    .sort(sorters[sort]);
  const newCount = rows.filter((v) => (runs > 1 ? false : !v.seen)).length;

  return (
    <main className="mx-auto flex w-full max-w-[77.5rem] flex-1 flex-col gap-4 px-5 pt-4 pb-20">
      <Card aria-labelledby="rd-h" className="p-4 md:p-5">
        <h1 id="rd-h" className="text-md font-bold md:text-lg">떡상 소재 레이더</h1>
        <p className="mt-1 text-sm text-sub">
          저장한 레퍼런스 채널에서 평소보다 크게 터진 영상만 모았어요. 마음에 드는 소재는 바로 스튜디오로 보내세요.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-[1.125rem] md:grid-cols-2 xl:grid-cols-3">
          <ChipGroup label="그룹" opts={GROUPS} value={group} onPick={setGroup} />
          <ChipGroup label="시간" opts={HOURS} value={hours} onPick={setHours} />
          <ChipGroup label="떡상 배율" opts={MULTS} value={mult} onPick={setMult} />
        </div>
        <div className="mt-[1.125rem] flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-caption text-sub">예약 스캔 1시간마다 · 다음 오후 10:00 · 새 소재가 나오면 텔레그램 알림</span>
          <Btn variant="cta" size="lg" className="min-h-[2.625rem] px-5 text-sm" loading={scanning} onClick={run}>
            {!scanning && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 4l13 8-13 8z" />
              </svg>
            )}
            {scanning ? "스캔 중…" : "추적 시작"}
          </Btn>
        </div>
        {scanning && (
          <div className="mt-3.5">
            <div className="mb-1.5 flex justify-between text-xs text-sub">
              <span>레퍼런스 채널 스캔 중…</span>
              <b className="font-black text-brand">{scan}%</b>
            </div>
            <Progress value={scan} label="스캔 진행률" />
          </div>
        )}
      </Card>

      <Card aria-labelledby="res-h" className="p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="res-h" className="text-h2 font-bold">
            추적 결과<small className="ml-1.5 text-caption font-medium text-sub">{rows.length}건</small>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((o) => (
              <Chip key={o.v} selected={sort === o.v} className="min-h-9 px-[0.8125rem] text-caption" onClick={() => setSort(o.v)}>
                {o.l}
              </Chip>
            ))}
          </div>
        </div>
        <p className="mb-3.5 mt-2 text-caption text-sub">
          {runAt} 기준 · 대상 채널 {radarGroupCounts[group]}개 · {rows.length}건 (새 영상 {newCount}건) · 이미 모아 둔 스냅샷만 읽어 추가 비용이 없어요 · 샘플 데이터
        </p>
        {rows.length === 0 ? (
          <EmptyState message="조건에 맞는 영상이 없어요. 시간·배율 조건을 넓혀 보세요." />
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-5">
            {rows.map((v) => {
              const isMade = !!made[v.id];
              const isNew = runs > 1 ? false : !v.seen;
              const multTxt = `${v.mult.toFixed(1)}x`;
              return (
                <article
                  key={v.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-[0.875rem] border-[0.09375rem] bg-card p-1.5",
                    v.mult >= 10 ? "border-brand/50" : "border-line",
                    isMade && "opacity-55",
                  )}
                >
                  <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[0.625rem]" style={{ background: v.bg }}>
                    <span className={cn(badge, "left-1.5 top-1.5", isNew ? "bg-pink text-text" : "bg-bg/70 text-text")}>
                      {isNew ? "NEW" : "지난 스캔에도 있었음"}
                    </span>
                    <span className={cn(badge, "right-1.5 top-1.5 bg-brand text-bg")}>{multTxt}</span>
                    {v.fresh && <span className={cn(badge, "bottom-1.5 left-1.5 bg-ok text-bg")}>국내 미등장</span>}
                    {isMade && <span className={cn(badge, "bottom-1.5 right-1.5 bg-brand text-bg")}>제작함</span>}
                    <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-text/90 text-bg">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
                    </span>
                  </div>
                  <h3 className="mx-0.5 line-clamp-2 font-bold min-h-[2.1875rem] text-caption leading-[1.4]">{v.title}</h3>
                  <p className="mx-0.5 text-xs text-sub">{v.channel} · 구독자 {fmt(v.subs)}</p>
                  <div className="grid grid-cols-3 gap-0.5 border-t border-line pt-1.5">
                    <div><b className="block text-sm tabular-nums">{fmt(v.views)}</b><span className="text-2xs text-sub">조회수</span></div>
                    <div><b className="block text-sm tabular-nums">{v.hours}시간</b><span className="text-2xs text-sub">경과</span></div>
                    <div><b className="block text-sm tabular-nums text-brand">{multTxt}</b><span className="text-2xs text-sub">떡상배율</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Link href="/" className="flex min-h-[2.125rem] items-center justify-center rounded-lg bg-card2 text-xs font-bold hover:brightness-[1.18]">영상형으로</Link>
                    <Link href="/" className="flex min-h-[2.125rem] items-center justify-center rounded-lg bg-card2 text-xs font-bold hover:brightness-[1.18]">대본형으로</Link>
                  </div>
                  <button
                    type="button"
                    className="min-h-[1.875rem] cursor-pointer rounded-lg text-xs text-sub"
                    onClick={() => setMade((m) => ({ ...m, [v.id]: !isMade }))}
                  >
                    {isMade ? "제작 표시 지우기" : "만든 소재로 표시"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card aria-labelledby="pf-h" className="p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pf-h" className="text-h2 font-bold">
            성과 추적<small className="ml-1.5 text-caption font-medium text-sub">내가 올린 영상 · 원본 대비</small>
          </h2>
          <span className="text-caption text-sub">업로드 후 48시간 기준 · 샘플 데이터</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr>
                {["내 영상", "채널", "원본 소재", "조회수", "내 채널 평소 대비", "제목 유형"].map((h) => (
                  <th key={h} className="border-b border-line px-2.5 py-2 text-left text-xs font-medium text-sub">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {radarPerf.map((p) => (
                <tr key={p.title}>
                  <td className="border-b border-line p-2.5">{p.title}</td>
                  <td className="border-b border-line p-2.5">{p.ch}</td>
                  <td className="border-b border-line p-2.5">{p.src}</td>
                  <td className="border-b border-line p-2.5">{p.views}</td>
                  <td className="border-b border-line p-2.5 font-bold text-ok">{p.mult}</td>
                  <td className="border-b border-line p-2.5">{p.hook}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-xs text-sub">잘된 영상의 제목 유형은 다음 제목 3안을 만들 때 예시로 자동 반영돼요.</p>
      </Card>
      {toast}
    </main>
  );
}
