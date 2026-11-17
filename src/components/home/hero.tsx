import type { ReactNode } from "react";

export function Hero({ className = "pt-10", children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`pb-2 text-center ${className}`}>
      <div className="text-xl leading-[1.1] font-black tracking-tight md:text-2xl xl:text-3xl">
        글로벌쇼츠 <b className="font-black text-brand">스튜디오</b>
      </div>
      {children}
    </div>
  );
}
