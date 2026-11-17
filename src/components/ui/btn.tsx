import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** cta: 그라데이션 주 버튼 · default: 보조 버튼 */
  variant?: "default" | "cta";
  /** md: 시안 States 버튼 · sm: 표 안 작은 버튼 · lg: 화면 주 버튼 */
  size?: "sm" | "md" | "lg";
  /** 진행 중: 버튼을 잠그고(disabled) aria-busy 표시. 중복 클릭 방지 (PLAN 11-3) */
  loading?: boolean;
};

const sizes = {
  sm: "min-h-[2.125rem] px-3 text-caption rounded-lg",
  md: "min-h-9 px-4 text-sm rounded-lg",
  lg: "min-h-[2.875rem] px-6 text-base rounded-xl",
};

/** 시안 .btn/.btn2/.cta: hover 밝게+위로 · press 눌림 · focus는 전역 outline */
export function Btn({
  variant = "default",
  size = "md",
  loading = false,
  className,
  disabled,
  type = "button",
  ...props
}: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-bold transition-[transform,filter,background-color,border-color,box-shadow] duration-150 ease-out",
        "enabled:cursor-pointer enabled:hover:-translate-y-[0.0625rem] enabled:hover:brightness-[1.18] enabled:active:scale-[0.96] enabled:active:brightness-95",
        "disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-wait",
        variant === "cta"
          ? "border-0 bg-cta font-black text-bg enabled:hover:shadow-[0_0.5rem_1.375rem_color-mix(in_srgb,var(--pink)_28%,transparent)]"
          : "border border-line bg-card2 text-text",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
