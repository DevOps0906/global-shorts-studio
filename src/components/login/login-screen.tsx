"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { loginCopy, loginProgress, loginTick, type LoginMode } from "@/mocks/login";


/** 시안 Login: 가짜 로그인. 진행률을 보여 준 뒤 스튜디오(/)로 가는 버튼만 연다 */
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pct, setPct] = useState(-1);
  const [mode, setMode] = useState<LoginMode>("google");
  const [ready, setReady] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const { toast, show } = useToast(2200);
  const busy = pct >= 0;

  useEffect(() => () => clearInterval(timer.current), []);

  function start(next: LoginMode) {
    if (busy) return;
    if (next === "link" && !email.trim()) {
      setEmailError(true);
      show(loginCopy.emailRequired);
      return;
    }
    setEmailError(false);
    setMode(next);
    setReady(false);
    setPct(0);
    let p = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      p = Math.min(100, p + loginTick.min + Math.floor(Math.random() * loginTick.spread));
      if (p >= 100) {
        clearInterval(timer.current);
        setPct(-1);
        setReady(true);
        show(loginProgress[next].done);
      } else {
        setPct(p);
      }
    }, loginTick.tickMs);
  }

  return (
    <div className="flex-1 bg-[radial-gradient(75rem_37.5rem_at_20%_-10%,color-mix(in_srgb,var(--brand)_14%,transparent)_0%,transparent_60%)] px-3 pb-12 md:px-5">
      {toast}
      <main className="mx-auto mt-15 max-w-[27.5rem] text-center">
        <div className="mb-3.5 flex justify-center">
          <span className="inline-flex items-center gap-2">
            <BrandMark />
            <span className="hidden flex-col text-left leading-[1.05] md:flex">
              <b className="text-caption font-black tracking-wider">NOMAD</b>
              <i className="text-micro not-italic uppercase tracking-widest text-sub">AI Factory</i>
            </span>
          </span>
        </div>
        <h1 className="text-3xl font-black">
          글로벌쇼츠 <b className="text-brand">스튜디오</b>
        </h1>
        <p className="mt-2 text-base text-sub" aria-live="polite">
          {ready ? loginCopy.ready : loginCopy.loggedOut}
        </p>

        <section className="mt-5.5 rounded-[1.125rem] border border-line bg-panel p-4 text-left md:p-5.5">
          <label htmlFor="login-email" className="mb-1.5 block text-caption leading-[1.55] text-sub">
            이메일
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            aria-invalid={emailError || undefined}
            aria-describedby={emailError ? "login-email-error" : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(false);
            }}
            className="box-border min-h-10.5 w-full rounded-[0.625rem] border border-line bg-card px-3 text-sm text-text placeholder:text-sub aria-invalid:border-danger"
          />
          {emailError && (
            <p id="login-email-error" className="mt-1.5 text-caption text-danger">
              {loginCopy.emailRequired}
            </p>
          )}

          <div className="mt-3.5 flex flex-col gap-2.5">
            <Btn
              variant="cta"
              loading={busy}
              onClick={() => start("google")}
            >
              {busy ? loginCopy.busy : loginCopy.google}
            </Btn>
            <Btn
              disabled={busy}
              onClick={() => start("link")}
              className="min-h-10.5"
            >
              {loginCopy.link}
            </Btn>
          </div>

          {busy && (
            <div className="mt-3.5 mb-1.5 w-full max-w-[26.25rem]">
              <div className="mb-1.5 flex justify-between text-xs text-sub">
                <span>{loginProgress[mode].label}</span>
                <b className="font-black text-brand">{pct}%</b>
              </div>
              <Progress value={pct} label={loginProgress[mode].label} />
            </div>
          )}

          {ready && (
            <Link
              href="/"
              className="mt-3.5 flex min-h-10 items-center justify-center rounded-xl bg-cta px-[1.125rem] text-sm font-black text-bg transition-[transform,filter,box-shadow] duration-150 hover:-translate-y-0.5 hover:brightness-[1.08] hover:shadow-[0_0.5rem_1.375rem_color-mix(in_srgb,var(--pink)_28%,transparent)] active:scale-[0.96]"
            >
              {loginCopy.start}
            </Link>
          )}
        </section>

        <p className="mt-3.5 text-caption leading-[1.55] text-sub">{loginCopy.note}</p>
        <p className="mt-3.5">
          <Link href="/" className="text-caption leading-[1.55] text-sub">
            {loginCopy.browse}
          </Link>
        </p>
      </main>
    </div>
  );
}
