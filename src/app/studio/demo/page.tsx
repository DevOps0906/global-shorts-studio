import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton } from "@/components/editor/editor-skeleton";
import { EditorView } from "@/components/editor/editor-view";
import type { DemoState } from "@/components/editor/use-editor";
import { Protected } from "@/components/protected";

export const metadata: Metadata = { title: "편집 스튜디오 · 글로벌쇼츠 스튜디오" };

const STATES: DemoState[] = ["normal", "save-error", "conflict", "empty"];

async function Demo({ searchParams }: { searchParams: PageProps<"/studio/demo">["searchParams"] }) {
  const { state } = await searchParams;
  if (state === "loading") return <EditorSkeleton />;
  const demo = STATES.find((s) => s === state) ?? "normal";
  return <EditorView key={demo} demo={demo} />;
}

/** 시안 Editor 데모. ?state=loading|save-error|conflict|empty 로 화면 상태를 확인한다 */
export default function Page({ searchParams }: PageProps<"/studio/demo">) {
  return (
    <Protected fallback={<EditorSkeleton />}>
      <Suspense fallback={<EditorSkeleton />}>
        <Demo searchParams={searchParams} />
      </Suspense>
    </Protected>
  );
}
