"use client";

import { usePathname } from "next/navigation";

/** 상단 메뉴를 숨길 화면 (시안 Login에는 상단 메뉴가 없다) */
const HIDDEN_PATHS = ["/login"];

export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return HIDDEN_PATHS.includes(pathname) ? null : children;
}
