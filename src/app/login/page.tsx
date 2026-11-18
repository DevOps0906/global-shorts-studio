import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/login/login-screen";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "로그인 · 글로벌쇼츠 스튜디오" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 이미 로그인 → / (미승인이면 /pending). next·error는 화면에 넘긴다(next 검증은 Server Action) */
async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const session = await getSession();
  if (session) redirect(session.approved ? "/" : "/pending");
  const { next, error } = await searchParams;
  return <LoginScreen next={first(next)} error={first(error)} />;
}

export default function Page({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginScreen />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}
