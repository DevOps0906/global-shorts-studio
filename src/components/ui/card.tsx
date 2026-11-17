import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 시안 .card: panel 배경 · line 테두리 · 둥근 16 */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-line bg-panel p-4", className)}
      {...props}
    />
  );
}

/** 시안 .kpi: 숫자 타일. accent면 숫자를 브랜드색으로 */
export function Kpi({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-[0.875rem] bg-card p-3.5">
      <span className="block text-xs text-sub">{label}</span>
      <b className={cn("mt-0.5 block text-xl font-black md:text-2xl", accent && "text-brand")}>{value}</b>
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
        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border-[0.09375rem] px-3.5 text-sm font-bold text-text transition-[transform,filter,background-color,border-color] duration-150",
        "hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96] active:brightness-95",
        selected ? "border-brand bg-brand/10" : "border-transparent bg-card",
        className,
      )}
      {...props}
    />
  );
}

const tagTone = {
  default: "bg-card2 text-sub",
  err: "border border-danger text-danger",
  warn: "border border-brand text-brand",
  ok: "border border-ok text-ok",
} as const;

/** 시안 .tag: 상태 배지 */
export function Tag({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tagTone }) {
  return (
    <span
      className={cn("self-start rounded-full px-2 py-0.5 text-xs font-bold", tagTone[tone], className)}
      {...props}
    />
  );
}
