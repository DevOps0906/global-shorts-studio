"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { YtNotice } from "@/components/radar/yt-notice";
import { Btn } from "@/components/ui/btn";
import { Card, Chip } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Message, Skeleton } from "@/components/ui/state-blocks";
import { useToast } from "@/components/ui/toast";
import { callApi, fmtCount, fmtDuration, fmtReset, type ApiError } from "@/lib/radar-format";
import { cn } from "@/lib/utils";
import { radarPerf } from "@/mocks/radar";
import type { RadarData, RadarItem } from "@/server/radar";

type Opt<T> = { l: string; v: T };
type Group = "all" | "ref" | "ref200";
type Sort = "recent" | "pop" | "subs";

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
// 떡상 배율은 파생 지표라 준비 중(YouTube 개발자 정책 III.E.4.h, PLAN 7-2)
const MULTS: Opt<string>[] = ["전체", "5배+", "10배+", "50배+"].map((l) => ({ l, v: l }));
/** 준비 중 정렬(파생 지표·미구현) — 선택 불가 표시만 */
const SOON_SORTS = ["떡상순", "국내 미등장 먼저"];
const SORTS: Opt<Sort>[] = [
  { l: "최신순", v: "recent" },
  { l: "인기순", v: "pop" },
  { l: "구독자순", v: "subs" },
];

const sorters: Record<Sort, (a: RadarItem, b: RadarItem) => number> = {
  recent: (a, b) => a.hours - b.hours,
  pop: (a, b) => (b.views ?? -1) - (a.views ?? -1),
  subs: (a, b) => (b.subs ?? -1) - (a.subs ?? -1),
};

const chipOff = "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:brightness-100";

function ChipGroup<T>({
  label,
  opts,
  value,
  onPick,
  off = false,
}: {
  label: string;
  opts: Opt<T>[];
  value: T;
  onPick: (v: T) => void;
  off?: boolean;
}) {
  return (
    <div>
      <span className="mb-2 block text-caption font-bold text-sub">
        {label}
        {off && <span className="ml-1.5 font-medium">· 준비 중</span>}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <Chip
            key={o.l}
            selected={!off && value === o.v}
            disabled={off}
            className={cn("min-h-9 px-[0.8125rem] text-caption", chipOff)}
            onClick={() => onPick(o.v)}
          >
            {o.l}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const badge = "absolute inline-flex items-center gap-[0.1875rem] rounded-md px-1.5 py-0.5 text-2xs font-bold";

/** 로딩 스켈레톤(13-1): 필터 카드 + 9:16 카드 격자 모양 */
export function RadarSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-[77.5rem] flex-1 flex-col gap-4 px-5 pt-4 pb-20">
      <Card className="p-4 md:p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-4 w-4/5" />
        <Skeleton className="mt-5 h-9 w-full" />
      </Card>
      <Card className="p-4 md:p-5">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full" />
          ))}
        </div>
      </Card>
    </main>
  );
}

export function RadarView({ data }: { data: RadarData | null }) {
  const router = useRouter();
  const [group, setGroup] = useState<Group>("all");
  const [hours, setHours] = useState(120);
  const [sort, setSort] = useState<Sort>("pop");
  const [scan, setScan] = useState(-1);
  const [err, setErr] = useState<ApiError | null>(null);
  const [retrying, startRetry] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const { show, toast } = useToast(2600);

  useEffect(() => () => clearInterval(timer.current), []);

  const scanning = scan >= 0;
  const run = async () => {
    if (scanning) return;
    setErr(null);
    setScan(0);
    // 응답 전까지 90%까지만 천천히 채운다(11-3)
    timer.current = setInterval(() => setScan((p) => Math.min(90, p + 3 + Math.floor(Math.random() * 6))), 400);
    const r = await callApi<{ scanned: number; saved: number; skipped: string[] }>("/api/radar/scan", "POST");
    clearInterval(timer.current);
    setScan(-1);
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    const { scanned, saved, skipped } = r.data;
    show(
      skipped.length
        ? `채널 ${scanned}개 스캔 · 영상 ${saved}건 · 찾지 못한 채널 ${skipped.length}개(${skipped.slice(0, 3).join(", ")})`
        : `스캔 완료 — 채널 ${scanned}개 · 영상 ${saved}건을 새로 불러왔어요.`,
    );
    router.refresh();
  };

  const retryLoad = () => startRetry(() => router.refresh());

  const channels = data?.channels ?? [];
  const targets = channels.filter((c) => c.tracking && (group === "all" || c.grp === group)).length;
  const rows = (data?.items ?? [])
    .filter((v) => (group === "all" || v.grp === group) && v.hours <= hours)
    .sort(sorters[sort]);
  const newCount = rows.filter((v) => v.isNew).length;

  return (
    <main className="mx-auto flex w-full max-w-[77.5rem] flex-1 flex-col gap-4 px-5 pt-4 pb-20">
      <Card aria-labelledby="rd-h" className="p-4 md:p-5">
        <h1 id="rd-h" className="text-md font-bold md:text-lg">떡상 소재 레이더</h1>
        <p className="mt-1 text-sm text-sub">
          저장한 레퍼런스 채널의 최근 쇼츠를 모았어요. 마음에 드는 소재는 바로 스튜디오로 보내세요.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-[1.125rem] md:grid-cols-2 xl:grid-cols-3">
          <ChipGroup label="그룹" opts={GROUPS} value={group} onPick={setGroup} />
          <ChipGroup label="시간" opts={HOURS} value={hours} onPick={setHours} />
          <ChipGroup label="떡상 배율" opts={MULTS} value="" onPick={() => {}} off />
        </div>
        <div className="mt-[1.125rem] flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-caption text-sub">수동 스캔은 10분에 한 번 · 예약 스캔·알림은 준비 중</span>
          <Btn
            variant="cta"
            size="lg"
            className="min-h-[2.625rem] px-5 text-sm"
            loading={scanning}
            disabled={!data || channels.length === 0}
            onClick={run}
          >
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
        {err && (
          <div className="mt-3.5">
            <Message title={err.code === "YT_QUOTA_EXCEEDED" ? "오늘 YouTube 사용량이 모두 소진됐어요" : "스캔하지 못했어요"} code={err.code}>
              {err.message}
              {err.resetAt && ` 다음 초기화: ${fmtReset(err.resetAt)}`}
            </Message>
            {err.code !== "YT_QUOTA_EXCEEDED" && err.code !== "RATE_LIMITED" && (
              <Btn className="mt-2" onClick={run}>다시 시도</Btn>
            )}
          </div>
        )}
      </Card>

      <Card aria-labelledby="res-h" className="p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="res-h" className="text-h2 font-bold">
            추적 결과<small className="ml-1.5 text-caption font-medium text-sub">{rows.length}건</small>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {SOON_SORTS.map((l) => (
              <Chip key={l} disabled title="준비 중" className={cn("min-h-9 px-[0.8125rem] text-caption", chipOff)}>
                {l}
              </Chip>
            ))}
            {SORTS.map((o) => (
              <Chip
                key={o.v}
                selected={sort === o.v}
                className="min-h-9 px-[0.8125rem] text-caption"
                onClick={() => setSort(o.v)}
              >
                {o.l}
              </Chip>
            ))}
          </div>
        </div>
        <p className="mb-3.5 mt-2 text-caption text-sub">
          {data?.lastScanLabel ? `${data.lastScanLabel} 기준` : "아직 스캔 전"} · 대상 채널 {targets}개 · {rows.length}건 (새 영상 {newCount}건) · 저장된 결과만 읽어 추가 사용량이 없어요
        </p>
        {!data ? (
          <div className="flex flex-col gap-2.5">
            <Message title="레이더 결과를 불러오지 못했어요" code="UPSTREAM_ERROR">잠시 후 다시 시도해 주세요.</Message>
            <Btn className="self-start" loading={retrying} onClick={retryLoad}>다시 시도</Btn>
          </div>
        ) : channels.length === 0 ? (
          <EmptyState
            message="저장한 채널이 없어요. 레퍼런스 채널을 추가하면 최근 쇼츠를 모아 보여줘요."
            action={
              <Link href="/channels" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cta px-[1.125rem] text-sm font-black text-bg hover:brightness-[1.08]">
                채널 추가
              </Link>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState message="조건에 맞는 영상이 없어요. 시간 조건을 넓히거나 추적 시작을 눌러 보세요." />
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-5">
            {rows.map((v) => (
              <article key={v.id} className="flex flex-col gap-2 rounded-[0.875rem] border-[0.09375rem] border-line bg-card p-1.5">
                <div
                  className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[0.625rem] bg-card2 bg-cover bg-center"
                  style={v.thumbnailUrl ? { backgroundImage: `url("${v.thumbnailUrl}")` } : undefined}
                >
                  <span className={cn(badge, "left-1.5 top-1.5", v.isNew ? "bg-pink text-text" : "bg-bg/70 text-text")}>
                    {v.isNew ? "NEW" : "지난 스캔에도 있었음"}
                  </span>
                  <span className={cn(badge, "right-1.5 top-1.5 bg-bg/70 text-text")}>{fmtDuration(v.durationS)}</span>
                  <a
                    href={`https://www.youtube.com/shorts/${v.ytVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`YouTube에서 보기: ${v.title}`}
                    className="flex size-9 items-center justify-center rounded-full bg-text/90 text-bg after:absolute after:inset-0 after:content-['']"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
                  </a>
                </div>
                <h3 className="mx-0.5 line-clamp-2 font-bold min-h-[2.1875rem] text-caption leading-[1.4]">{v.title}</h3>
                <p className="mx-0.5 text-xs text-sub">{v.channel} · 구독자 {fmtCount(v.subs)}</p>
                <div className="grid grid-cols-3 gap-0.5 border-t border-line pt-1.5">
                  <div><b className="block text-sm tabular-nums">{fmtCount(v.views)}</b><span className="text-2xs text-sub">조회수</span></div>
                  <div><b className="block text-sm tabular-nums">{v.hours}시간</b><span className="text-2xs text-sub">경과</span></div>
                  <div><b className="block text-sm text-sub">준비 중</b><span className="text-2xs text-sub">떡상배율</span></div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Link href={`/studio/new?type=video&src=${v.id}`} className="flex min-h-[2.125rem] items-center justify-center rounded-lg bg-card2 text-xs font-bold hover:brightness-[1.18]">영상형으로</Link>
                  <Link href={`/studio/new?type=script&src=${v.id}`} className="flex min-h-[2.125rem] items-center justify-center rounded-lg bg-card2 text-xs font-bold hover:brightness-[1.18]">대본형으로</Link>
                </div>
                <button type="button" disabled className="min-h-[1.875rem] cursor-not-allowed rounded-lg text-xs text-sub opacity-55">
                  만든 소재 표시 · 준비 중
                </button>
              </article>
            ))}
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
                  <td className="border-b border-line p-2.5 text-sub">준비 중</td>
                  <td className="border-b border-line p-2.5">{p.hook}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-xs text-sub">잘된 영상의 제목 유형은 다음 제목 3안을 만들 때 예시로 자동 반영돼요.</p>
      </Card>
      <YtNotice />
      {toast}
    </main>
  );
}
