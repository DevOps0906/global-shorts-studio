"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function SiteNav({ items, accountName }: { items: NavItem[]; accountName?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주 메뉴"
      className="flex min-w-0 w-full items-center gap-1.5 overflow-x-auto md:w-auto md:flex-wrap md:justify-center"
    >
      {items.map((item) => {
        const current =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        const link = (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-card px-3 text-body font-medium text-text transition duration-150 hover:-translate-y-0.5 hover:brightness-[1.18] active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none aria-[current=page]:text-brand aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-brand"
          >
            {item.label}
          </Link>
        );

        // 로그아웃 앞에 계정명 표시
        if (item.href !== "/login" || !accountName) return link;
        return (
          <Fragment key={item.href}>
            <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-body font-semibold text-sub">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <span className="text-text">{accountName}</span>님
            </span>
            {link}
          </Fragment>
        );
      })}
    </nav>
  );
}
