"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { YtNotice } from "@/components/radar/yt-notice";
import { Btn } from "@/components/ui/btn";
import { Card, Chip, Kpi, Tag } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Message, Skeleton } from "@/components/ui/state-blocks";
import { useToast } from "@/components/ui/toast";
import { callApi, fmtCount, fmtReset, type ApiError } from "@/lib/radar-format";
import { cn } from "@/lib/utils";
import { channelGroupNames, type ChannelGroup } from "@/mocks/channels";
import type { RadarChannel, RadarData } from "@/server/radar";

type Grp = "all" | ChannelGroup;
const GRPS: { l: string; v: Grp }[] = [
  { l: "전체", v: "all" },
  { l: "레퍼런스채널", v: "ref" },
  { l: "레퍼런스채널200", v: "ref200" },
];

/** 로딩 스켈레톤(13-1): KPI 타일 + 채널 행 모양 */
export function ChannelsSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-[67.5rem] flex-1 flex-col gap-4 px-3 pt-3 pb-12 md:px-5 md:pb-[3.75rem]">
      <Card className="p-4 md:p-[1.375rem]">
        <Skeleton className="h-7 w-40" />
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[4.5rem] w-full" />
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-2 p-4 md:p-[1.375rem]">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </Card>
    </main>
  );
}

export function ChannelsView({ data }: { data: RadarData | null }) {
  const router = useRouter();
  const [grp, setGrp] = useState<Grp>("all");
  const [url, setUrl] = useState("");
  const [add, setAdd] = useState(-1);
  const [addErr, setAddErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [retrying, startRetry] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const { show, toast } = useToast(2200);

  useEffect(() => () => clearInterval(timer.current), []);

  const list = data?.channels ?? [];
  const adding = add >= 0;
  const rows = list.filter((c) => grp === "all" || c.grp === grp);
  const paused = list.filter((c) => !c.tracking).length;
  const empty = !!data && list.length === 0;

  const addChannel = async () => {
    const u = url.trim();
    if (!u) {
      show("채널 주소나 @핸들을 입력해 주세요.");
      return;
    }
    setAddErr(null);
    setAdd(0);
    timer.current = setInterval(() => setAdd((p) => Math.min(90, p + 8 + Math.floor(Math.random() * 12))), 260);
    const r = await callApi<{ name: string }>("/api/radar/channels", "POST", { input: u });
    clearInterval(timer.current);
    setAdd(-1);
    if ("error" in r) {
      setAddErr(r.error); // 입력값은 지우지 않는다(13-1)
      return;
    }
    setUrl("");
    show(`${r.data.name} 채널을 저장했어요. 다음 스캔부터 추적해요.`);
    router.refresh();
  };

  const mutate = async (c: RadarChannel, method: "PATCH" | "DELETE", body: unknown, done: string) => {
    setBusy(c.id);
    const r = await callApi(`/api/radar/channels/${c.id}`, method, body);
    setBusy(null);
    if ("error" in r) {
      show(`${r.error.message} (${r.error.code})`);
      return;
    }
    show(done);
    router.refresh();
  };
  const name = (c: RadarChannel) => c.name ?? c.handle;
  const flip = (c: RadarChannel) =>
    mutate(c, "PATCH", { tracking: !c.tracking }, name(c) + (c.tracking ? " 추적을 멈췄어요." : " 추적을 다시 시작해요."));
  const remove = (c: RadarChannel) => mutate(c, "DELETE", {}, `${name(c)} 채널을 삭제했어요.`);

  return (
    <main className="mx-auto flex w-full max-w-[67.5rem] flex-1 flex-col gap-4 px-3 pt-3 pb-12 md:px-5 md:pb-[3.75rem]">
      <Card className="p-4 md:p-[1.375rem]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="mb-1.5 text-h1 font-black">
              저장 채널 <small className="text-caption text-sub">레퍼런스로 추적하는 채널</small>
            </h1>
            <p className="text-sub">여기 저장한 채널의 최근 쇼츠를 레이더에 모아 보여줘요.</p>
          </div>
          <Link href="/radar" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cta px-[1.125rem] text-sm font-black text-bg hover:brightness-[1.08]">
            레이더에서 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="저장 채널" value={`${list.length} / 50`} />
          <Kpi label="추적 중" value={list.length - paused} accent />
          <Kpi label="일시 중지" value={paused} />
          <Kpi label="오늘 YouTube 사용량" value={`${(data?.usedUnits ?? 0).toLocaleString("en-US")} / 1,000`} />
        </div>
      </Card>

      <Card className={cn("p-4 md:p-[1.375rem]", empty && "border-brand")}>
        <h2 className="text-h2 font-black">
          채널 추가<small className="ml-2 text-caption font-medium text-sub">주소·@핸들</small>
        </h2>
        {empty && <p className="mt-1.5 text-sm text-brand">아직 저장한 채널이 없어요. 참고할 채널을 먼저 추가해 보세요.</p>}
        <form
          className="mt-3 flex flex-wrap items-center gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding) void addChannel();
          }}
        >
          <input
            aria-label="채널 주소 또는 핸들"
            aria-invalid={!!addErr || undefined}
            className={cn(
              "min-h-[2.625rem] min-w-0 flex-[1_1_15rem] rounded-[0.625rem] border bg-card px-3 text-sm text-text",
              addErr ? "border-danger" : empty ? "border-brand" : "border-line",
            )}
            placeholder="https://youtube.com/@handle 또는 @handle"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Btn type="submit" variant="cta" size="md" className="min-h-10 px-[1.125rem] text-sm" loading={adding} disabled={!data}>
            {adding ? "확인 중…" : "+ 채널 추가"}
          </Btn>
        </form>
        {adding && (
          <div className="mx-auto mb-1.5 mt-3.5 w-full max-w-[26.25rem]">
            <div className="mb-1.5 flex justify-between text-xs text-sub">
              <span>채널 정보 확인 중…</span>
              <b className="font-black text-brand">{add}%</b>
            </div>
            <Progress value={add} label="채널 정보 확인 진행률" />
          </div>
        )}
        {addErr && (
          <div className="mt-3">
            <Message title="채널을 추가하지 못했어요" code={addErr.code}>
              {addErr.message}
              {addErr.resetAt && ` 다음 초기화: ${fmtReset(addErr.resetAt)}`}
            </Message>
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-[1.375rem]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-h2 font-black">
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
        {!data ? (
          <div className="flex flex-col gap-2.5">
            <Message title="채널 목록을 불러오지 못했어요" code="UPSTREAM_ERROR">잠시 후 다시 시도해 주세요.</Message>
            <Btn className="self-start" loading={retrying} onClick={() => startRetry(() => router.refresh())}>다시 시도</Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((c) => (
              <div key={c.id} className={cn("flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3", !c.tracking && "opacity-55")}>
                <div className="min-w-0 flex-[1_1_11.25rem]">
                  <b className="block">{name(c)}</b>
                  <span className="block text-caption text-sub">
                    구독자 {fmtCount(c.subs)} · 평균 조회 준비 중 · 마지막 스캔 {c.lastScanLabel ?? "아직 없음"}
                  </span>
                </div>
                <Tag className="self-center">{channelGroupNames[c.grp]}</Tag>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.tracking}
                    aria-label="추적 켜기/끄기"
                    disabled={busy === c.id}
                    onClick={() => flip(c)}
                    className={cn("relative h-6 w-[2.625rem] flex-none cursor-pointer rounded-full border-0 p-0 transition-colors after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] disabled:cursor-wait", c.tracking ? "bg-ok" : "bg-[var(--switch-off)]")}
                  >
                    <i className={cn("absolute top-[0.1875rem] size-[1.125rem] rounded-full bg-text transition-[left] duration-200", c.tracking ? "left-[1.3125rem]" : "left-[0.1875rem]")} />
                  </button>
                  <Btn size="sm" className="border-0 text-[var(--tag-bad-fg)]" loading={busy === c.id} onClick={() => remove(c)}>삭제</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        {data && rows.length === 0 && (
          <p className="text-caption text-sub">{list.length === 0 ? "저장한 채널이 없어요. 위에서 채널을 추가해 주세요." : "조건에 맞는 채널이 없어요."}</p>
        )}
      </Card>
      <YtNotice />
      {toast}
    </main>
  );
}
