"use client";

import type { CSSProperties, ReactNode } from "react";
import { Chip } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  fonts,
  presets,
  titleColors,
  videoInk,
  voices,
  type PresetId,
  type SfxType,
  type TitleStyle,
  type VoiceId,
} from "@/mocks/editor";
import { Box, LinkBtn, Muted, OptionChips, Q, RangeRow, RingBtn, Select, Toggle } from "./bits";
import type { Editor, ToolKey } from "./use-editor";

const ICON: Record<ToolKey, ReactNode> = {
  preset: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  template: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M6 7h12M6 17h12" />
    </>
  ),
  titleStyle: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </>
  ),
  color: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  font: <path d="M5 5h14M12 5v14M9 19h6" />,
  size: <path d="M3 6h10M8 6v12M14 11h7M17.5 11v7" />,
  sub: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 14h10M7 10h6" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9l5 3-5 3z" />
    </>
  ),
  mosaic: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 22 12a14 14 0 0 1-3 3.6M6.6 6.6A14 14 0 0 0 2 12s4 7 10 7a10 10 0 0 0 5.4-1.6" />,
  comment: <path d="M4 5h16v11H9l-5 4z" />,
  sfx: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
};

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: "preset", label: "프리셋" },
  { key: "template", label: "템플릿" },
  { key: "titleStyle", label: "제목 스타일" },
  { key: "color", label: "제목 색" },
  { key: "font", label: "글씨체" },
  { key: "size", label: "글자 크기·배치" },
  { key: "sub", label: "자막 스타일·효과" },
  { key: "video", label: "영상 크기·위치" },
  { key: "mosaic", label: "모자이크" },
  { key: "comment", label: "댓글 반응" },
  { key: "sfx", label: "효과음" },
  { key: "voice", label: "목소리" },
];

const TITLE_STYLES: { value: TitleStyle; label: string }[] = [
  { value: "basic", label: "기본" },
  { value: "box", label: "박스" },
  { value: "capsule", label: "캡슐" },
  { value: "highlight", label: "형광펜" },
  { value: "shadow", label: "그림자" },
  { value: "outline", label: "테두리" },
  { value: "label", label: "라벨" },
];

/** 추천 스타일 썸네일 글자 모양(시안 styleThumbs) */
function thumbStyles(v: TitleStyle, hex: string): [CSSProperties, CSSProperties] {
  let s1: CSSProperties = { color: videoInk.white };
  let s2: CSSProperties = { color: hex };
  const drop = "0 0.125rem 0 color-mix(in srgb, white 33%, black)";
  if (v === "box") s2 = { background: hex, color: videoInk.dark };
  if (v === "capsule") s1 = { background: hex, color: videoInk.dark, borderRadius: "999em" };
  if (v === "highlight") s2 = { color: videoInk.white, background: `linear-gradient(transparent 55%, ${hex} 55%)` };
  if (v === "shadow") {
    s1 = { ...s1, textShadow: drop };
    s2 = { ...s2, textShadow: drop };
  }
  if (v === "outline") s1 = { color: videoInk.white, WebkitTextStroke: `0.0375rem ${videoInk.label}` };
  if (v === "label") s1 = { background: videoInk.label, color: videoInk.white };
  return [s1, s2];
}

function ToolBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box className="mt-3" label={title}>
      <h4 className="mb-2.5 text-caption font-bold">{title}</h4>
      {children}
    </Box>
  );
}

function ToolBody({ ed }: { ed: Editor }) {
  const { st, actions, derived } = ed;
  const s = st.style;
  const { setStyle } = actions;
  const hex = titleColors[s.colorIdx].hex;
  const hasBottom = s.template === "bothWhite" || s.template === "bothBlack" || s.template === "insta";

  switch (st.tool) {
    case "preset":
      return (
        <ToolBox title="프리셋 · 채널별 스타일 묶음">
          <OptionChips
            options={(Object.keys(presets) as PresetId[]).map((id) => ({ label: presets[id].label, value: id }))}
            value={s.preset}
            onPick={actions.pickPreset}
          />
          <Muted>템플릿·제목 스타일·색·글씨체·자막을 한 번에 바꿔요. 지금 설정을 새 프리셋으로 저장할 수 있어요.</Muted>
          <div className="mt-2">
            <Chip className="text-caption" onClick={actions.savePreset}>
              + 지금 설정을 프리셋으로 저장
            </Chip>
          </div>
        </ToolBox>
      );
    case "template":
      return (
        <ToolBox title="템플릿 종류">
          <OptionChips
            options={[
              { label: "상단만 · 흰색", value: "topWhite" },
              { label: "상단만 · 검은색", value: "topBlack" },
              { label: "상단·하단 · 흰색", value: "bothWhite" },
              { label: "상단·하단 · 검은색", value: "bothBlack" },
              { label: "인스타", value: "insta" },
            ] as const}
            value={s.template}
            onPick={(template) => setStyle({ template })}
          />
          <Muted>화면에서 띠 경계를 위아래로 끌어 조절하세요. 영상 위치·크기는 유지돼요.</Muted>
          <RangeRow id="ed-r1" label="템플릿 크기" min={80} max={130} value={s.tplSize} unit="%" onChange={(tplSize) => setStyle({ tplSize })} />
          <RangeRow id="ed-r2" label="위아래 이동" min={-10} max={10} value={s.tplMove} unit="%" onChange={(tplMove) => setStyle({ tplMove })} />
          <RangeRow id="ed-r3" label="상단 크기" min={12} max={34} value={s.topSize} unit="%" onChange={(topSize) => setStyle({ topSize })} />
          {hasBottom && (
            <RangeRow id="ed-r4" label="하단 크기" min={8} max={34} value={s.botSize} unit="%" onChange={(botSize) => setStyle({ botSize })} />
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Chip className="text-caption" onClick={() => setStyle({ tplSize: 100, tplMove: 0, topSize: 22, botSize: 18 })}>
              템플릿 크기·위치 초기화
            </Chip>
            <label
              htmlFor="ed-tplfile"
              className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-card px-3.5 text-caption font-bold transition-[transform,filter] duration-150 hover:-translate-y-[0.0625rem] hover:brightness-[1.18]"
            >
              내 템플릿 업로드 (PNG·JPG·WebP)
            </label>
            <input
              id="ed-tplfile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                actions.set({ tplFileName: f ? `선택한 파일: ${f.name}` : "" });
              }}
            />
          </div>
          <Muted>9:16 투명 PNG를 사용하세요. 투명한 부분에 영상이 보여요. {st.tplFileName || "선택된 파일 없음"}</Muted>
        </ToolBox>
      );
    case "titleStyle":
      return (
        <ToolBox title="추천 스타일">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
            {TITLE_STYLES.map((t) => {
              const on = s.titleStyle === t.value;
              const [s1, s2] = thumbStyles(t.value, hex);
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStyle({ titleStyle: t.value })}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 text-xs transition-[transform,filter] duration-150 hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
                    on ? "font-bold text-brand" : "text-sub",
                  )}
                >
                  <span
                    className={cn(
                      "flex aspect-[9/12] w-full flex-col items-center gap-0.5 overflow-hidden rounded-lg border-[0.09375rem] bg-bg pt-2 text-micro font-black text-text",
                      on ? "border-brand" : "border-line",
                    )}
                  >
                    <i className="px-[0.1875rem] not-italic" style={s1}>
                      트리 지키는 집사
                    </i>
                    <i className="px-[0.1875rem] not-italic" style={s2}>
                      VS 고양이
                    </i>
                  </span>
                  {on && "✓ "}
                  {t.label}
                </button>
              );
            })}
          </div>
        </ToolBox>
      );
    case "color":
      return (
        <ToolBox title="제목 색">
          <div className="grid grid-cols-2 gap-2">
            {titleColors.map((c, i) => {
              const on = s.colorIdx === i;
              return (
                <button
                  key={c.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStyle({ colorIdx: i })}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-[0.09375rem] bg-bg px-1.5 pt-3 pb-2 text-xs font-bold transition-[transform,filter] duration-150 hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
                    on ? "border-brand text-brand" : "border-transparent text-sub",
                  )}
                >
                  <span className="text-center text-sm leading-tight font-black text-text">
                    <i className="rounded px-1 not-italic" style={{ background: c.hex, color: videoInk.dark }}>
                      트리 지키는 집사
                    </i>
                    <br />
                    VS 고양이
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </ToolBox>
      );
    case "font":
      return (
        <ToolBox title="글씨체">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5 text-xs text-sub">
              제목 글씨체
              <Select value={s.titleFont} onChange={(e) => setStyle({ titleFont: e.target.value })}>
                {fonts.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-sub">
              자막 글씨체
              <Select value={s.subFont} onChange={(e) => setStyle({ subFont: e.target.value })}>
                {fonts.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <Muted>일본어판에서는 같은 굵기의 일본어 글꼴로 자동 대체돼요.</Muted>
        </ToolBox>
      );
    case "size":
      return (
        <ToolBox title="글자 크기·배치">
          <RangeRow id="ed-r5" label="제목 크기" min={18} max={34} value={s.titleSize} unit="px" onChange={(titleSize) => setStyle({ titleSize })} />
          <RangeRow id="ed-r6" label="자막 크기" min={12} max={24} value={s.subSize} unit="px" onChange={(subSize) => setStyle({ subSize })} />
          <Q>자막 위치</Q>
          <OptionChips
            options={[
              { label: "아래", value: "low" },
              { label: "가운데", value: "mid" },
              { label: "위", value: "high" },
            ] as const}
            value={s.subPos}
            onPick={(subPos) => setStyle({ subPos })}
          />
        </ToolBox>
      );
    case "sub":
      return (
        <ToolBox title="자막 스타일">
          <OptionChips
            options={[
              { label: "흰 글자 + 테두리", value: "stroke" },
              { label: "검은 박스", value: "box" },
              { label: "노랑 강조", value: "yellow" },
              { label: "말풍선", value: "pop" },
            ] as const}
            value={s.subStyle}
            onPick={(subStyle) => setStyle({ subStyle })}
          />
          <Q>등장 효과</Q>
          <OptionChips
            options={[
              { label: "없음", value: "none" },
              { label: "튀어오르기", value: "bounce" },
              { label: "타자 효과", value: "type" },
            ] as const}
            value={s.subFx}
            onPick={(subFx) => setStyle({ subFx })}
          />
        </ToolBox>
      );
    case "video":
      return (
        <ToolBox title="영상 크기·위치">
          <RangeRow id="ed-r7" label="영상 확대" min={100} max={200} value={s.zoom} unit="%" onChange={(zoom) => setStyle({ zoom })} />
          <RangeRow id="ed-r8" label="위아래 위치" min={-20} max={20} value={s.videoY} unit="%" onChange={(videoY) => setStyle({ videoY })} />
          <Muted>컷별 확대는 오른쪽 컷 카드의 &quot;대상 확대&quot;가 따로 적용돼요.</Muted>
        </ToolBox>
      );
    case "mosaic":
      return (
        <ToolBox title="모자이크 · 분석에서 찾은 영역">
          <ul className="flex flex-col gap-1.5">
            {derived.edit.mosaic.map((m) => {
              const on = s.mosaic[m.kind];
              return (
                <li key={m.kind} className="flex items-center justify-between gap-2 rounded-[0.625rem] bg-card px-2.5 py-2 text-caption">
                  <span>{m.label}</span>
                  <Toggle on={on} onClick={() => setStyle({ mosaic: { ...s.mosaic, [m.kind]: !on } })}>
                    {on ? "가리는 중" : "가리기"}
                  </Toggle>
                </li>
              );
            })}
          </ul>
          <Muted>원본 채널 로고·자막과 일반인 얼굴은 가리는 것을 권해요.</Muted>
        </ToolBox>
      );
    case "comment":
      return (
        <ToolBox title="댓글 반응 스타일">
          <OptionChips
            options={[
              { label: "인스타 스타일", value: "insta" },
              { label: "유튜브 스타일", value: "youtube" },
              { label: "커뮤니티 스타일", value: "community" },
            ] as const}
            value={s.cmtStyle}
            onPick={(cmtStyle) => setStyle({ cmtStyle })}
          />
          <OptionChips
            className="mt-2"
            options={[
              { label: "넣기", value: true },
              { label: "안 넣기", value: false },
            ]}
            value={s.cmtOn}
            onPick={(cmtOn) => setStyle({ cmtOn })}
          />
          <Q>댓글 뜰 때 소리</Q>
          <OptionChips
            options={[
              { label: "없음", value: "none" },
              { label: "메시지 팝", value: "pop" },
              { label: "톡", value: "tok" },
              { label: "반짝", value: "twinkle" },
              { label: "뾰뾰", value: "beep" },
            ] as const}
            value={s.cmtSound}
            onPick={(cmtSound) => setStyle({ cmtSound })}
          />
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {derived.edit.comments.map((c) => (
              <li key={c.cut} className="flex items-center justify-between gap-2 rounded-[0.625rem] bg-card px-2.5 py-2 text-caption">
                <span className="text-sub">{st.order.indexOf(c.cut - 1) + 1}번 컷</span>
                <span className="flex-1">{c.text}</span>
                <Toggle onClick={() => actions.removeComment(c.cut)}>삭제</Toggle>
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Chip className="text-caption" onClick={actions.addComment}>
              + 지금 컷({st.cur + 1}번)에 댓글 넣기
            </Chip>
          </div>
          <Muted>레이더에서 가져온 원본 인기 댓글 중 하나를 골라 넣어요.</Muted>
        </ToolBox>
      );
    case "sfx":
      return (
        <ToolBox title="효과음 · 자동으로 찾은 시점">
          <ul className="flex flex-col gap-1.5">
            {derived.edit.sfx.map((x, i) => {
              const sec = Math.floor(x.at);
              const at = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
              return (
                <li key={i} className="flex items-center justify-between gap-2 rounded-[0.625rem] bg-card px-2.5 py-2 text-caption">
                  <span>
                    {at} · {derived.cutOfTime(x.at) + 1}번 컷
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { label: "뿅", value: "pop" },
                        { label: "띠용", value: "boing" },
                        { label: "반짝", value: "sparkle" },
                        { label: "없음", value: "none" },
                      ] as { label: string; value: SfxType }[]
                    ).map((o) => (
                      <Toggle key={o.value} on={x.type === o.value} onClick={() => actions.setSfx(i, o.value)}>
                        {o.label}
                      </Toggle>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </ToolBox>
      );
    case "voice":
      return (
        <ToolBox title="원본 영상 소리">
          <OptionChips
            options={[
              { label: "켜기", value: "on" },
              { label: "음소거", value: "off" },
            ] as const}
            value={st.origAudio}
            onPick={(origAudio) => actions.touch({ origAudio })}
          />
          <Muted>전체 컷의 원본 소리만 꺼요. 목소리·효과음은 유지돼요.</Muted>
          <Q>목소리 넣기</Q>
          <OptionChips
            options={[
              { label: "넣기", value: true },
              { label: "안 넣기", value: false },
            ]}
            value={st.voiceOn}
            onPick={(voiceOn) => actions.touch({ voiceOn })}
          />
          <div className="mt-2 grid grid-cols-[6.875rem_7.5rem] items-center gap-2 text-caption md:grid-cols-[6.875rem_7.5rem_minmax(0,1fr)]">
            <label htmlFor="ed-spd">목소리 속도</label>
            <Select id="ed-spd" value={st.speed} onChange={(e) => actions.touch({ speed: e.target.value, voiceGen: false })}>
              <option value="0.9">0.9배</option>
              <option value="1">1배</option>
              <option value="1.1">1.1배</option>
              <option value="1.2">1.2배</option>
            </Select>
            <Muted className="col-span-2 mt-0 md:col-span-1">속도를 바꾸면 음성을 다시 생성해요.</Muted>
          </div>
          <Q>음성 엔진</Q>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected className="text-caption">
              Typecast
            </Chip>
            <Chip className="text-caption">
              ElevenLabs <small className="font-medium text-sub">일본어·영어</small>
            </Chip>
          </div>
          <Q>목소리 고르기 · ▶로 미리 듣기</Q>
          <OptionChips
            options={[
              { label: "추천 9", value: "rec" },
              { label: "전체 목록 보기 446", value: "all" },
            ] as const}
            value={st.voiceTab}
            onPick={(voiceTab) => actions.set({ voiceTab })}
          />
          <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {voices
              .filter((v) => st.voiceTab === "all" || v.rec)
              .map((v) => {
                const on = st.voiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => actions.touch({ voiceId: v.id as VoiceId, voiceGen: false })}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-[0.625rem] border-[0.09375rem] bg-card px-2.5 py-2 text-left transition-[transform,filter] duration-150 hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
                      on ? "border-brand" : "border-transparent",
                    )}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="mt-[0.1875rem] size-2.5 flex-none text-brand">
                      <path d="M7 4l13 8-13 8z" />
                    </svg>
                    <span>
                      <b className="block text-caption">
                        {on && "✓ "}
                        {v.name}
                      </b>
                      <span className="block text-2xs text-sub">{v.tags}</span>
                    </span>
                  </button>
                );
              })}
          </div>
        </ToolBox>
      );
  }
}

/** 중앙: 화면 꾸미기 12종 (PLAN 2-3, 4-4) */
export function ToolPanels({ ed }: { ed: Editor }) {
  const { st, actions, derived } = ed;
  const busy = !!st.job;
  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">화면 꾸미기</h2>
        <div className="flex items-center gap-2.5">
          <LinkBtn onClick={actions.undo} disabled={st.history.length === 0}>
            되돌리기
          </LinkBtn>
          <LinkBtn onClick={actions.resetAll}>처음 값으로</LinkBtn>
        </div>
      </div>
      <div className="flex justify-end">
        <RingBtn onClick={() => actions.set({ rightOpen: !st.rightOpen })} aria-expanded={st.rightOpen}>
          {st.rightOpen ? "제목·대본 접기" : "제목·대본 펼치기"}
        </RingBtn>
      </div>
      <p className="mt-3 mb-2 text-caption font-bold">무엇을 바꿀까요?</p>
      <div className="grid grid-cols-4 gap-2">
        {TOOLS.map((t) => {
          const on = st.tool === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => actions.set({ tool: t.key })}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[0.09375rem] p-1.5 text-center text-2xs leading-tight font-bold text-text transition-[transform,filter,background-color,border-color] duration-150 md:min-h-18 md:text-xs",
                "hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
                on ? "border-brand bg-brand/10" : "border-transparent bg-card hover:bg-card2",
              )}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-4.5 text-text/85">
                {ICON[t.key]}
              </svg>
              {t.label}
            </button>
          );
        })}
      </div>
      <ToolBody ed={ed} />
      <Box className="mt-3">
        <h4 className="mb-1 text-caption font-bold">목소리 (Typecast · {derived.voiceName})</h4>
        <Muted>음성을 생성한 뒤 각 대본 옆 ▶ 버튼으로 미리 들을 수 있어요.</Muted>
        <div className="mt-2.5">
          <RingBtn onClick={actions.genVoice} disabled={busy}>
            {st.voiceGen ? `음성 다시 생성 (${derived.cutCount}줄)` : `음성 생성 (${derived.cutCount}줄)`}
          </RingBtn>
        </div>
        <Muted>한 줄마다 Typecast 크레딧이 들어요. 컷보다 길면 빠르게 한 번 더 만들어요.</Muted>
      </Box>
    </>
  );
}

