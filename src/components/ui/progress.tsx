import { cn } from "@/lib/utils";

/** 줄무늬 진행 막대 (시안 .pgr). 막대가 도는 동안 같은 작업의 버튼은 Btn loading으로 잠근다. */
export function Progress({
  value,
  label,
  className,
}: {
  /** 0~100 */
  value: number;
  label: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("block h-2.5 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className="h-full rounded-full bg-[length:2rem_2rem,100%_100%] bg-[linear-gradient(135deg,var(--stripe)_0_0.5rem,transparent_0.5rem_1rem),var(--cta)] transition-[width] duration-500 ease-out animate-[pstripe_0.8s_linear_infinite]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
