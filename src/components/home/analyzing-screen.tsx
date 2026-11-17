"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Hero } from "@/components/home/hero";
import { Progress } from "@/components/ui/progress";
import { HOT, LOGS, STEP_D, STEP_L, STEP_T } from "@/mocks/home";
import { cn } from "@/lib/utils";

export function AnalyzingScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const src = HOT.find((h) => h.id === params.get("src"));
  const [done, setDone] = useState(0);
  const total = LOGS.length;
  const finished = done >= total;

  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => setDone((d) => d + 1), 800);
    return () => clearTimeout(t);
  }, [done, finished]);

  const curG = finished ? 3 : LOGS[done].g;
  const pct = finished ? 100 : Math.max(5, Math.round((done / total) * 100));
  const eta = finished ? "완료" : `남은 시간 약 ${Math.max(1, Math.round((total - done) * 0.8))}초`;

  return (
    <main className="mx-auto w-full max-w-[60rem] px-5">
      <Hero className="pt-7" />
      <div className="pt-6 pb-20 text-center">
        {!finished && (
          <div
            aria-hidden
            className="mx-auto size-[2.125rem] animate-spin rounded-full border-[0.1875rem] border-line border-t-brand border-r-pink"
          />
        )}
        <p className="mt-3.5 text-caption font-bold text-brand">{curG + 1} / 4 단계</p>
        <h2 className="my-1 text-md font-bold md:text-lg">{finished ? "편집 준비 완료" : STEP_T[curG]}</h2>
        <p className="text-sm text-sub">{finished ? "제목 3안과 대본 3안이 준비됐어요." : STEP_D[curG]}</p>
        <div className="mx-auto mt-3.5 mb-1.5 w-full max-w-[26.25rem] text-left">
          <div className="mb-1.5 flex justify-between text-xs text-sub">
            <span>전체 진행률</span>
            <b className="font-black text-brand">{pct}%</b>
            <span>{eta}</span>
          </div>
          <Progress value={pct} label="전체 진행률" />
        </div>
        <div className="mt-7 mb-5 flex flex-wrap justify-center gap-[1.375rem] md:gap-14">
          {STEP_L.map((l, i) => {
            const isDone = finished || i < curG;
            const cur = !isDone && i === curG;
            return (
              <div key={l} className={cn("flex flex-col items-center gap-1.5 text-xs text-sub", cur && "font-bold text-brand")}>
                <i
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-[0.09375rem] border-line bg-card text-caption font-bold not-italic text-sub",
                    isDone && "border-brand/20 bg-[var(--tag-run-bg)] text-brand",
                    cur && "border-brand text-brand",
                  )}
                >
                  {isDone ? "✓" : i + 1}
                </i>
                {l}
              </div>
            );
          })}
        </div>
        <div role="status" className="mx-auto flex max-w-[26.25rem] flex-col gap-1.5 text-left">
          {LOGS.slice(0, Math.min(total, done + 1)).map((l, i) => {
            const ok = i < done;
            return (
              <div key={l.label} className={cn("flex justify-between text-caption", ok ? "text-text/85" : "text-text")}>
                <span>
                  {ok ? "✓ · " : "진행 중 · "}
                  {l.label}
                </span>
                <span>{ok ? l.sec : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-[1.375rem] text-caption text-text/85">
          {src ? `${src.channel} — ${src.title}.mp4` : "xmas_cat.mp4"}
        </p>
        <p className="mt-2 text-caption text-sub">완성 후 컷·자막·스타일을 자유롭게 고칠 수 있어요.</p>
        <span className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-ok/10 px-3 py-1.5 text-caption text-[var(--tag-ok-fg)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 12l5 5 9-10" />
          </svg>
          창을 닫아도 서버에서 계속 진행돼요 · 끝나면 텔레그램으로 알려드려요
        </span>
        <div>
          {finished && (
            <button
              type="button"
              onClick={() => router.push("/studio/demo")}
              className="mt-[1.375rem] inline-flex min-h-[2.875rem] cursor-pointer items-center justify-center gap-2 rounded-xl bg-cta px-[1.625rem] text-base font-black text-bg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-[1.08] active:scale-[0.96]"
            >
              편집 화면 열기 →
            </button>
          )}
        </div>
        <div>
          <Link
            href="/studio/new"
            className="mt-[1.125rem] inline-flex min-h-10 items-center rounded-[0.625rem] border border-line px-4 text-sm font-bold"
          >
            취소 · 영상 다시 선택
          </Link>
        </div>
      </div>
    </main>
  );
}
