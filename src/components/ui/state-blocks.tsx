import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 로딩 자리표시 한 줄(시안 .sk). thumb이면 9:16 썸네일 */
export function Skeleton({ className, thumb = false }: { className?: string; thumb?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-[shimmer_1.4s_ease-in-out_infinite] rounded-lg bg-card2",
        thumb && "aspect-[9/16] w-14 flex-none",
        className,
      )}
    />
  );
}

/** 썸네일 + 글줄 2개 스켈레톤 행 */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton thumb />
      <span className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-2.5 w-2/5" />
      </span>
    </div>
  );
}

/** 빈 상태: 한 줄 설명 + (버튼 1개) */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-2.5 text-center">
      <p className="mb-3 text-sm text-sub">{message}</p>
      {action}
    </div>
  );
}

/** 오류·경고·성공 메시지(시안 .msg). code는 오류 코드(PLAN 13-4) */
export function Message({
  tone = "err",
  title,
  children,
  code,
}: {
  tone?: "err" | "warn" | "ok";
  title: string;
  children?: ReactNode;
  code?: string;
}) {
  const border = { err: "border-danger", warn: "border-brand", ok: "border-ok" }[tone];
  const icon = { err: "bg-danger", warn: "bg-brand", ok: "bg-ok" }[tone];
  return (
    <div
      role={tone === "ok" ? "status" : "alert"}
      className={cn("flex items-start gap-2.5 rounded-xl border bg-card px-3.5 py-3 text-sm", border)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-[1.375rem] flex-none items-center justify-center rounded-full text-sm font-black text-bg",
          icon,
        )}
      >
        {tone === "ok" ? "✓" : "!"}
      </span>
      <div>
        <b className="block">{title}</b>
        {children && <span className="text-caption text-sub">{children}</span>}
        {code && (
          <>
            <br />
            <span className="mt-1 inline-block rounded-md bg-card2 px-1.5 py-[0.0625rem] font-mono text-xs text-sub">
              오류 코드 · {code}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** 상단 오류 배너(시안 .banner) */
export function Banner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-danger bg-card px-3.5 py-2.5 text-sm"
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
