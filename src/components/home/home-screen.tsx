"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Hero } from "@/components/home/hero";
import { EmptyState, Message, Skeleton } from "@/components/ui/state-blocks";
import { fmtCount, fmtDuration } from "@/lib/radar-format";
import { JOBS, TYPE_CARDS } from "@/mocks/home";
import type { RadarItem } from "@/server/radar";
import { cn } from "@/lib/utils";

const mini =
  "inline-flex min-h-8 items-center justify-center rounded-lg bg-card2 text-xs font-bold text-text transition-[filter,transform] hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]";

/** 오늘의 소재: 최근 3일 쇼츠 조회수 상위 5개(원본 지표). null이면 이 영역만 오류(13-1) */
export type HomeHot = { items: RadarItem[]; channelCount: number; lastScanLabel: string | null } | null;

/** 로딩 스켈레톤(13-1): 유형 카드 2개 + 소재 카드 격자 모양 */
export function HomeSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-[60rem] px-5 pb-20">
      <Skeleton className="mx-auto mt-10 h-8 w-64" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-[13rem] w-full rounded-[1.125rem]" />
        <Skeleton className="h-[13rem] w-full rounded-[1.125rem]" />
      </div>
      <Skeleton className="mt-10 h-6 w-72" />
      <div className="mt-3 flex gap-2.5 overflow-hidden md:grid md:grid-cols-3 md:gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="aspect-[9/16] w-[9.375rem] flex-none md:w-full" />
        ))}
      </div>
    </main>
  );
}

export function HomeScreen({ hot }: { hot: HomeHot }) {
  const [jobs, setJobs] = useState(JOBS);

  return (
    <main className="mx-auto w-full max-w-[60rem] px-5 pb-20">
      <Hero>
        <p className="mt-2.5 text-base text-sub">떡상 소재를 찾고, 원본 하나로 제목·대본·자막·컷 편집까지</p>
      </Hero>
      <h1 className="mt-8 mb-4 text-center text-base font-bold md:text-md">어떤 쇼츠를 만들까요?</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TYPE_CARDS.map((t) => (
          <Link
            key={t.type}
            href={`/studio/new?type=${t.type}`}
            className="flex items-center gap-[1.125rem] rounded-[1.125rem] border-[0.09375rem] border-line bg-panel p-[1.125rem] text-left transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-[0.1875rem] hover:border-brand motion-reduce:hover:translate-y-0 active:scale-[0.96]"
          >
            <span aria-hidden className="flex aspect-[9/16] w-28 flex-none flex-col overflow-hidden rounded-xl bg-black">
              <span className="px-1.5 pt-2 pb-1.5 text-center text-xs leading-tight font-black">
                {t.lines[0]}
                <br />
                {t.mark ? (
                  <mark className="bg-brand px-[0.1875rem] text-bg">{t.lines[1]}</mark>
                ) : (
                  <span className="text-brand">{t.lines[1]}</span>
                )}
              </span>
              <span className="flex-1" style={{ background: t.bg }} />
            </span>
            <span>
              <span className="mb-1 block text-md font-bold md:text-lg">{t.name}</span>
              <strong className="mb-2 block text-sm">{t.sub}</strong>
              <span className="text-caption text-sub">{t.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="hot-h">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="hot-h" className="text-h2 font-bold">
            레이더가 찾은 오늘의 떡상 소재
            {hot && (
              <small className="ml-1.5 text-caption font-medium text-sub">
                저장 채널 {hot.channelCount}개{hot.lastScanLabel ? ` · ${hot.lastScanLabel} 스캔` : ""}
              </small>
            )}
          </h2>
          <Link href="/radar" className="text-sm font-medium text-brand">
            전체 보기 →
          </Link>
        </div>
        {!hot ? (
          <Message title="레이더 결과를 불러오지 못했어요" code="UPSTREAM_ERROR">잠시 후 새로고침해 주세요.</Message>
        ) : hot.items.length === 0 ? (
          <EmptyState
            message={hot.channelCount === 0 ? "저장 채널이 없어 소재를 찾지 못했어요." : "최근 3일 안에 올라온 소재가 없어요. 레이더에서 추적을 시작해 보세요."}
            action={
              <Link href={hot.channelCount === 0 ? "/channels" : "/radar"} className={cn(mini, "px-3 text-sm")}>
                {hot.channelCount === 0 ? "저장 채널 추가" : "레이더로 가기"}
              </Link>
            }
          />
        ) : (
        <div className="flex gap-2.5 overflow-x-auto md:grid md:grid-cols-3 md:gap-3 md:overflow-visible xl:grid-cols-5">
          {hot.items.map((h) => (
            <Card
              key={h.id}
              className="flex w-[9.375rem] flex-none flex-col gap-2 rounded-[0.875rem] p-1.5 md:p-1.5 transition-[transform,box-shadow] duration-150 hover:-translate-y-[0.1875rem] md:w-auto motion-reduce:hover:translate-y-0"
            >
              <div
                className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[0.625rem] bg-card2 bg-cover bg-center"
                style={h.thumbnailUrl ? { backgroundImage: `url("${h.thumbnailUrl}")` } : undefined}
              >
                {h.isNew && (
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-pink px-1.5 py-0.5 text-2xs font-bold text-text">
                    NEW
                  </span>
                )}
                <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-[0.1875rem] rounded-md bg-bg/70 px-1.5 py-0.5 text-xs font-bold text-text">
                  {fmtDuration(h.durationS)}
                </span>
                <a
                  href={`https://www.youtube.com/shorts/${h.ytVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`YouTube에서 보기: ${h.title}`}
                  className="flex size-[1.875rem] items-center justify-center rounded-full bg-text/90 text-bg after:absolute after:inset-0 after:content-['']"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M7 4l13 8-13 8z" />
                  </svg>
                </a>
              </div>
              <h4 className="mx-0.5 line-clamp-2 font-bold min-h-[2.125rem] text-caption leading-[1.4]">{h.title}</h4>
              <p className="mx-0.5 text-xs text-sub">
                {h.channel} · {fmtCount(h.views)} · {h.hours}시간
              </p>
              <div className="grid grid-cols-2 gap-1">
                <Link href={`/studio/new?type=video&src=${h.id}`} className={mini}>
                  영상형으로
                </Link>
                <Link href={`/studio/new?type=script&src=${h.id}`} className={mini}>
                  대본형으로
                </Link>
              </div>
            </Card>
          ))}
        </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="job-h">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="job-h" className="text-h2 font-bold">
            내 작업<small className="ml-1.5 text-caption font-medium text-sub">Starter 플랜 · 최근 30개 보관</small>
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
              <div className="min-w-0">
                <b className="block text-sm">
                  {j.title}
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-2 py-0.5 text-xs font-bold",
                      j.uploaded ? "bg-ok/15 text-[var(--tag-ok-fg)]" : "bg-card2 text-sub",
                    )}
                  >
                    {j.status}
                  </span>
                </b>
                <span className="text-xs text-sub">{j.meta}</span>
              </div>
              <div className="flex flex-none items-center gap-1">
                <Link href="/studio/demo" className="inline-flex min-h-9 items-center px-1.5 text-caption text-sub">
                  열기
                </Link>
                <button
                  type="button"
                  className="min-h-9 cursor-pointer px-1.5 text-caption text-sub"
                  onClick={() => setJobs((cur) => cur.filter((x) => x.id !== j.id))}
                >
                  지우기
                </button>
              </div>
            </div>
          ))}
        </div>
        {jobs.length === 0 && (
          <p className="mt-2 text-caption text-sub">아직 작업이 없어요. 위에서 유형을 고르면 시작돼요.</p>
        )}
      </section>
    </main>
  );
}
