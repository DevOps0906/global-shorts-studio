"use client";

import type { ReactNode } from "react";
import { Btn } from "@/components/ui/btn";
import { Chip } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-blocks";
import { cn } from "@/lib/utils";
import { editCost, mockSceneArt, voices, type VoiceId } from "@/mocks/editor";
import { Box, CHIP_SM, LinkBtn, Muted, RingBtn, Select, Toggle } from "./bits";
import type { Editor } from "./use-editor";

const IB = "flex cursor-pointer items-center justify-center rounded-full p-0 transition-[transform,filter] duration-150 hover:brightness-125 active:scale-[0.96]";

function SectionHead({ title, aside, className }: { title: ReactNode; aside?: string; className?: string }) {
  return (
    <div className={cn("mt-4 mb-1.5 flex items-baseline justify-between gap-2", className)}>
      <h3 className="text-sm font-bold">{title}</h3>
      {aside && <span className="text-xs text-sub">{aside}</span>}
    </div>
  );
}

/** 우측: 제목 3안·대본 3안·컷 카드 (PLAN 2-4, 4-4) */
export function ScriptPanel({ ed }: { ed: Editor }) {
  const { st, actions, derived } = ed;
  const { titles, title, script } = derived;

  if (!st.rightOpen) {
    return (
      <Box>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">제목 · 대본</h2>
          <RingBtn onClick={() => actions.set({ rightOpen: true })} aria-expanded={false}>
            펼치기
          </RingBtn>
        </div>
      </Box>
    );
  }

  const isJa = st.lang === "ja";
  const langBtn = (on: boolean) =>
    cn("min-h-[2.125rem] cursor-pointer rounded-[0.5rem] text-[length:var(--text-caption)] font-bold", on ? "bg-card2 text-text" : "bg-transparent text-sub");

  return (
    <Box>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">제목 · 대본</h2>
        <LinkBtn onClick={() => actions.set({ rightOpen: false })} aria-expanded>
          접기
        </LinkBtn>
      </div>
      <div role="group" aria-label="언어" className="mb-3 grid grid-cols-2 gap-1 rounded-[0.625rem] bg-bg p-1">
        <button type="button" aria-pressed={!isJa} className={langBtn(!isJa)} onClick={() => actions.set({ lang: "ko" })}>
          한국어
        </button>
        <button type="button" aria-pressed={isJa} className={langBtn(isJa)} onClick={() => actions.set({ lang: "ja" })}>
          일본어판
          <em className="ml-1 rounded bg-pink px-1 py-px text-micro text-text not-italic">NEW</em>
        </button>
      </div>
      {isJa && (
        <Muted className="-mt-1 mb-2.5">제목·자막·목소리만 일본 쇼츠 화법으로 다시 썼어요. 스타일과 컷은 한국어판과 같아요.</Muted>
      )}

      <SectionHead title="제목" className="mt-1" />
      {titles.slice(0, st.moreTitles ? 5 : 3).map((t, i) => {
        const on = st.titleIdx === i;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            onClick={() => actions.touch({ titleIdx: i })}
            className={cn(
              "mb-2 block w-full cursor-pointer rounded-xl border-[0.09375rem] bg-card px-3.5 py-3 text-left transition-[transform,filter,border-color] duration-150 hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
              on ? "border-brand bg-brand/5" : "border-transparent",
            )}
          >
            <b className="block text-sm leading-snug font-black">
              {t.line1} <i className="text-brand not-italic">{t.line2}</i>
            </b>
            <small className="mt-0.5 block text-xs text-sub">{t.reason}</small>
          </button>
        );
      })}
      <LinkBtn onClick={() => actions.set({ moreTitles: !st.moreTitles })}>{st.moreTitles ? "제목 접기" : "다른 제목 더 보기"}</LinkBtn>

      <SectionHead title="고른 제목 고치기" />
      <label className="mt-1.5 grid grid-cols-[3.875rem_minmax(0,1fr)] items-center gap-2 rounded-[0.625rem] bg-card px-2.5 py-1.5 text-xs text-sub">
        첫 줄
        <input
          value={title.line1}
          onChange={(e) => actions.setTitle("line1", e.target.value)}
          aria-label="제목 첫 줄"
          className="min-h-8 w-full rounded-md bg-bg px-2 text-caption text-text"
        />
      </label>
      <label className="mt-1.5 grid grid-cols-[3.875rem_minmax(0,1fr)] items-center gap-2 rounded-[0.625rem] bg-card px-2.5 py-1.5 text-xs text-sub">
        <span>
          둘째 줄<em className="ml-1 text-2xs text-brand not-italic">강조색</em>
        </span>
        <input
          value={title.line2}
          onChange={(e) => actions.setTitle("line2", e.target.value)}
          aria-label="제목 둘째 줄"
          className="min-h-8 w-full rounded-md bg-bg px-2 text-caption text-text"
        />
      </label>

      <SectionHead
        title={
          <>
            대본{" "}
            <span className="text-xs text-sub">
              {derived.cutCount}컷 · {derived.dur}초
            </span>
          </>
        }
        aside={`목소리 ${st.voiceOn ? derived.cutCount : 0}/${derived.cutCount}줄`}
      />

      {derived.edit.scripts.length === 0 ? (
        <div className="rounded-xl bg-card p-3.5">
          <EmptyState
            message="대본 후보가 없어요. 다시 만들어 볼까요?"
            action={
              <Btn variant="cta" onClick={actions.regenScripts} loading={!!st.job}>
                다시 생성 · 크레딧 {editCost.reorg}
              </Btn>
            }
          />
        </div>
      ) : (
        <>
          <Muted className="mt-0 mb-2">대본 후보 바꿔도 고친 자막은 후보마다 남아 있어요</Muted>
          <div className="flex flex-wrap gap-1.5">
            {derived.edit.scripts.map((sc, i) => (
              <Chip key={i} selected={st.scriptIdx === i} className={CHIP_SM} onClick={() => actions.touch({ scriptIdx: i })}>
                {sc.label}
              </Chip>
            ))}
          </div>
          <div className="my-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2.5">
            <b className="mr-1.5 text-caption">전체 원본 소리</b>
            {[true, false].map((v) => (
              <Chip
                key={String(v)}
                selected={st.orig.every((x) => x === v)}
                className={CHIP_SM}
                onClick={() => actions.setAllOrig(v)}
              >
                {v ? "ON" : "OFF"}
              </Chip>
            ))}
            <Muted className="mt-0">아래에서 컷마다 원본 소리를 고를 수 있어요.</Muted>
          </div>

          <ol>
            {st.order.map((ci, pos) => {
              const cut = script?.cuts[ci];
              if (!cut) return null;
              const on = pos === st.cur;
              return (
                <li
                  key={ci}
                  className={cn(
                    "mb-2 grid grid-cols-[1.125rem_2.75rem_minmax(0,1fr)_1.875rem] items-start gap-2 rounded-xl border-[0.09375rem] bg-card p-2.5",
                    on ? "border-brand" : "border-transparent",
                  )}
                >
                  <span className="pt-1.5 text-center text-caption text-sub">{pos + 1}</span>
                  <span className="aspect-[9/16] w-11 rounded-md" style={{ background: mockSceneArt[ci].bg }} />
                  <div className="min-w-0">
                    <input
                      value={cut.caption}
                      onChange={(e) => actions.setCaption(ci, e.target.value)}
                      aria-label={`${pos + 1}번 컷 자막`}
                      className="min-h-8 w-full rounded-md bg-bg px-2 text-caption font-bold text-text"
                    />
                    <p className="my-1.5 text-xs text-sub">화면: {cut.scene}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Toggle on={st.orig[ci]} onClick={() => actions.toggleAt("orig", ci)}>
                        원본 소리 {st.orig[ci] ? "ON" : "OFF"}
                      </Toggle>
                      <Select
                        className="min-h-[1.875rem] w-auto"
                        value={st.cutVoice[ci]}
                        onChange={(e) => actions.setCutVoice(ci, e.target.value as VoiceId)}
                        aria-label="컷 목소리"
                      >
                        {voices
                          .filter((v) => v.rec)
                          .map((v, i) => (
                            <option key={v.id} value={v.id}>
                              {i === 0 ? `기본 (${v.name})` : v.name}
                            </option>
                          ))}
                      </Select>
                      {cut.zoom > 1 && (
                        <span className="rounded bg-brand px-1.5 py-px text-2xs font-bold text-bg">대상 확대 {cut.zoom}배</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button type="button" onClick={() => actions.goTo(pos)} aria-label="이 컷 미리보기" className={cn(IB, "size-7.5 text-brand")}>
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3.5">
                        <path d="M7 4l13 8-13 8z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => actions.toggleAt("ok", ci)}
                      aria-label="컷 확정"
                      aria-pressed={st.ok[ci]}
                      className={cn(IB, "size-7.5", st.ok[ci] ? "bg-ok text-bg" : "bg-ok/15 text-ok")}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className="size-3.5">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => actions.moveCut(pos, -1)} aria-label="위로" className={cn(IB, "relative h-5.5 w-6 text-sub after:absolute after:-inset-2.5 after:content-['']")}>
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3">
                        <path d="M12 6l7 10H5z" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => actions.moveCut(pos, 1)} aria-label="아래로" className={cn(IB, "relative h-5.5 w-6 text-sub after:absolute after:-inset-2.5 after:content-['']")}>
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3">
                        <path d="M12 18L5 8h14z" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Box>
  );
}
