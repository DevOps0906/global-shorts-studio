import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Btn } from "@/components/ui/btn";
import { Message } from "@/components/ui/state-blocks";
import { getSession } from "@/server/auth";
import { signOut } from "@/server/auth-actions";

export const metadata: Metadata = { title: "승인 대기 · 글로벌쇼츠 스튜디오" };

/** 비로그인 → /login, 이미 승인 → / */
async function PendingCheck() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.approved) redirect("/");
  return null;
}

/** 승인 대기 회원(PLAN 13-1 로그인 오류). 로그아웃만 할 수 있다 */
export default function Page() {
  return (
    <div className="flex-1 px-3 pb-12 md:px-5">
      <Suspense fallback={null}>
        <PendingCheck />
      </Suspense>
      <main className="mx-auto mt-15 max-w-[27.5rem] text-center">
        <div className="mb-3.5 flex justify-center">
          <BrandMark />
        </div>
        <h1 className="text-3xl font-black">
          글로벌쇼츠 <b className="text-brand">스튜디오</b>
        </h1>
        <section className="mt-5.5 flex flex-col gap-3.5 rounded-[1.125rem] border border-line bg-panel p-4 text-left md:p-5.5">
          <Message tone="warn" title="승인 대기 중이에요" code="NOT_APPROVED">
            운영자가 가입을 승인하면 바로 이용할 수 있어요. 승인 후 다시 로그인해 주세요.
          </Message>
          <form action={signOut} className="flex flex-col">
            <Btn type="submit">로그아웃</Btn>
          </form>
        </section>
      </main>
    </div>
  );
}
