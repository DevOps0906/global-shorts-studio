import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/nav";

export type Session = {
  user: User;
  role: Role;
  approved: boolean;
  displayName: string;
};

const ROLES: Role[] = ["member", "instructor", "operator"];

function displayNameOf(user: User): string {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  const local = user.email?.split("@")[0];
  return local || "회원";
}

/**
 * 현재 요청의 로그인 세션. 역할·승인은 studio.profiles만 근거로 한다(user_metadata 금지).
 * 프로필 행 없음·조회 오류는 member·미승인으로 본다(fail-closed). 요청당 한 번만 조회.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;

  const { data: profile, error: profileError } = await supabase
    .schema("studio")
    .from("profiles")
    .select("role, approved_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profileError ? null : (profile as { role: unknown; approved_at: unknown } | null);
  const role = ROLES.find((r) => r === row?.role) ?? "member";
  const approved = typeof row?.approved_at === "string" && row.approved_at.length > 0;

  return { user, role, approved, displayName: displayNameOf(user) };
});

/**
 * 보호 화면 진입 검사(proxy 다음 2차 관문). 비로그인 → /login, 미승인 → /pending,
 * roles를 주면 그 밖의 역할은 404.
 */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.approved) redirect("/pending");
  if (roles && !roles.includes(session.role)) notFound();
  return session;
}
