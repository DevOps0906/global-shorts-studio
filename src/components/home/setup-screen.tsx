"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Hero } from "@/components/home/hero";
import { Chip } from "@/components/ui/card";
import { HOT, LANG_CHIPS, LEN_CHIPS, PRESET_CHIPS, SOURCE_COMMENTS } from "@/mocks/home";
import { cn } from "@/lib/utils";

const lbl = "mt-[1.375rem] mb-2.5 block text-sm font-bold";

export function SetupScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const type = params.get("type") === "script" ? "script" : "video";
  const src = HOT.find((h) => h.id === params.get("src"));

  const [len, setLen] = useState("keep");
  const [lang, setLang] = useState("ko");
  const [preset, setPreset] = useState("brand");
  const [comments, setComments] = useState(src ? SOURCE_COMMENTS : "");
  const [rights, setRights] = useState(false);
  const [warn, setWarn] = useState(false);

  const start = () => {
    if (!rights) {
      setWarn(true);
      return;
    }
    router.push(`/studio/demo/analyzing${src ? `?src=${src.id}` : ""}`);
  };

  return (
    <main className="mx-auto w-full max-w-[60rem] px-5">
      <Hero className="pt-7" />
      <div className="mx-auto max-w-[32.5rem] pt-2 pb-20">
        <div className="text-center">
          <Link href="/" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-sub">
            ← {type === "video" ? "영상형" : "대본형"} · 유형 바꾸기
          </Link>
        </div>
        <p className="mt-2 text-center text-caption text-sub">
          길이·언어를 고른 뒤 맨 아래에서 영상을 고르세요. PC는 화면 어디에나 끌어다 놓아도 바로 시작해요.
        </p>
        {src && (
          <div className="mt-[1.125rem] flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
            <span className="aspect-[9/16] w-11 flex-none rounded-md" style={{ background: src.bg }} />
            <div>
              <b className="block text-sm">레이더 소재 · {src.title}</b>
              <span className="text-xs text-sub">
                {src.channel} · {src.views} · 떡상 {src.mult} · 원본 댓글 20개를 불러왔어요
              </span>
            </div>
          </div>
        )}

        <span className={lbl}>길이</span>
        <div className="flex flex-wrap gap-2">
          {LEN_CHIPS.map((c) => (
            <Chip key={c.v} selected={len === c.v} onClick={() => setLen(c.v)} className="min-h-10 px-4">
              {c.l} <small className="text-xs font-medium text-sub">{c.s}</small>
            </Chip>
          ))}
        </div>
        <span className={lbl}>언어</span>
        <div className="flex flex-wrap gap-2">
          {LANG_CHIPS.map((c) => (
            <Chip key={c.v} selected={lang === c.v} onClick={() => setLang(c.v)} className="min-h-10 px-4">
              {c.l}
              {c.n && <span className="rounded-[0.3125rem] bg-pink px-[0.3125rem] py-px text-2xs text-text">NEW</span>}
            </Chip>
          ))}
        </div>
        <label htmlFor="cmt" className={lbl}>
          참고할 원본 댓글 <small className="font-medium text-sub">(선택)</small>
          {src && (
            <span className="ml-2 inline-block rounded-full border border-brand px-2 py-px align-middle text-xs font-bold text-brand">
              레이더에서 자동 채움
            </span>
          )}
        </label>
        <textarea
          id="cmt"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="원본 영상의 댓글을 붙여넣으면 대본·댓글 반응에 참고해요"
          className="min-h-[4.75rem] w-full resize-y rounded-xl border border-line bg-panel p-3 text-sm text-text placeholder:text-sub"
        />
        <p className="mt-2 text-caption text-sub">
          레이더 소재로 시작하면 원본 댓글을 자동으로 채워요. 직접 고치거나 지워도 돼요.
        </p>
        <span className={lbl}>
          스타일 프리셋 <small className="font-medium text-sub">(생성 후에도 바꿀 수 있어요)</small>
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_CHIPS.map((c) => (
            <Chip key={c.v} selected={preset === c.v} onClick={() => setPreset(c.v)} className="min-h-10 px-4">
              {c.l}
            </Chip>
          ))}
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-brand/20 bg-brand/5 p-3.5 text-caption">
          <input
            type="checkbox"
            checked={rights}
            onChange={() => {
              setRights(!rights);
              setWarn(false);
            }}
            className="mt-0.5 size-[1.125rem] flex-none accent-brand"
          />
          <span>
            이 영상을 편집·게시할 권리가 있어요{" "}
            <small className="mt-1 block text-caption text-sub">
              직접 촬영했거나, 원작자에게 허락을 받았거나, 라이선스가 있는 영상만 올려 주세요. 원본 출처는 작업에 기록돼요.
            </small>
          </span>
        </label>
        <button
          type="button"
          onClick={start}
          className={cn(
            "mt-5 w-full cursor-pointer rounded-2xl border-[0.09375rem] border-dashed border-line bg-panel px-4 py-10 text-center text-text transition-[transform,filter] hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
            !rights && "cursor-not-allowed opacity-55",
          )}
        >
          <span aria-hidden className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-cta text-bg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="block text-base font-bold">눌러서 원본 영상 고르기</span>
          <span className="mt-1 block text-caption text-sub">(PC는 화면 어디에나 끌어다 놓아도 돼요)</span>
          <span className="my-2.5 flex flex-wrap justify-center gap-1.5">
            {["MP4", "MOV", "WebM", "최대 3분", "최대 500MB"].map((f) => (
              <em key={f} className="rounded-md bg-card2 px-2 py-0.5 text-xs font-bold text-text not-italic">
                {f}
              </em>
            ))}
          </span>
          <span className="block text-caption text-sub">고르면 제목·대본·컷 편집까지 알아서 만들어요</span>
        </button>
        {warn && <p className="mt-2 text-center text-caption text-danger">먼저 권리 확인에 체크해 주세요.</p>}
      </div>
    </main>
  );
}
