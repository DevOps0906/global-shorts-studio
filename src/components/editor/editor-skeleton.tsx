import { Skeleton } from "@/components/ui/state-blocks";
import { EDITOR_GRID, LEFT_COL, RIGHT_COL } from "./grid";

/** 편집 화면 로딩: 3열 모양 그대로 스켈레톤 (PLAN 13-1) */
export function EditorSkeleton() {
  return (
    <main className="flex-1" aria-busy="true" aria-label="편집 화면 불러오는 중">
      <div className={EDITOR_GRID}>
        <div className={LEFT_COL}>
          <Skeleton className="mx-auto h-[30rem] w-[16.875rem] rounded-[1.375rem] md:h-[33.3125rem] md:w-[18.75rem]" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-5 w-1/3" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl md:h-18" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <div className={`${RIGHT_COL} flex flex-col gap-2`}>
          <Skeleton className="h-5 w-1/4" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
