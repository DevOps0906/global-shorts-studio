"use client";

import { Btn } from "@/components/ui/btn";
import { Banner, Message } from "@/components/ui/state-blocks";
import { EDITOR_GRID, LEFT_COL, RIGHT_COL } from "./grid";
import { Preview } from "./preview";
import { ScriptPanel } from "./script-panel";
import { SidePanels } from "./side-panels";
import { ToolPanels } from "./tool-panels";
import { useEditor, type DemoState } from "./use-editor";

/** 편집 스튜디오 (PLAN 4-4) — 가짜 편집 JSON(PLAN 5-3)으로 그린다 */
export function EditorView({ demo = "normal" }: { demo?: DemoState }) {
  const ed = useEditor(demo);
  const { st, actions } = ed;

  return (
    <main className="flex-1">
      {(st.saveFailed || st.conflict) && (
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col gap-2.5 px-3 pt-3 md:px-5">
          {st.saveFailed && (
            <Banner action={<Btn onClick={actions.retrySave}>다시 저장</Btn>}>
              저장하지 못했어요. 이 브라우저에 임시 보관 중이에요.
            </Banner>
          )}
          {st.conflict && (
            <>
              <Message tone="warn" title="다른 탭에서 먼저 수정했어요" code="VERSION_CONFLICT">
                최신 내용을 불러오면 지금 탭의 변경이 사라질 수 있어요.
              </Message>
              <div className="flex flex-wrap gap-2">
                <Btn variant="cta" onClick={actions.loadLatest}>
                  최신 내용 불러오기
                </Btn>
                <Btn onClick={actions.keepMine}>내 변경 유지</Btn>
              </div>
            </>
          )}
        </div>
      )}
      <h1 className="sr-only">편집 스튜디오</h1>
      <div className={EDITOR_GRID}>
        <section className={LEFT_COL} aria-label="미리보기와 저장">
          <Preview ed={ed} />
          <SidePanels ed={ed} />
        </section>
        <section className="min-w-0" aria-label="화면 꾸미기">
          <ToolPanels ed={ed} />
        </section>
        <section className={RIGHT_COL} aria-label="제목과 대본">
          <ScriptPanel ed={ed} />
        </section>
      </div>
    </main>
  );
}
