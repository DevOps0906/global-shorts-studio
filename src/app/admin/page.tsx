import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminConsole, type AdminView } from "@/components/admin/admin-console";
import { Protected } from "@/components/protected";

export const metadata: Metadata = { title: "관리 페이지 · 글로벌쇼츠 스튜디오" };

const views: AdminView[] = ["ready", "loading", "empty", "error"];

/** 시안 Admin. 상태 확인은 ?state=loading|empty|error. member는 404, 강사/운영자 탭 분리는 task-010. */
async function Console({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { state } = await searchParams;
  const view = views.find((v) => v === state) ?? "ready";
  return <AdminConsole initialView={view} />;
}

export default function Page({ searchParams }: PageProps<"/admin">) {
  return (
    <Protected roles={["instructor", "operator"]}>
      <Suspense fallback={<AdminConsole initialView="loading" />}>
        <Console searchParams={searchParams} />
      </Suspense>
    </Protected>
  );
}
