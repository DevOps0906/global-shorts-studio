export type Role = "member" | "instructor" | "operator";

export type NavItem = {
  label: string;
  href: string;
  /** 보이는 역할. 없으면 모든 역할에 보인다 (PLAN 11-6) */
  roles?: Role[];
};

/** 상단 메뉴 순서·경로 정본: docs/PLAN.md 11-1 */
export const navItems: NavItem[] = [
  { label: "새 영상", href: "/" },
  { label: "레이더", href: "/radar" },
  { label: "저장 채널", href: "/channels" },
  { label: "고객문의", href: "/support" },
  { label: "설정", href: "/settings" },
  { label: "관리 페이지", href: "/admin", roles: ["instructor", "operator"] },
  { label: "마이페이지", href: "/me" },
  { label: "로그아웃", href: "/login" },
];
