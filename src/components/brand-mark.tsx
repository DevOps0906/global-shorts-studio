import { useId } from "react";

/** NOMAD 로고 아이콘 (시안 .bm). 그라데이션 id는 화면에 여러 개 있어도 겹치지 않게 useId로 만든다 */
export function BrandMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-5.5 shrink-0 text-bg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--brand)" }} />
          <stop offset="1" style={{ stopColor: "var(--pink)" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="16" cy="16" rx="3.6" ry="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 16h17" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 12.6v6.8l5.6-3.4z" fill="currentColor" />
    </svg>
  );
}
