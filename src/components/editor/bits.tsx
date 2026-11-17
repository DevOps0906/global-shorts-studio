import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Chip } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** 시안 .box/.tool/.rp: panel 배경 상자 */
export function Box({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className={cn("min-w-0 rounded-2xl border border-line bg-panel p-3.5", className)}>
      {children}
    </section>
  );
}

/** 시안 .muted */
export function Muted({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-1 text-xs text-sub", className)}>{children}</p>;
}

/** 시안 .q: 도구 안 소제목 */
export function Q({ children }: { children: ReactNode }) {
  return <p className="mt-3 mb-2 text-caption font-bold">{children}</p>;
}

/** 시안 Editor .chip(36·12) — 공통 Chip(38)보다 작다. 이름 없는 글자 크기 토큰은 cn이 색으로 오인해 지우므로 length: 표기 */
export const CHIP_SM = "min-h-9 px-[0.8125rem] text-[length:var(--text-caption)]";

/** 시안 .chip 목록: 하나만 고르는 알약 버튼 묶음 */
export function OptionChips<T extends string | boolean>({
  options,
  value,
  onPick,
  className,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onPick: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => (
        <Chip key={String(o.value)} selected={o.value === value} className={CHIP_SM} onClick={() => onPick(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** 시안 .rowr: 이름 · 슬라이더 · 값 */
export function RangeRow({
  id,
  label,
  min,
  max,
  value,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-[6.875rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-caption">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
      />
      <b className="text-right tabular-nums">
        {value}
        {unit}
      </b>
    </div>
  );
}

/** 시안 .tg: 작은 켜고 끄기 버튼 */
export function Toggle({
  on,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={cn(
        "min-h-[1.875rem] cursor-pointer rounded-full border-[0.09375rem] bg-transparent px-2.5 text-xs font-bold transition-[transform,filter,border-color] duration-150 hover:brightness-[1.18] active:scale-[0.96]",
        on ? "border-brand text-brand" : "border-line text-sub",
        className,
      )}
      {...props}
    />
  );
}

/** 시안 .sel */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("min-h-9 w-full rounded-lg border border-line bg-card px-2 text-[length:var(--text-caption)] text-text", className)}
      {...props}
    />
  );
}

/** 시안 .ring: 브랜드 테두리 알약 버튼 */
export function RingBtn({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center rounded-full border-[0.09375rem] border-brand bg-transparent px-3.5 text-[length:var(--text-caption)] font-bold text-text transition-[transform,filter] duration-150",
        "enabled:hover:-translate-y-[0.0625rem] enabled:hover:brightness-[1.18] enabled:active:scale-[0.96] disabled:cursor-wait disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}

/** 시안 .lnk: 글자 링크 버튼 */
export function LinkBtn({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "min-h-8 cursor-pointer bg-transparent px-0.5 text-[length:var(--text-caption)] text-sub hover:text-text disabled:cursor-default disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
