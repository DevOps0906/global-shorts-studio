"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultStyle,
  editCost,
  mockEdit,
  pickedComment,
  presets,
  voices,
  type EditJson,
  type EditorStyle,
  type Lang,
  type PresetId,
  type SfxType,
  type VoiceId,
} from "@/mocks/editor";

export type ToolKey =
  | "preset"
  | "template"
  | "titleStyle"
  | "color"
  | "font"
  | "size"
  | "sub"
  | "video"
  | "mosaic"
  | "comment"
  | "sfx"
  | "voice";

/** 화면 상태 확인용(?state=): 시안 States의 편집 화면 오류·빈 상태 */
export type DemoState = "normal" | "save-error" | "conflict" | "empty";

type Job = { label: string; pct: number };

type State = {
  style: EditorStyle;
  history: EditorStyle[];
  tool: ToolKey;
  lang: Lang;
  titleIdx: number;
  moreTitles: boolean;
  scriptIdx: number;
  edit: Record<Lang, EditJson>;
  edited: boolean;
  order: number[];
  orig: boolean[];
  ok: boolean[];
  cutVoice: VoiceId[];
  voiceOn: boolean;
  origAudio: "on" | "off";
  speed: string;
  voiceId: VoiceId;
  voiceTab: "rec" | "all";
  voiceGen: boolean;
  cur: number;
  playing: boolean;
  rightOpen: boolean;
  reorg: boolean;
  channel: "kr" | "jp";
  when: "now" | "t21" | "best";
  msg: string;
  saveTxt: string;
  tplFileName: string;
  job: Job | null;
  saveFailed: boolean;
  conflict: boolean;
};

const SAVED_TXT = "작업 저장됨 · 고치면 3초 뒤 자동 저장 · 처음 화면 ‘내 작업’에서 다시 열기";

function clone<T>(v: T): T {
  return structuredClone(v);
}

function initial(demo: DemoState): State {
  const edit = clone(mockEdit);
  if (demo === "empty") {
    edit.ko.scripts = [];
    edit.ja.scripts = [];
  }
  const cuts = mockEdit.ko.scripts[0].cuts;
  const n = demo === "empty" ? 0 : cuts.length;
  return {
    style: clone(defaultStyle),
    history: [],
    tool: "template",
    lang: "ko",
    titleIdx: 0,
    moreTitles: false,
    scriptIdx: 0,
    edit,
    edited: false,
    order: Array.from({ length: n }, (_, i) => i),
    orig: cuts.map((c) => c.keepOriginal),
    ok: cuts.map(() => false),
    cutVoice: cuts.map(() => "hanna"),
    voiceOn: true,
    origAudio: "on",
    speed: "1",
    voiceId: "hanna",
    voiceTab: "rec",
    voiceGen: false,
    cur: 0,
    playing: false,
    rightOpen: true,
    reorg: false,
    channel: "kr",
    when: "t21",
    msg: "",
    saveTxt: demo === "save-error" ? "저장 실패 · 이 브라우저에 임시 보관 중" : SAVED_TXT,
    tplFileName: "",
    job: null,
    saveFailed: demo === "save-error",
    conflict: demo === "conflict",
  };
}

export function useEditor(demo: DemoState) {
  const [st, setSt] = useState<State>(() => initial(demo));
  const timers = useRef<{ play?: ReturnType<typeof setTimeout>; save?: ReturnType<typeof setTimeout>; job?: ReturnType<typeof setInterval>; jobDone?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const t = timers.current;
    return () => {
      clearTimeout(t.play);
      clearTimeout(t.save);
      clearInterval(t.job);
      clearTimeout(t.jobDone);
    };
  }, []);

  const set = useCallback((patch: Partial<State> | ((s: State) => Partial<State>)) => {
    setSt((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  /** 고치면 자동 저장 표시(PLAN 2-5) */
  const touch = useCallback(
    (patch: Partial<State> | ((s: State) => Partial<State>) = {}) => {
      clearTimeout(timers.current.save);
      set((s) => ({ ...(typeof patch === "function" ? patch(s) : patch), saveTxt: "저장 중…" }));
      timers.current.save = setTimeout(() => set({ saveTxt: "작업 저장됨 · 방금" }), 1200);
    },
    [set],
  );

  /** 되돌리기 대상인 화면 꾸미기 변경 */
  const setStyle = useCallback(
    (patch: Partial<EditorStyle>) => {
      touch((s) => ({ history: [...s.history, s.style].slice(-30), style: { ...s.style, ...patch } }));
    },
    [touch],
  );

  /** 오래 걸리는 작업: 작업명 + % 막대, 다른 버튼 잠금 (PLAN 11-3) */
  const runJob = useCallback(
    (label: string, onDone: () => void) => {
      if (st.job) return;
      clearInterval(timers.current.job);
      set({ job: { label, pct: 0 }, msg: "" });
      let pct = 0;
      timers.current.job = setInterval(() => {
        pct = Math.min(100, pct + 6 + Math.floor(Math.random() * 14));
        set({ job: { label, pct } });
        if (pct >= 100) {
          clearInterval(timers.current.job);
          timers.current.jobDone = setTimeout(() => {
            set({ job: null });
            onDone();
          }, 450);
        }
      }, 350);
    },
    [st.job, set],
  );

  const stop = useCallback(() => {
    clearTimeout(timers.current.play);
    set({ playing: false });
  }, [set]);

  const playFrom = (i: number) => {
    clearTimeout(timers.current.play);
    const order = st.order;
    const cuts = mockEdit.ko.scripts[0].cuts;
    const step = (k: number) => {
      if (k >= order.length) {
        set({ playing: false, cur: 0 });
        return;
      }
      set({ cur: k, playing: true });
      const c = cuts[order[k]];
      timers.current.play = setTimeout(() => step(k + 1), (c.end - c.start) * 1000);
    };
    step(i);
  };

  const goTo = useCallback(
    (i: number) => {
      clearTimeout(timers.current.play);
      set({ cur: i, playing: false });
    },
    [set],
  );

  // ---- 파생 값 ----
  const lang = st.lang;
  const edit = st.edit[lang];
  const titles = edit.titles;
  const title = titles[st.titleIdx] ?? titles[0];
  const script = edit.scripts[st.scriptIdx];
  const cutCount = st.order.length;
  const cutIdx = st.order[st.cur] ?? 0;
  const timeline = mockEdit.ko.scripts[0].cuts;
  const dur = Math.round(timeline.reduce((a, c) => a + (c.end - c.start), 0));
  const orderChanged = st.order.some((v, i) => v !== i);
  const commentFor = (ci: number) => edit.comments.find((c) => c.cut === ci + 1)?.text;
  const checks = [
    { label: "새 제목·자막 사용", pts: 15, ok: true },
    { label: "자막 직접 고치기", pts: 15, ok: st.edited },
    { label: "목소리(내레이션) 넣기", pts: 20, ok: st.voiceOn && st.voiceGen },
    { label: "원본 소리 줄이기", pts: 10, ok: st.origAudio === "off" || st.orig.includes(false) },
    { label: "템플릿·제목 디자인", pts: 10, ok: true },
    { label: "댓글 반응 넣기", pts: 10, ok: st.style.cmtOn && edit.comments.length > 0 },
    { label: "원본 로고·자막 가리기", pts: 10, ok: st.style.mosaic.logo || st.style.mosaic.sub },
    { label: "컷 순서 재구성", pts: 10, ok: orderChanged || st.reorg },
  ];
  const score = checks.reduce((a, c) => a + (c.ok ? c.pts : 0), 0);
  const voiceName = (voices.find((v) => v.id === st.voiceId) ?? voices[0]).name;
  const cutOfTime = (at: number) => timeline.findIndex((c) => at >= c.start && at < c.end);

  // ---- 동작 ----
  const editLang = (fn: (e: EditJson) => void, extra: Partial<State> = {}) =>
    touch((s) => {
      const next = clone(s.edit);
      fn(next[s.lang]);
      return { edit: next, ...extra };
    });

  const actions = {
    set,
    touch,
    setStyle,
    runJob,
    goTo,
    play: () => playFrom(st.cur),
    stop,
    undo: () =>
      touch((s) => {
        const h = s.history.slice();
        const last = h.pop();
        return last ? { history: h, style: last } : {};
      }),
    resetAll: () => setStyle(clone(defaultStyle)),
    pickPreset: (id: PresetId) => setStyle({ preset: id, ...presets[id].patch }),
    setCaption: (ci: number, value: string) =>
      editLang((e) => {
        const cut = e.scripts[st.scriptIdx]?.cuts[ci];
        if (cut) cut.caption = value;
      }, { edited: true }),
    setTitle: (field: "line1" | "line2", value: string) =>
      editLang((e) => {
        const t = e.titles[st.titleIdx];
        if (t) t[field] = value;
      }),
    moveCut: (pos: number, dir: -1 | 1) =>
      touch((s) => {
        const o = s.order.slice();
        const j = pos + dir;
        if (j < 0 || j >= o.length) return {};
        [o[pos], o[j]] = [o[j], o[pos]];
        return { order: o };
      }),
    toggleAt: (key: "orig" | "ok", ci: number) =>
      touch((s) => {
        const a = s[key].slice();
        a[ci] = !a[ci];
        return { [key]: a };
      }),
    setAllOrig: (v: boolean) => touch((s) => ({ orig: s.orig.map(() => v) })),
    setCutVoice: (ci: number, v: VoiceId) =>
      touch((s) => {
        const a = s.cutVoice.slice();
        a[ci] = v;
        return { cutVoice: a };
      }),
    addComment: () =>
      editLang(
        (e) => {
          e.comments = [...e.comments.filter((c) => c.cut !== cutIdx + 1), { cut: cutIdx + 1, text: pickedComment[st.lang] }];
        },
        { style: { ...st.style, cmtOn: true } },
      ),
    removeComment: (cut: number) =>
      editLang((e) => {
        e.comments = e.comments.filter((c) => c.cut !== cut);
      }),
    setSfx: (i: number, type: SfxType) =>
      editLang((e) => {
        e.sfx[i].type = type;
      }),
    saveVideo: () => runJob("영상 렌더링 중", () => set({ msg: "렌더링을 시작했어요. 1분 안팎이면 MP4가 내 작업에 저장돼요. (샘플)" })),
    saveZip: () =>
      runJob("캡컷 ZIP 만드는 중", () =>
        set({ msg: "캡컷 ZIP을 만들고 있어요 — 원본·컷별 음성·SRT·제목 PNG·템플릿이 들어가요. (샘플)" }),
      ),
    copyScript: () => set({ msg: `대본 ${cutCount}줄을 복사했어요. (샘플)` }),
    saveSrt: () => runJob("자막 파일 만드는 중", () => set({ msg: "자막 파일(SRT)을 만들었어요. (샘플)" })),
    makeJa: () =>
      runJob("일본어판 번역·음성 만드는 중", () =>
        set({ lang: "ja", msg: "일본어판을 만들었어요 — 제목·자막·목소리만 바뀌고 스타일은 그대로예요." }),
      ),
    upload: () =>
      runJob("내 채널에 업로드 중", () =>
        set({
          msg:
            (score < 60 ? `변형도 점수가 ${score}점이에요. 목소리·자막 수정을 더하면 수익화 심사에 유리해요. ` : "") +
            (st.channel === "kr" ? "고양이 쇼츠(KR)" : "ねこショート(JP)") +
            "에 업로드를 예약했어요. (샘플)",
        }),
      ),
    genVoice: () =>
      runJob("음성 생성 중", () =>
        touch({ voiceGen: true, voiceOn: true, msg: `음성 ${cutCount}줄을 만들었어요. 컷 옆 ▶로 들어 보세요. (샘플)` }),
      ),
    savePreset: () => set({ msg: "지금 설정을 ‘내 프리셋 1’로 저장했어요. (샘플)" }),
    regenScripts: () =>
      runJob(`대본 후보 다시 만드는 중 · 크레딧 ${editCost.reorg}`, () =>
        touch((s) => {
          const next = clone(s.edit);
          next.ko.scripts = clone(mockEdit.ko.scripts);
          next.ja.scripts = clone(mockEdit.ja.scripts);
          return { edit: next, scriptIdx: 0, cur: 0, order: next.ko.scripts[0].cuts.map((_, i) => i) };
        }),
      ),
    retrySave: () => {
      set({ saveFailed: false });
      touch();
    },
    loadLatest: () => setSt(initial("normal")),
    keepMine: () => {
      set({ conflict: false });
      touch();
    },
  };

  return {
    st,
    actions,
    derived: { edit, titles, title, script, cutCount, cutIdx, timeline, dur, checks, score, voiceName, commentFor, cutOfTime },
  };
}

export type Editor = ReturnType<typeof useEditor>;
