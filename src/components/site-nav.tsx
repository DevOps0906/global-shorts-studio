"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주 메뉴"
      className="flex min-w-0 w-full items-center gap-1.5 overflow-x-auto md:w-auto md:flex-wrap md:justify-end"
    >
      {items.map((item) => {
        const current =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-card px-3 text-body font-medium text-text transition duration-150 hover:-translate-y-0.5 hover:brightness-[1.18] active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none aria-[current=page]:text-brand aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-brand"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
