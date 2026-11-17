"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  commentAvatar,
  commentSkins,
  mockEdit,
  mockSceneArt,
  sceneInk,
  titleColors,
  videoInk,
  type EditorStyle,
  type TitleStyle,
} from "@/mocks/editor";
import type { Editor } from "./use-editor";

/** 미리보기 좌표: 휴대폰 화면 폭 300 기준 수치를 cqw(화면 폭 %)로 바꾼다 → 구간마다 폰 크기가 달라도 비율 유지 */
const u = (n: number) => `${(n / 3).toFixed(3)}cqw`;

const STROKE = (w: number, color: string) =>
  [`-${u(w)} -${u(w)}`, `${u(w)} -${u(w)}`, `-${u(w)} ${u(w)}`, `${u(w)} ${u(w)}`].map((p) => `${p} 0 ${color}`).join(", ");

const DROP = `0 ${u(3)} 0 color-mix(in srgb, black 55%, transparent)`;

function family(name: string) {
  return `'${name}', 'Noto Sans JP', 'Noto Sans KR', sans-serif`;
}

/** 제목 2줄 스타일(시안 renderVals와 같은 규칙) */
export function titleLineStyles(style: EditorStyle, hex: string, base: string): [CSSProperties, CSSProperties] {
  const fs = (style.titleSize * style.tplSize) / 100;
  const ff: CSSProperties = { fontFamily: family(style.titleFont), fontSize: u(fs) };
  let l1: CSSProperties = { ...ff, color: base };
  let l2: CSSProperties = { ...ff, color: hex };
  const ts: TitleStyle = style.titleStyle;
  if (ts === "box") l2 = { ...ff, background: hex, color: videoInk.dark, padding: `0 ${u(6)}`, marginTop: u(2) };
  if (ts === "capsule")
    l1 = { ...ff, background: hex, color: videoInk.dark, padding: `0 ${u(12)}`, borderRadius: "999em", marginBottom: u(3) };
  if (ts === "highlight")
    l2 = { ...ff, color: base, background: `linear-gradient(transparent 55%, ${hex} 55%)`, padding: `0 ${u(4)}` };
  if (ts === "shadow") {
    l1 = { ...l1, textShadow: DROP };
    l2 = { ...l2, textShadow: DROP };
  }
  if (ts === "outline") {
    const stroke: CSSProperties = { WebkitTextStroke: `${u(1.5)} ${videoInk.dark}`, paintOrder: "stroke fill" };
    l1 = { ...ff, color: videoInk.white, ...stroke };
    l2 = { ...ff, color: hex, ...stroke };
  }
  if (ts === "label")
    l1 = { ...ff, background: videoInk.label, color: videoInk.white, padding: `0 ${u(8)}`, fontSize: u(fs * 0.7), marginBottom: u(4) };
  return [l1, l2];
}

function captionStyle(style: EditorStyle): CSSProperties {
  const ff: CSSProperties = { fontFamily: family(style.subFont), fontSize: u(style.subSize) };
  switch (style.subStyle) {
    case "box":
      return { ...ff, color: videoInk.white, background: "color-mix(in srgb, black 78%, transparent)", padding: `${u(2)} ${u(8)}`, borderRadius: u(4) };
    case "yellow":
      return { ...ff, color: titleColors[0].hex, textShadow: STROKE(1.5, videoInk.black) };
    case "pop":
      return { ...ff, color: videoInk.dark, background: videoInk.white, padding: `${u(2)} ${u(10)}`, borderRadius: "999em", boxShadow: `0 ${u(3)} 0 ${videoInk.dark}` };
    default:
      return { ...ff, color: videoInk.white, textShadow: STROKE(1.5, videoInk.black) };
  }
}

/** 장면 그림(실제 영상 자리) */
function Scene({ art }: { art: (typeof mockSceneArt)[number] }) {
  const k = sceneInk;
  return (
    <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="block size-full">
      <rect width="300" height="300" fill={art.bg} />
      <rect y="230" width="300" height="70" fill={art.floor} />
      <polygon points="150,30 95,120 205,120" fill={k.tree[0]} />
      <polygon points="150,80 80,180 220,180" fill={k.tree[1]} />
      <polygon points="150,130 65,235 235,235" fill={k.tree[2]} />
      <rect x="140" y="232" width="20" height="18" fill={k.trunk} />
      <circle cx="120" cy="150" r="7" fill={k.balls[0]} />
      <circle cx="180" cy="200" r="7" fill={k.balls[1]} />
      <circle cx="160" cy="105" r="6" fill={k.balls[2]} />
      <circle cx="110" cy="215" r="7" fill={k.balls[3]} />
      <rect x="40" y="246" width="220" height="26" rx="6" fill={k.mat} opacity={art.mat} />
      <g opacity={art.house}>
        <rect x="180" y="200" width="70" height="52" rx="8" fill={k.house} />
        <ellipse cx="215" cy="230" rx="20" ry="16" fill={k.door} />
      </g>
      <g transform={`translate(${art.catX} ${art.catY})`}>
        <ellipse cx="0" cy="18" rx="22" ry="16" fill={k.cat} />
        <circle cx="0" cy="-4" r="14" fill={k.cat} />
        <polygon points="-13,-10 -9,-26 -2,-14" fill={k.cat} />
        <polygon points="13,-10 9,-26 2,-14" fill={k.cat} />
        <circle cx="-5" cy="-5" r="2.4" fill={k.eye} />
        <circle cx="5" cy="-5" r="2.4" fill={k.eye} />
        <path d="M20 26 Q34 22 30 6" stroke={k.cat} strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 자막 등장 효과 키프레임(미리보기 전용) */
const FX_CSS =
  "@keyframes ed-popin{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}" +
  "@keyframes ed-typein{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}";

/** 9:16 미리보기 + 컷 진행바. Remotion 도입 전 정적/CSS 미리보기 */
export function Preview({ ed }: { ed: Editor }) {
  const { st, actions, derived } = ed;
  const s = st.style;
  const tpl = s.template;
  const whiteBand = tpl === "topWhite" || tpl === "bothWhite" || tpl === "insta";
  const hasBottom = tpl === "bothWhite" || tpl === "bothBlack" || tpl === "insta";
  const base = whiteBand ? videoInk.dark : videoInk.white;
  const bandBg = whiteBand ? videoInk.white : videoInk.black;
  const hex = titleColors[s.colorIdx].hex;
  const [l1, l2] = titleLineStyles(s, hex, base);
  const botSize = hasBottom ? s.botSize : 0;
  const ci = derived.cutIdx;
  const art = mockSceneArt[ci] ?? mockSceneArt[0];
  const cutZoom = mockEdit.ko.scripts[0].cuts[ci]?.zoom ?? 1;
  const z = (s.zoom / 100) * cutZoom;
  const caption = derived.script?.cuts[ci]?.caption ?? "";
  const comment = derived.commentFor(ci);
  const skin = commentSkins[s.cmtStyle];
  const capPos: CSSProperties = s.subPos === "low" ? { bottom: "10%" } : s.subPos === "mid" ? { top: "46%" } : { top: "8%" };
  const fx =
    s.subFx === "bounce"
      ? "animate-[ed-popin_0.45s_ease-out_both]"
      : s.subFx === "type"
        ? "animate-[ed-typein_0.8s_steps(14)_both]"
        : "";

  return (
    <div>
      <style href="editor-preview-fx" precedence="default">
        {FX_CSS}
      </style>
      <div
        className="@container relative mx-auto box-content h-[30rem] w-[16.875rem] overflow-hidden rounded-[1.375rem] border-[0.375rem] border-card bg-bg md:h-[33.3125rem] md:w-[18.75rem]"
        aria-label="9:16 미리보기"
        role="group"
      >
        {/* 상단 띠 + 제목 */}
        <div
          className="absolute inset-x-0 flex flex-col items-center justify-center text-center leading-[1.22] font-black"
          style={{ top: `${s.tplMove}%`, height: `${s.topSize}%`, background: bandBg, padding: `${u(6)} ${u(12)}` }}
        >
          <span style={l1}>{derived.title.line1}</span>
          <span style={l2}>{derived.title.line2}</span>
        </div>
        {/* 영상 영역 */}
        <div
          className="absolute inset-x-0 overflow-hidden"
          style={{
            top: `${s.topSize + s.tplMove}%`,
            bottom: `${botSize}%`,
            ...(tpl === "insta" ? { left: u(12), right: u(12), borderRadius: u(10) } : {}),
          }}
        >
          <div
            className="absolute inset-0 transition-transform duration-400"
            style={{ transform: `translateY(${s.videoY}%) scale(${z})`, transformOrigin: "50% 60%" }}
          >
            <Scene art={art} />
          </div>
          {derived.edit.mosaic.map((m) =>
            s.mosaic[m.kind] ? (
              <span
                key={m.kind}
                className={cn("absolute z-2 bg-sub/35 backdrop-blur-sm", m.kind === "face" ? "rounded-full" : "rounded-sm")}
                style={{ left: `${m.box[0] * 100}%`, top: `${m.box[1] * 100}%`, width: `${m.box[2] * 100}%`, height: `${m.box[3] * 100}%` }}
              />
            ) : null,
          )}
          {s.cmtOn && comment && (
            <div
              className="absolute z-4 flex items-start"
              style={{
                left: u(14),
                right: u(14),
                top: u(14),
                gap: u(8),
                padding: `${u(8)} ${u(10)}`,
                fontSize: u(11),
                lineHeight: 1.35,
                background: skin.bg,
                color: skin.fg,
                border: `0.0625rem solid ${skin.border}`,
                borderRadius: skin.round,
                boxShadow: `0 ${u(6)} ${u(18)} color-mix(in srgb, black 35%, transparent)`,
              }}
            >
              <span className="flex-none rounded-full" style={{ width: u(22), height: u(22), background: commentAvatar }} />
              <div>
                <div className="font-bold opacity-75" style={{ fontSize: u(10) }}>
                  {skin.name}
                </div>
                <div>{comment}</div>
              </div>
            </div>
          )}
          <div className="absolute z-3 text-center leading-[1.3] font-bold" style={{ left: u(8), right: u(8), ...capPos }}>
            <span key={`${st.cur}-${s.subFx}-${caption}`} className={cn("inline-block", fx)} style={captionStyle(s)}>
              {caption}
            </span>
          </div>
        </div>
        {hasBottom && <div className="absolute inset-x-0 bottom-0" style={{ height: `${s.botSize}%`, background: bandBg }} />}
        {st.playing ? (
          <button type="button" onClick={actions.stop} aria-label="일시정지" className="absolute inset-0 z-5 cursor-pointer opacity-0" />
        ) : (
          <button
            type="button"
            onClick={actions.play}
            aria-label="미리보기 재생"
            className="absolute top-1/2 left-1/2 z-5 flex size-13.5 -translate-1/2 cursor-pointer items-center justify-center rounded-full bg-bg/55 text-text transition-[filter] hover:brightness-125"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5.5">
              <path d="M7 4l13 8-13 8z" />
            </svg>
          </button>
        )}
      </div>
      <div role="group" aria-label="컷 이동" className="mx-auto mt-1.5 flex w-[16.875rem] gap-1 md:w-[18.75rem]">
        {st.order.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => actions.goTo(i)}
            aria-label={`${i + 1}번 컷으로 이동`}
            aria-current={i === st.cur || undefined}
            className="h-5.5 flex-1 cursor-pointer py-[0.5625rem]"
          >
            <i className={cn("block h-1 rounded-sm", i <= st.cur ? "bg-brand" : "bg-line")} />
          </button>
        ))}
      </div>
    </div>
  );
}
