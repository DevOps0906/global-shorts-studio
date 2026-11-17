import Link from "next/link";
import { navItems, type Role } from "@/lib/nav";
import { SiteNav } from "@/components/site-nav";

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-5.5 shrink-0 text-bg">
      <defs>
        <linearGradient id="brand-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--brand)" }} />
          <stop offset="1" style={{ stopColor: "var(--pink)" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#brand-mark)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="16" cy="16" rx="3.6" ry="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 16h17" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 12.6v6.8l5.6-3.4z" fill="currentColor" />
    </svg>
  );
}

/** 모든 화면 공통 상단 메뉴. role 기본값 member → 관리 페이지 숨김 (인증 전) */
export function SiteHeader({ role = "member" }: { role?: Role }) {
  const items = navItems.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-app flex-wrap items-center gap-3 px-4 py-2.5 md:px-6 xl:px-8">
        <Link
          href="/"
          aria-label="NOMAD AI Factory 홈"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg"
        >
          <BrandMark />
          <span className="hidden flex-col leading-none md:flex">
            <b className="text-caption font-black tracking-wider">NOMAD</b>
            <i className="text-micro not-italic uppercase tracking-widest text-sub">AI Factory</i>
          </span>
        </Link>
        <SiteNav items={items} />
      </div>
    </header>
  );
}
