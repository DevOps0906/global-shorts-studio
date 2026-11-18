"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/home/hero";
import { Btn } from "@/components/ui/btn";
import { Progress } from "@/components/ui/progress";
import { Message, Skeleton } from "@/components/ui/state-blocks";
import { errorText, postJson } from "@/components/studio/api";
import { createClient } from "@/lib/supabase/client";
import { STEP_D, STEP_L, STEP_T } from "@/mocks/home";
import { cn } from "@/lib/utils";

type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";
type Job = { id: string; status: JobStatus };
type Step = { step_no: number; label: string; started_at: string | null; done_at: string | null; error_code: string | null };
type Title = { line1: string; line2?: string; hook?: string; reason?: string };
type Script = { label: string; cuts: { caption?: string }[] };

type Loaded = { job: Job | null; steps: Step[]; titles: Title[]; scripts: Script[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** drafts.edit_state(PLAN 5-3)에서 제목·대본 후보만 안전하게 꺼낸다 */
function parseCandidates(state: unknown): { titles: Title[]; scripts: Script[] } {
  if (!isObj(state)) return { titles: [], scripts: [] };
  const titles = (Array.isArray(state.titles) ? state.titles : []).flatMap((t): Title[] =>
    isObj(t) && str(t.line1) ? [{ line1: str(t.line1)!, line2: str(t.line2), hook: str(t.hook), reason: str(t.reason) }] : [],
  );
  const scripts = (Array.isArray(state.scripts) ? state.scripts : []).flatMap((s, i): Script[] =>
    isObj(s)
      ? [
          {
            label: str(s.label) ?? `대본 ${i + 1}`,
            cuts: (Array.isArray(s.cuts) ? s.cuts : []).map((c) => ({ caption: isObj(c) ? str(c.caption) : undefined })),
          },
        ]
      : [],
  );
  return { titles, scripts };
}

const secs = (s: Step, now: number): number | null => {
  if (!s.started_at) return null;
  const end = s.done_at ? Date.parse(s.done_at) : now;
  return Math.max(0, Math.round((end - Date.parse(s.started_at)) / 1000));
};

export function AnalyzeProgress({ projectId }: { projectId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());
  const [cancelState, setCancelState] = useState<{ busy: boolean; msg?: string }>({ busy: false });
  const [pickTitle, setPickTitle] = useState(0);
  const [pickScript, setPickScript] = useState(0);
  const jobIdRef = useRef<string | null>(null);
  const terminalRef = useRef(false);
  const seqRef = useRef(0); // 겹친 load() 중 가장 최근 요청만 반영
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    const stale = () => !mountedRef.current || seq !== seqRef.current;
    const fail = () => setState((s) => (s === "ready" ? s : "error"));
    const studio = sb.schema("studio");
    const proj = await studio.from("projects").select("id").eq("id", projectId).maybeSingle();
    if (stale()) return;
    if (proj.error) return fail();
    if (!proj.data) return setState("missing");

    const jobRes = await studio
      .from("jobs")
      .select("id,status")
      .eq("project_id", projectId)
      .eq("kind", "analyze")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stale()) return;
    if (jobRes.error) return fail();
    const job = (jobRes.data as Job | null) ?? null;

    let steps: Step[] = [];
    if (job) {
      const st = await studio
        .from("job_steps")
        .select("step_no,label,started_at,done_at,error_code")
        .eq("job_id", job.id)
        .order("step_no");
      if (stale()) return;
      if (st.error) return fail();
      steps = (st.data as Step[]) ?? [];
    }

    let cand: { titles: Title[]; scripts: Script[] } = { titles: [], scripts: [] };
    if (job?.status === "done") {
      const d = await studio
        .from("drafts")
        .select("edit_state")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (stale()) return;
      if (d.error) return fail();
      cand = parseCandidates(d.data?.edit_state);
    }
    // 조회가 모두 성공한 뒤에만 종료 상태로 본다(폴링 중단 기준)
    jobIdRef.current = job?.id ?? null;
    terminalRef.current = !!job && (job.status === "done" || job.status === "failed" || job.status === "canceled");
    setData({ job, steps, ...cand });
    setState("ready");
  }, [sb, projectId]);

  // 첫 로드 + Realtime(jobs·job_steps). 구독이 끊기면 2초 폴링(11-3)
  useEffect(() => {
    let alive = true;
    mountedRef.current = true;
    let poll: ReturnType<typeof setInterval> | null = null;
    const stopPoll = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    const startPoll = () => {
      if (poll || terminalRef.current) return;
      poll = setInterval(() => {
        if (terminalRef.current) return stopPoll();
        void load();
      }, 2000);
    };
    const first = setTimeout(() => void load(), 0);

    // job id는 첫 로드 뒤에 알 수 있으므로 user 행 단위(RLS가 본인 행만 전달)로 구독하고, 이벤트마다 다시 읽는다
    const onChange = () => {
      if (alive) void load();
    };
    const ch = sb
      .channel(`analyze-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "studio", table: "jobs", filter: `project_id=eq.${projectId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "studio", table: "job_steps" }, (p) => {
        const row = p.new as { job_id?: string };
        if (!jobIdRef.current || row.job_id === jobIdRef.current) onChange();
      })
      .subscribe((status) => {
        if (!alive) return;
        if (status === "SUBSCRIBED") stopPoll();
        else startPoll();
      });
    // 구독 확인 전에도 끊김을 놓치지 않게 안전 폴링을 한 번 건다(SUBSCRIBED 되면 해제)
    startPoll();

    return () => {
      alive = false;
      mountedRef.current = false;
      clearTimeout(first);
      stopPoll();
      void sb.removeChannel(ch);
    };
  }, [sb, projectId, load]);

  const job = data?.job ?? null;
  const active = job?.status === "queued" || job?.status === "running";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const cancel = async () => {
    if (!job || cancelState.busy) return;
    setCancelState({ busy: true });
    const r = await postJson<object>(`/api/jobs/${job.id}/cancel`, {});
    if (!mountedRef.current) return;
    if (r.ok) setCancelState({ busy: false, msg: "분석을 취소했어요. 크레딧 1을 돌려드렸어요." });
    else setCancelState({ busy: false, msg: errorText(r.error.code) });
    void load();
  };

  if (state === "loading") {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-[60rem] px-5">
        <Hero className="pt-7" />
        <div className="mx-auto mt-8 flex max-w-[26.25rem] flex-col items-center gap-3">
          <Skeleton className="size-[2.125rem] rounded-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </main>
    );
  }
  if (state === "error" || state === "missing" || !data) {
    return (
      <main className="mx-auto w-full max-w-[60rem] px-5">
        <Hero className="pt-7" />
        <div className="mx-auto mt-8 max-w-[26.25rem] pb-20">
          {state === "missing" ? (
            <Message title="작업을 찾을 수 없어요" code="NOT_FOUND">
              {errorText("NOT_FOUND")}
            </Message>
          ) : (
            <Message title="진행 상황을 불러오지 못했어요" code="UPSTREAM_ERROR">
              잠시 후 다시 시도해 주세요.
            </Message>
          )}
          <div className="mt-3 text-center">
            {state === "error" ? (
              <Btn onClick={() => void load()}>다시 불러오기</Btn>
            ) : (
              <Link href="/studio/new" className="inline-flex min-h-10 items-center text-sm font-bold text-brand">
                새로 시작하기
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="mx-auto w-full max-w-[60rem] px-5">
        <Hero className="pt-7" />
        <div className="mx-auto mt-8 max-w-[26.25rem] pb-20 text-center">
          <p className="mb-3 text-sm text-sub">아직 분석을 시작하지 않은 작업이에요.</p>
          <Link href="/studio/new" className="inline-flex min-h-10 items-center rounded-xl bg-card2 px-4 text-sm font-bold">
            영상 다시 선택
          </Link>
        </div>
      </main>
    );
  }

  const status = job.status;
  const finished = status === "done";
  const failedStep = data.steps.find((s) => s.error_code);
  const stepsFull = STEP_L.map((l, i) => data.steps.find((s) => s.step_no === i + 1) ?? { step_no: i + 1, label: l, started_at: null, done_at: null, error_code: null });
  const firstOpen = stepsFull.findIndex((s) => !s.done_at && !s.error_code);
  const curG = finished ? 3 : failedStep ? failedStep.step_no - 1 : Math.max(0, firstOpen);
  const doneCount = stepsFull.filter((s) => s.done_at).length;
  const pct = finished ? 100 : Math.max(5, Math.round((doneCount / 4) * 100));
  const step3Started = !!stepsFull[2].started_at;
  const canCancel = active && !step3Started;

  const stateLabel =
    status === "done" ? "편집 준비 완료" : status === "failed" ? "분석에 실패했어요" : status === "canceled" ? "분석을 취소했어요" : status === "queued" ? "차례를 기다리는 중..." : STEP_T[curG];
  const stateDesc =
    status === "done"
      ? "제목 3안과 대본 3안이 준비됐어요."
      : status === "failed"
        ? "크레딧 1은 자동으로 돌려드렸어요."
        : status === "canceled"
          ? "크레딧 1을 돌려드렸어요. 영상을 다시 고를 수 있어요."
          : status === "queued"
            ? "곧 분석을 시작해요."
            : STEP_D[curG];

  return (
    <main className="mx-auto w-full max-w-[60rem] px-5">
      <Hero className="pt-7" />
      <div className="pt-6 pb-20 text-center">
        {active && (
          <div
            aria-hidden
            className="mx-auto size-[2.125rem] animate-spin rounded-full border-[0.1875rem] border-line border-t-brand border-r-pink"
          />
        )}
        <p className="mt-3.5 text-caption font-bold text-brand">{curG + 1} / 4 단계</p>
        <h2 className="my-1 text-md font-bold md:text-lg">{stateLabel}</h2>
        <p className="text-sm text-sub">{stateDesc}</p>

        {status === "failed" && (
          <div className="mx-auto mt-3.5 max-w-[26.25rem] text-left">
            <Message title={`${failedStep ? `${failedStep.step_no}단계 ${STEP_L[failedStep.step_no - 1]}` : "분석"}에서 멈췄어요`} code={failedStep?.error_code ?? "UPSTREAM_ERROR"}>
              {errorText(failedStep?.error_code ?? "")} 크레딧 1은 환불됐어요.
            </Message>
          </div>
        )}

        <div className="mx-auto mt-3.5 mb-1.5 w-full max-w-[26.25rem] text-left">
          <div className="mb-1.5 flex justify-between text-xs text-sub">
            <span>전체 진행률</span>
            <b className="font-black text-brand">{pct}%</b>
            <span>{finished ? "완료" : active ? "진행 중" : "중단됨"}</span>
          </div>
          <Progress value={pct} label="전체 진행률" />
        </div>
        <div className="mt-7 mb-5 flex flex-wrap justify-center gap-[1.375rem] md:gap-14">
          {stepsFull.map((s, i) => {
            const bad = !!s.error_code;
            const isDone = !!s.done_at && !bad;
            const cur = !isDone && !bad && active && i === curG;
            return (
              <div
                key={STEP_L[i]}
                className={cn("flex flex-col items-center gap-1.5 text-xs text-sub", cur && "font-bold text-brand", bad && "font-bold text-danger")}
              >
                <i
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-[0.09375rem] border-line bg-card text-caption font-bold not-italic text-sub",
                    isDone && "border-brand/20 bg-[var(--tag-run-bg)] text-brand",
                    cur && "border-brand text-brand",
                    bad && "border-danger text-danger",
                  )}
                >
                  {bad ? "!" : isDone ? "✓" : i + 1}
                </i>
                {STEP_L[i]}
              </div>
            );
          })}
        </div>
        <div role="status" className="mx-auto flex max-w-[26.25rem] flex-col gap-1.5 text-left">
          {stepsFull.map((s, i) => {
            const t = secs(s, now);
            if (!s.started_at && !s.done_at && !s.error_code) return null;
            const bad = !!s.error_code;
            return (
              <div key={s.step_no} className={cn("flex justify-between text-caption", bad ? "font-bold text-danger" : s.done_at ? "text-text/85" : "text-text")}>
                <span>
                  {bad ? "실패 · " : s.done_at ? "✓ · " : "진행 중 · "}
                  {STEP_L[i]}
                </span>
                <span>{t !== null ? `${t}초` : ""}</span>
              </div>
            );
          })}
        </div>

        {finished && (
          <Candidates
            titles={data.titles}
            scripts={data.scripts}
            pickTitle={pickTitle}
            pickScript={pickScript}
            onTitle={setPickTitle}
            onScript={setPickScript}
          />
        )}

        <p className="mt-2 text-caption text-sub">완성 후 컷·자막·스타일을 자유롭게 고칠 수 있어요.</p>
        {active && (
          <span className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-ok/10 px-3 py-1.5 text-caption text-[var(--tag-ok-fg)]">
            창을 닫아도 서버에서 계속 진행돼요
          </span>
        )}
        {cancelState.msg && (
          <div className="mx-auto mt-3 max-w-[26.25rem] text-left">
            <Message tone="warn" title={cancelState.msg} />
          </div>
        )}
        <div className="flex flex-col items-center">
          {finished && (
            <Link
              href="/studio/demo"
              className="mt-[1.375rem] inline-flex min-h-[2.875rem] items-center justify-center gap-2 rounded-xl bg-cta px-[1.625rem] text-base font-black text-bg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-[1.08] active:scale-[0.96]"
            >
              편집 화면 열기 →
            </Link>
          )}
          {canCancel && (
            <Btn loading={cancelState.busy} onClick={() => void cancel()} className="mt-[1.125rem] min-h-10 px-4 text-sm">
              취소 · 크레딧 돌려받기
            </Btn>
          )}
          {active && step3Started && <p className="mt-3 text-caption text-sub">제목·대본 생성이 시작돼서 취소할 수 없어요.</p>}
          {!active && (
            <Link href="/studio/new" className="mt-[1.125rem] inline-flex min-h-10 items-center rounded-[0.625rem] border border-line px-4 text-sm font-bold">
              영상 다시 선택
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function Candidates({
  titles,
  scripts,
  pickTitle,
  pickScript,
  onTitle,
  onScript,
}: {
  titles: Title[];
  scripts: Script[];
  pickTitle: number;
  pickScript: number;
  onTitle: (i: number) => void;
  onScript: (i: number) => void;
}) {
  if (titles.length === 0 && scripts.length === 0) {
    return (
      <div className="mx-auto mt-5 max-w-[26.25rem]">
        <Message tone="warn" title="제목·대본 후보를 불러오지 못했어요">
          편집 화면에서 다시 만들 수 있어요.
        </Message>
      </div>
    );
  }
  const card = (on: boolean) =>
    cn(
      "w-full cursor-pointer rounded-xl border-[0.09375rem] p-3 text-left text-sm transition-[border-color,background-color] duration-150",
      on ? "border-brand bg-[var(--tag-run-bg)]" : "border-line bg-panel",
    );
  return (
    <div className="mx-auto mt-6 grid max-w-[40rem] gap-5 text-left md:grid-cols-2">
      <section aria-labelledby="pick-t">
        <h3 id="pick-t" className="mb-2 text-sm font-bold">제목 3안</h3>
        {titles.length === 0 && <p className="text-xs text-sub">제목 후보가 없어요. 편집 화면에서 직접 입력할 수 있어요.</p>}
        <div className="flex flex-col gap-2">
          {titles.slice(0, 3).map((t, i) => (
            <button key={i} type="button" aria-pressed={pickTitle === i} onClick={() => onTitle(i)} className={card(pickTitle === i)}>
              <b className="block">{t.line1}</b>
              {t.line2 && <b className="block text-brand">{t.line2}</b>}
              {t.reason && <span className="mt-1 block text-xs text-sub">{t.reason}</span>}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="pick-s">
        <h3 id="pick-s" className="mb-2 text-sm font-bold">대본 3안</h3>
        {scripts.length === 0 && <p className="text-xs text-sub">대본 후보가 없어요. 편집 화면에서 다시 만들 수 있어요.</p>}
        <div className="flex flex-col gap-2">
          {scripts.slice(0, 3).map((s, i) => (
            <button key={i} type="button" aria-pressed={pickScript === i} onClick={() => onScript(i)} className={card(pickScript === i)}>
              <b className="block">{s.label}</b>
              <span className="mt-1 block text-xs text-sub">
                컷 {s.cuts.length}개{s.cuts[0]?.caption ? ` · ${s.cuts[0].caption}` : ""}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
