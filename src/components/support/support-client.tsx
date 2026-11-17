"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Card, Chip, Tag } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { mockFaqs, mockKinds, mockTickets, type Ticket } from "@/mocks/support";


const h2Cls = "text-h2 leading-[1.55] font-black";

export function SupportClient() {
  const [open, setOpen] = useState(0);
  const [kind, setKind] = useState<string>("bug");
  const [text, setText] = useState("");
  const [send, setSend] = useState(-1);
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const { show, toast } = useToast(2200);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const sending = send >= 0;

  useEffect(() => () => clearInterval(timer.current), []);

  function submit() {
    if (sending) return;
    if (!text.trim()) {
      show("문의 내용을 입력해 주세요.");
      return;
    }
    const body = text;
    const label = mockKinds.find((k) => k.value === kind)?.label ?? "";
    let p = 0;
    setSend(0);
    timer.current = setInterval(() => {
      p = Math.min(100, p + 15 + Math.floor(Math.random() * 20));
      if (p >= 100) {
        clearInterval(timer.current);
        setSend(-1);
        setText("");
        setTickets((t) => [
          { id: Date.now(), title: `[${label}] ${body.slice(0, 24)}`, meta: "방금 접수", status: "wait" },
          ...t,
        ]);
        show("문의를 접수했어요. 영업일 기준 1일 안에 답변드려요.");
      } else setSend(p);
    }, 240);
  }

  return (
    <>
      {toast}
      <Card>
        <h2 className={h2Cls}>자주 묻는 질문</h2>
        <div className="mt-3 flex flex-col gap-2">
          {mockFaqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex min-h-11.5 w-full cursor-pointer items-center justify-between rounded-xl bg-card px-3.5 text-left text-body font-bold text-text transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-[1.18] active:scale-[0.96]"
                >
                  <span>{f.q}</span>
                  <span>{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && <p className="mx-1.5 mt-1.5 mb-2 text-sm text-sub">{f.a}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className={h2Cls}>1:1 문의</h2>
        <span className="mt-3 mb-1.5 block text-caption leading-[1.55] text-sub">문의 종류</span>
        <div className="flex flex-wrap gap-2">
          {mockKinds.map((k) => (
            <Chip key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </Chip>
          ))}
        </div>
        <label htmlFor="support-text" className="mt-3 mb-1.5 block text-caption leading-[1.55] text-sub">
          내용
        </label>
        <textarea
          id="support-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="어떤 화면에서 어떤 일이 있었는지 알려 주세요"
          className="box-border min-h-24 w-full resize-y rounded-[0.625rem] border border-line bg-card px-3 py-2.5 text-sm text-text"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-caption leading-[1.55] text-sub">답변은 이메일과 텔레그램으로 보내드려요.</span>
          <Btn variant="cta" loading={sending} onClick={submit}>
            {sending ? "접수 중…" : "문의 보내기"}
          </Btn>
        </div>
        {sending && (
          <div className="mt-3.5 mb-1.5 w-full max-w-105">
            <div className="mb-1.5 flex justify-between text-caption leading-[1.55] text-sub">
              <span>문의 접수 중…</span>
              <b className="font-black text-brand">{send}%</b>
            </div>
            <Progress value={send} label="문의 접수 진행률" />
          </div>
        )}
      </Card>

      <Card>
        <h2 className={h2Cls}>내 문의 내역</h2>
        <div className="mt-3 flex flex-col gap-2">
          {tickets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3">
              <div className="min-w-0 flex-[1_1_11.25rem]">
                <b className="block text-base leading-[1.55]">{t.title}</b>
                <span className="block text-caption leading-[1.55] text-sub">{t.meta}</span>
              </div>
              <Tag tone={t.status === "done" ? "ok" : "warn"}>{t.status === "done" ? "답변 완료" : "접수됨"}</Tag>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
