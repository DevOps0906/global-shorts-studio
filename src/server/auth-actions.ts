"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, siteOrigin } from "@/server/redirect";

/** 구글 로그인 시작. 돌아올 주소의 출처는 NEXT_PUBLIC_SITE_URL만 쓴다 */
export async function signInWithGoogle(formData: FormData) {
  const origin = siteOrigin();
  const nextRaw = formData.get("next");
  const next = safeNext(typeof nextRaw === "string" ? nextRaw : null, origin);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth_start");
  redirect(data.url);
}

/** 로그아웃: 세션 쿠키를 지우고 로그인 화면으로 (GET 링크 금지 — form POST만) */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // 서버 세션 폐기에 실패해도 이 브라우저의 세션 쿠키는 지운다
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?error=signout_failed");
  }
  redirect("/login");
}
