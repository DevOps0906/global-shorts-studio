import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SupportClient } from "@/components/support/support-client";

export const metadata: Metadata = { title: "고객문의 · 글로벌쇼츠 스튜디오" };

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-[65rem] flex-col gap-4 px-3 pt-2 pb-12 md:px-5 md:pt-3 md:pb-15">
      <Card className="md:p-5.5">
        <h1 className="mb-1.5 text-h1 font-black">고객문의</h1>
        <p className="text-body text-sub">
          자주 묻는 질문을 먼저 확인하고, 해결이 안 되면 문의를 남겨 주세요. 운영 시간 평일 10:00~18:00
        </p>
      </Card>
      <SupportClient />
    </main>
  );
}
