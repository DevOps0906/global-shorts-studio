"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 토스트 모양. floating이면 화면 아래 가운데에 띄운다(시안 Main), 아니면 제자리(States). */
export function Toast({ children, floating = false }: { children: ReactNode; floating?: boolean }) {
  return (
    <span
      role="status"
      className={cn(
        "rounded-xl border border-line bg-card2 px-[1.125rem] py-[0.6875rem] text-sm font-bold text-text",
        floating
          ? "fixed bottom-7 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 shadow-[var(--shadow-toast)] animate-[toastin_0.25s_ease]"
          : "self-center",
      )}
    >
      {children}
    </span>
  );
}

/** const { toast, show } = useToast(); → {toast} 를 화면 어디든 렌더, show("문구") 호출 */
export function useToast(ms = 2400) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback(
    (text: string) => {
      setMessage(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(""), ms);
    },
    [ms],
  );
  return { show, toast: message ? <Toast floating>{message}</Toast> : null };
}
