"use client";

import { usePathname } from "next/navigation";

/** 상단 메뉴를 숨길 화면 (시안 Login에는 상단 메뉴가 없다 · 승인 대기는 로그아웃만) */
const HIDDEN_PATHS = ["/login", "/pending"];

export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return HIDDEN_PATHS.includes(pathname) ? null : children;
}
