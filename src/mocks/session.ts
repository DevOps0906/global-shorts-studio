import type { Role } from "@/lib/nav";

/** 가짜 로그인 세션 — task-004에서 studio.profiles(display_name·role)로 교체 */
export const mockSession: { displayName: string; role: Role } = {
  displayName: "홍길동",
  role: "member",
};
