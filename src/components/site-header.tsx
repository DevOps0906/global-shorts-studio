import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { navItems, type Role } from "@/lib/nav";
import { SiteNav } from "@/components/site-nav";
import { mockSession } from "@/mocks/session";


/** 모든 화면 공통 상단 메뉴. role 기본값 member → 관리 페이지 숨김 (인증 전) */
export function SiteHeader({
  role = mockSession.role,
  accountName = mockSession.displayName,
}: {
  role?: Role;
  accountName?: string;
}) {
  const items = navItems.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-app flex-wrap items-center gap-3 px-4 py-2.5 md:flex-col md:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:px-8">
        <Link
          href="/"
          aria-label="NOMAD AI Factory 홈"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg xl:justify-self-start"
        >
          <BrandMark />
          <span className="hidden flex-col leading-none md:flex">
            <b className="text-caption font-black tracking-wider">NOMAD</b>
            <i className="text-micro not-italic uppercase tracking-widest text-sub">AI Factory</i>
          </span>
        </Link>
        <SiteNav items={items} accountName={accountName} />
      </div>
    </header>
  );
}
