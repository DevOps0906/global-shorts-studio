"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function AccountName({ name }: { name: string }) {
  return (
    <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-body font-semibold text-sub">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      <span className="text-text">{name}</span>님
    </span>
  );
}

const pillClass =
  "inline-flex min-h-11 shrink-0 items-center rounded-full bg-card px-3 text-body font-medium text-text transition duration-150 hover:-translate-y-0.5 hover:brightness-[1.18] active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none aria-[current=page]:text-brand aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-brand";

/** 태블릿·데스크톱(768~) 가로 메뉴 */
export function SiteNav({ items, accountName }: { items: NavItem[]; accountName?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="hidden min-w-0 items-center gap-1.5 md:flex md:flex-wrap md:justify-center">
      {items.map((item) => {
        const link = (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
            className={pillClass}
          >
            {item.label}
          </Link>
        );

        // 로그아웃 앞에 계정명 표시
        if (item.href !== "/login" || !accountName) return link;
        return (
          <Fragment key={item.href}>
            <AccountName name={accountName} />
            {link}
          </Fragment>
        );
      })}
    </nav>
  );
}

/** 모바일(~767) 왼쪽 햄버거 버튼 + 왼쪽에서 열리는 메뉴. <dialog>가 포커스 가두기·Esc 닫기를 맡는다 */
export function MobileMenu({ items, accountName }: { items: NavItem[]; accountName?: string }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 화면이 바뀌면 닫는다
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  // 서랍이 열린 채 태블릿 폭(768~)으로 넓어지면 닫는다(숨겨진 모달이 페이지를 막지 않게)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) dialogRef.current?.close();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const close = () => dialogRef.current?.close();

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex size-11 items-center justify-center rounded-lg bg-card text-text transition duration-150 active:scale-[0.96] motion-reduce:transform-none"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="주 메뉴"
        // 바깥(어두운 배경)을 누르면 닫기
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none border-r border-line bg-panel p-0 text-text backdrop:bg-bg/70 open:animate-[drawer-in_200ms_ease-out] motion-reduce:open:animate-none"
      >
        <div className="flex h-full flex-col gap-1 p-4">
          <div className="mb-2 flex items-center justify-between">
            {accountName ? <AccountName name={accountName} /> : <span />}
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={close}
              className="inline-flex size-11 items-center justify-center rounded-lg text-sub hover:text-text"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <nav aria-label="주 메뉴" className="flex flex-1 flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 text-base font-medium hover:bg-card aria-[current=page]:bg-card aria-[current=page]:text-brand ${
                  item.href === "/login" ? "mt-auto text-sub" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </div>
  );
}
