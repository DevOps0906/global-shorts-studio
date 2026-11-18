import type { Metadata } from "next";
import { Suspense } from "react";
import { Protected } from "@/components/protected";
import { AnalyzeProgress } from "@/components/studio/analyze-progress";

export const metadata: Metadata = { title: "분석 진행 · 글로벌쇼츠 스튜디오" };

// 루트 레이아웃의 HeaderGate(usePathname)가 동적 경로에서 프리렌더를 막으므로 이 라우트는 요청 때 렌더한다
export const instant = false;

async function Progress({ params }: { params: PageProps<"/studio/[id]/analyzing">["params"] }) {
  const { id } = await params;
  return <AnalyzeProgress projectId={id} />;
}

export default function Page({ params }: PageProps<"/studio/[id]/analyzing">) {
  return (
    <Protected>
      <Suspense>
        <Progress params={params} />
      </Suspense>
    </Protected>
  );
}
