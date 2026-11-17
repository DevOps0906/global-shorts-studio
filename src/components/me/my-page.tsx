"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Btn } from "@/components/ui/btn";
import { Card, Chip, Kpi, Tag } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/state-blocks";
import { useToast } from "@/components/ui/toast";
import {
  mockAccounts,
  mockCredit,
  mockCreditPacks,
  mockHomework,
  mockJobs,
  mockPastJobCount,
  mockPlanName,
} from "@/mocks/me";

/** 링크용 버튼 모양(Btn sm·default·cta와 같은 반응) */
const linkBase =
  "inline-flex items-center justify-center gap-1.5 font-bold transition-[transform,filter,box-shadow] duration-150 ease-out hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96] active:brightness-95";
const linkSm = `${linkBase} min-h-[2.125rem] rounded-[0.5625rem] bg-card2 px-3 text-caption text-text`;
const linkCta = `${linkBase} min-h-10 rounded-xl bg-cta px-[1.125rem] text-sm font-black text-bg`;

/** 시안 .item: 카드 안 한 줄 */
function Item({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3">
      <div className="min-w-0 flex-[1_1_11.25rem]">
        <b className="block text-base">{title}</b>
        <span className="block text-caption leading-[1.55] text-sub">{desc}</span>
      </div>
      {children}
    </li>
  );
}

export function MyPage() {
  const router = useRouter();
  const { toast, show } = useToast(2200);
  const [credit, setCredit] = useState(mockCredit);
  const [pack, setPack] = useState(0);
  const [charge, setCharge] = useState(-1);
  const [homework, setHomework] = useState(mockHomework);
  const [jobs, setJobs] = useState(mockJobs);
  const [accounts, setAccounts] = useState(mockAccounts);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const chargeTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const accountTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      clearInterval(chargeTimer.current);
      accountTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const doneCount = homework.filter((h) => h.done).length;
  const hwPct = Math.round((doneCount / homework.length) * 100);
  const charging = charge >= 0;

  /** 가짜 충전: 진행률만 올리고 끝나면 잔액에 정수 크레딧을 더한다(결제 호출 없음) */
  function startCharge() {
    if (charging) return;
    const credits = mockCreditPacks[pack].credits;
    let pct = 0;
    setCharge(0);
    clearInterval(chargeTimer.current);
    chargeTimer.current = setInterval(() => {
      pct = Math.min(100, pct + 10 + Math.floor(Math.random() * 15));
      if (pct >= 100) {
        clearInterval(chargeTimer.current);
        setCharge(-1);
        setCredit((c) => c + credits);
        show(`${credits.toLocaleString("ko-KR")} 크레딧을 충전했어요. (샘플)`);
      } else {
        setCharge(pct);
      }
    }, 260);
  }

  function flipHomework(id: number) {
    const target = homework.find((h) => h.id === id);
    if (!target) return;
    setHomework((list) => list.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
    show(`${target.title}${target.done ? " 완료를 취소했어요." : " 완료로 표시했어요."}`);
  }

  function removeJob(id: number) {
    setJobs((list) => list.filter((j) => j.id !== id));
    show("작업을 삭제했어요.");
  }

  /** 가짜 연결·해제: 잠깐 "연결 중…" 후 상태만 뒤집는다(OAuth 호출 없음) */
  function flipAccount(id: number) {
    const target = accounts.find((a) => a.id === id);
    if (!target || busyIds.includes(id)) return;
    setBusyIds((ids) => [...ids, id]);
    const timer = setTimeout(() => {
      setBusyIds((ids) => ids.filter((x) => x !== id));
      setAccounts((list) => list.map((a) => (a.id === id ? { ...a, connected: !a.connected } : a)));
      show(`${target.name}${target.connected ? " 연결을 해제했어요." : " 연결했어요."}`);
    }, 900);
    accountTimers.current.push(timer);
  }

  return (
    <main className="mx-auto flex w-full max-w-[67.5rem] flex-col gap-4 px-3 pt-2 pb-12 text-body md:px-5 md:pt-3 md:pb-[3.75rem]">
      <Card aria-labelledby="me-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 id="me-title" className="mb-1.5 text-h1 leading-[1.55] font-black">
              마이페이지
            </h1>
            <p className="text-base text-sub">내 작업, 숙제, 연결 계정, 크레딧을 한곳에서 확인해요.</p>
          </div>
          <Link href="/" className={linkCta}>
            + 새 영상 만들기
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="요금제" value={mockPlanName} />
          <Kpi label="남은 크레딧" value={credit.toLocaleString("ko-KR")} accent />
          <Kpi label="만든 영상" value={jobs.length + mockPastJobCount} />
          <Kpi label="숙제 완료율" value={`${hwPct}%`} />
        </div>

        <span className="mt-3 mb-1.5 block text-caption leading-[1.55] text-sub">크레딧 충전</span>
        <div className="flex flex-wrap gap-2">
          {mockCreditPacks.map((p, i) => (
            <Chip key={p.credits} selected={pack === i} disabled={charging} onClick={() => setPack(i)}>
              {p.label}
            </Chip>
          ))}
          <Btn variant="cta" loading={charging} onClick={startCharge}>
            {charging ? "결제 중…" : "충전하기"}
          </Btn>
        </div>
        {charging && (
          <div className="mx-auto mt-3.5 mb-1.5 w-full max-w-[26.25rem]">
            <div className="mb-1.5 flex justify-between text-xs text-sub">
              <span>결제 확인 중…</span>
              <b className="font-black text-brand">{charge}%</b>
            </div>
            <Progress value={charge} label="크레딧 충전 진행률" />
          </div>
        )}
      </Card>

      <Card aria-labelledby="me-hw">
        <h2 id="me-hw" className="mb-3 text-h2 leading-[1.55] font-black">
          내 숙제
          <small className="ml-2 text-caption font-medium text-sub">
            강의 차시별 미션 · 제품 안 행동으로 자동 확인
          </small>
        </h2>
        <Progress value={hwPct} label="숙제 완료율" />
        <ul className="mt-3 flex flex-col gap-2">
          {homework.map((h) => (
            <Item key={h.id} title={h.title} desc={h.desc}>
              <span className="inline-flex">
                <Tag tone={h.done ? "ok" : "warn"}>{h.done ? "완료" : "진행 중"}</Tag>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={h.href} className={linkSm}>
                  바로 가기
                </Link>
                <Btn size="sm" onClick={() => flipHomework(h.id)}>
                  {h.done ? "되돌리기" : "완료 표시"}
                </Btn>
              </div>
            </Item>
          ))}
        </ul>
      </Card>

      <Card aria-labelledby="me-jobs">
        <h2 id="me-jobs" className="text-h2 leading-[1.55] font-black">
          내 작업
        </h2>
        {jobs.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {jobs.map((j) => (
              <Item key={j.id} title={j.title} desc={j.meta}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Btn size="sm" onClick={() => router.push("/studio/demo")}>
                    편집 열기
                  </Btn>
                  <Btn size="sm" onClick={() => removeJob(j.id)}>
                    <span className="text-[color:var(--tag-bad-fg)]">삭제</span>
                  </Btn>
                </div>
              </Item>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState
              message="작업이 없어요. 새 영상을 만들어 보세요."
              action={
                <Link href="/" className={linkCta}>
                  + 새 영상 만들기
                </Link>
              }
            />
          </div>
        )}
      </Card>

      <Card aria-labelledby="me-accounts">
        <h2 id="me-accounts" className="text-h2 leading-[1.55] font-black">
          연결 계정
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {accounts.map((a) => {
            const busy = busyIds.includes(a.id);
            return (
              <Item key={a.id} title={a.name} desc={a.desc}>
                <span className="inline-flex">
                  <Tag tone={a.connected ? "ok" : "default"}>
                    {busy ? "연결 중…" : a.connected ? "연결됨" : "연결 안 됨"}
                  </Tag>
                </span>
                <Btn size="sm" loading={busy} onClick={() => flipAccount(a.id)}>
                  {a.connected ? "해제" : "연결하기"}
                </Btn>
              </Item>
            );
          })}
        </ul>
      </Card>
      {toast}
    </main>
  );
}
