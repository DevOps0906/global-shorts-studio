import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { SettingsClient } from "@/components/settings/settings-client";
import { Protected } from "@/components/protected";

export const metadata: Metadata = { title: "설정 · 글로벌쇼츠 스튜디오" };

export default function Page() {
  return (
    <Protected>
      <main className="mx-auto flex w-full max-w-[67.5rem] flex-col gap-4 px-3 pt-2 pb-12 md:px-5 md:pt-3 md:pb-15">
        <Card className="md:p-5.5">
          <h1 className="mb-1.5 text-h1 leading-[1.55] font-black">설정</h1>
          <p className="text-body text-sub">기본값을 정해 두면 새 영상을 만들 때마다 다시 고르지 않아도 돼요.</p>
        </Card>
        <SettingsClient />
      </main>
    </Protected>
  );
}
