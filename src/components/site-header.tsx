import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { navItems, type Role } from "@/lib/nav";
import { MobileMenu, SiteNav } from "@/components/site-nav";
import { getSession } from "@/server/auth";

/** 서버 세션의 역할·이름으로 그린 상단 메뉴. 세션 없음(로그인 전·/states) → member 메뉴, 이름 없음 */
export async function SessionHeader() {
  const session = await getSession();
  return <SiteHeader role={session?.role ?? "member"} accountName={session?.displayName} />;
}

/** 모든 화면 공통 상단 메뉴. 역할에 없는 메뉴(관리 페이지 등)는 숨긴다 */
export function SiteHeader({ role, accountName }: { role: Role; accountName?: string }) {
  const items = navItems.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-app flex-wrap items-center gap-3 px-4 py-2.5 md:flex-col md:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:px-8">
        <MobileMenu items={items} accountName={accountName} />
        <Link
          href="/"
          aria-label="NOMAD AI Factory 홈"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg xl:justify-self-start"
        >
          <BrandMark />
          <span className="flex flex-col leading-none">
            <b className="text-caption font-black tracking-wider">NOMAD</b>
            <i className="text-micro not-italic uppercase tracking-widest text-sub">AI Factory</i>
          </span>
        </Link>
        <SiteNav items={items} accountName={accountName} />
      </div>
    </header>
  );
}
