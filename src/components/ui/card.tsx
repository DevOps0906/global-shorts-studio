import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 시안 .card: panel 배경 · line 테두리 · 둥근 18 */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("min-w-0 rounded-[1.125rem] border border-line bg-panel p-4 md:p-5.5", className)}
      {...props}
    />
  );
}

/** 시안 .kpi: 숫자 타일. accent면 숫자를 브랜드색으로 */
export function Kpi({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-[0.875rem] bg-card p-3.5">
      <span className="block text-xs text-sub">{label}</span>
      <b className={cn("mt-0.5 block whitespace-nowrap text-xl font-black md:text-2xl", accent && "text-brand")}>{value}</b>
    </div>
  );
}

/** 시안 .chip: 선택형 알약 버튼. selected면 브랜드 테두리 */
export function Chip({
  selected = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-[2.375rem] cursor-pointer items-center gap-1.5 rounded-full border-[0.09375rem] px-[0.9375rem] text-sm font-bold text-text transition-[transform,filter,background-color,border-color] duration-150",
        "hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96] active:brightness-95",
        selected ? "border-brand bg-[var(--tag-run-bg)]" : "border-transparent bg-card",
        className,
      )}
      {...props}
    />
  );
}

const tagTone = {
  default: "bg-line text-sub",
  err: "bg-[var(--tag-bad-bg)] text-[var(--tag-bad-fg)]",
  warn: "bg-[var(--tag-run-bg)] text-brand",
  ok: "bg-[var(--tag-ok-bg)] text-[var(--tag-ok-fg)]",
} as const;

/** 시안 .tag: 상태 배지(채움형, warn=run 노란 채움) */
export function Tag({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tagTone }) {
  return (
    <span
      className={cn("inline-flex self-start rounded-full px-2 py-0.5 text-xs font-bold", tagTone[tone], className)}
      {...props}
    />
  );
}
