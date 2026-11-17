"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Btn } from "@/components/ui/btn";
import { Card, Chip, Kpi, Tag } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Banner, EmptyState, Message, Skeleton } from "@/components/ui/state-blocks";
import { useToast } from "@/components/ui/toast";
import {
  mockFlags,
  mockHomework,
  mockJobs,
  mockMembers,
  mockOverviewKpis,
  mockPolicyKpis,
  mockQuota,
  type AdminJob,
  type AdminMember,
  type JobStatus,
  type PolicyFlag,
} from "@/mocks/admin";

export type AdminView = "ready" | "loading" | "empty" | "error";
type Tab = "overview" | "queue" | "members" | "policy";

const tabs: { value: Tab; label: string }[] = [
  { value: "overview", label: "개요" },
  { value: "queue", label: "작업 큐" },
  { value: "members", label: "회원·크레딧" },
  { value: "policy", label: "정책·품질" },
];

const jobTag: Record<JobStatus, { tone: "warn" | "ok" | "err"; label: string }> = {
  run: { tone: "warn", label: "진행 중" },
  done: { tone: "ok", label: "완료" },
  fail: { tone: "err", label: "실패" },
};

const h2 = "text-h2 leading-[1.55] font-black";
const h2Small = "ml-2 text-caption font-medium text-sub";
const lbl = "mt-3 mb-1.5 block text-caption leading-[1.55] text-sub";
const muted = "text-caption leading-[1.55] text-sub";
const item = "flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3";

/** 시안 Admin: 개요·작업 큐·회원·정책 탭. 가짜 데이터로만 동작한다. */
export function AdminConsole({ initialView }: { initialView: AdminView }) {
  const [view, setView] = useState(initialView);
  const [tab, setTab] = useState<Tab>("overview");
  const [jobs, setJobs] = useState<AdminJob[]>(initialView === "empty" ? [] : mockJobs);
  const [members, setMembers] = useState<AdminMember[]>(mockMembers);
  const [flags, setFlags] = useState<PolicyFlag[]>(mockFlags);
  const { show, toast } = useToast(2200);

  const hasRunning = jobs.some((j) => j.status === "run");

  // 실시간 진행 흉내: 진행 중 작업만 0.7초마다 4%씩
  useEffect(() => {
    if (view !== "ready" || !hasRunning) return;
    const timer = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.status !== "run") return j;
          const pct = Math.min(100, j.pct + 4);
          return { ...j, pct, status: pct >= 100 ? "done" : "run" };
        }),
      );
    }, 700);
    return () => clearInterval(timer);
  }, [view, hasRunning]);

  const running = jobs.filter((j) => j.status === "run").length;
  const made = mockOverviewKpis.madeBase + jobs.filter((j) => j.status === "done").length;

  function retryJob(id: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, pct: 0, status: "run" } : j)));
    show(`${id} 작업을 다시 시작했어요.`);
  }
  function deleteJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    show(`${id} 작업을 삭제했어요.`);
  }
  function giftCredit(m: AdminMember) {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, credit: x.credit + 10 } : x)));
    show(`${m.name}에게 크레딧 10을 지급했어요.`);
  }
  function toggleMember(m: AdminMember) {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)));
    show(m.name + (m.active ? " 계정을 정지했어요." : " 계정 정지를 해제했어요."));
  }
  function warnFlag(f: PolicyFlag) {
    setFlags((prev) => prev.map((x) => (x.id === f.id ? { ...x, sent: true } : x)));
    show(`${f.user}에게 수익화 안전 안내를 보냈어요.`);
  }

  let body: ReactNode;
  if (view === "loading") {
    body = (
      <Card role="status" aria-label="불러오는 중">
        <Skeleton className="h-4 w-1/4" />
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[4.5rem]" />
          ))}
        </div>
        <Skeleton className="mt-4 h-2.5 w-full" />
        <Skeleton className="mt-4 h-2.5 w-full" />
      </Card>
    );
  } else if (view === "error") {
    body = (
      <Card className="flex flex-col gap-3">
        <Banner action={<Btn onClick={() => setView("ready")}>다시 시도</Btn>}>
          관리 데이터를 불러오지 못했어요.
        </Banner>
        <Message title="작업 큐를 불러오지 못했어요" code="UPSTREAM_ERROR">
          잠시 후 다시 시도해 주세요. 다른 메뉴는 정상이에요.
        </Message>
      </Card>
    );
  } else if (tab === "overview") {
    body = (
      <Card>
        <h2 className={h2}>오늘의 현황</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="신규 가입" value={mockOverviewKpis.signups} />
          <Kpi label="생성된 영상" value={made} accent />
          <Kpi label="사용 크레딧" value={mockOverviewKpis.creditsUsed} />
          <Kpi label="진행 중 작업" value={running} />
        </div>
        {[mockQuota, mockHomework].map((g) => (
          <div key={g.label}>
            <span className={lbl}>{g.label}</span>
            <Progress value={g.pct} label={g.label} />
            <p className={`my-3 ${muted}`}>{g.note}</p>
          </div>
        ))}
      </Card>
    );
  } else if (tab === "queue") {
    body = (
      <Card>
        <h2 className={h2}>
          작업 큐<small className={h2Small}>실시간으로 진행돼요</small>
        </h2>
        {jobs.length === 0 ? (
          <div className="mt-3">
            <EmptyState message="대기 중인 작업이 없어요." />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {jobs.map((j) => (
              <li key={j.id} className={item}>
                <div className="min-w-0 flex-[1_1_11.25rem]">
                  <b className="block text-base">
                    {j.id} · {j.type}
                  </b>
                  <span className="block text-caption leading-[1.55] text-sub">{j.user}</span>
                  <Progress value={j.pct} label={`${j.id} 진행률`} className="mt-1.5" />
                </div>
                <Tag tone={jobTag[j.status].tone} className="self-center">
                  {jobTag[j.status].label}
                </Tag>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Btn size="sm" onClick={() => retryJob(j.id)}>
                    재시도
                  </Btn>
                  <Btn size="sm" onClick={() => deleteJob(j.id)}>
                    <span className="text-[color:var(--tag-bad-fg)]">삭제</span>
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  } else if (tab === "members") {
    body = (
      <Card>
        <h2 className={h2}>회원·크레딧</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-sub">
                <th className="px-2.5 py-2 font-medium">회원</th>
                <th className="px-2.5 py-2 font-medium">요금제</th>
                <th className="px-2.5 py-2 font-medium">크레딧</th>
                <th className="px-2.5 py-2 font-medium">상태</th>
                <th className="px-2.5 py-2">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-line">
                  <td className="p-2.5">{m.name}</td>
                  <td className="p-2.5">{m.plan}</td>
                  <td className="p-2.5">{m.credit}</td>
                  <td className="p-2.5">
                    <Tag tone={m.active ? "ok" : "err"}>{m.active ? "정상" : "정지"}</Tag>
                  </td>
                  <td className="p-2.5">
                    <div className="flex gap-1.5">
                      <Btn size="sm" className="whitespace-nowrap" onClick={() => giftCredit(m)}>
                        +10 크레딧
                      </Btn>
                      <Btn size="sm" className="whitespace-nowrap" onClick={() => toggleMember(m)}>
                        <span className="text-[color:var(--tag-bad-fg)]">{m.active ? "정지" : "해제"}</span>
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  } else {
    body = (
      <Card>
        <h2 className={h2}>
          정책·품질 감시<small className={h2Small}>재사용 콘텐츠 위험을 미리 막아요</small>
        </h2>
        <div className="my-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {mockPolicyKpis.map((k) => (
            <Kpi key={k.label} label={k.label} value={k.value} accent={"accent" in k && k.accent} />
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {flags.map((f) => (
            <li key={f.id} className={item}>
              <div className="min-w-0 flex-[1_1_11.25rem]">
                <b className="block text-base">{f.title}</b>
                <span className="block text-caption leading-[1.55] text-sub">
                  {f.user} · {f.reason}
                </span>
              </div>
              <Tag tone={f.sent ? "ok" : "err"} className="self-center">
                {f.sent ? "경고 발송됨" : "검토 필요"}
              </Tag>
              <Btn size="sm" disabled={f.sent} onClick={() => warnFlag(f)}>
                {f.sent ? "발송 완료" : "경고 메시지 보내기"}
              </Btn>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[67.5rem] flex-col gap-4 px-3 pt-2 pb-12 text-body md:px-5 md:pt-3 md:pb-[3.75rem]">
      <Card>
        <div className="mb-3">
          <h1 className="mb-1.5 text-h1 leading-[1.55] font-black">
            관리 페이지 <small className={muted}>운영자 전용</small>
          </h1>
          <p className="text-base text-sub">작업 큐, 회원·크레딧, 정책 위반 위험을 한곳에서 관리해요.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="관리 메뉴">
          {tabs.map((t) => (
            <Chip key={t.value} selected={tab === t.value} onClick={() => setTab(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Card>
      {body}
      {toast}
    </main>
  );
}
