import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "준비 중" 빈 상태 (PLAN 13-1: 한 줄 설명 + 다음 행동 버튼 1개) */
export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto flex w-full max-w-app flex-1 flex-col items-start gap-4 px-4 py-10 md:px-6 md:py-12 xl:px-8">
      <h1 className="text-h1 font-bold">{title}</h1>
      <p className="text-sub">이 화면은 준비 중입니다.</p>
      <Link href="/" className={cn(buttonVariants(), "min-h-11 px-4")}>
        처음 화면으로
      </Link>
    </main>
  );
}
