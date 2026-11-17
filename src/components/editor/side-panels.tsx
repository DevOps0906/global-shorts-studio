"use client";

import { Btn } from "@/components/ui/btn";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { editCost } from "@/mocks/editor";
import { Box, Muted, Select } from "./bits";
import type { Editor } from "./use-editor";

/** 좌측: 장면·대본 재구성(비용 경고) · 변형도 점수 · 내보내기 · 업로드 (PLAN 4-4, 7-3) */
export function SidePanels({ ed }: { ed: Editor }) {
  const { st, actions, derived } = ed;
  const busy = !!st.job;
  const btn2 = "min-h-10 rounded-[0.625rem] border-0 bg-card text-caption enabled:hover:bg-card2";

  return (
    <>
      <Box>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={st.reorg}
            onChange={() => actions.touch({ reorg: !st.reorg })}
            className="size-4 accent-brand"
          />
          장면·대본 재구성
        </label>
        <Muted>컷 순서·제목·자막·TTS 추천문구를 재구성해 선택한 대본을 바꿔요.</Muted>
        <div className="mt-2 rounded-[0.625rem] border border-line bg-bg p-2.5 text-xs text-sub">
          <b className="mb-0.5 block text-brand">추가 API 비용 발생 · 크레딧 {editCost.reorg}</b>
          생성·검증·번역 및 자동 수정 요청에 비용이 발생해요. 검증에 실패해도 과금될 수 있어요.
        </div>
        <Muted>
          {st.reorg
            ? `다음 저장 때 컷 순서·제목·자막·TTS 추천문구를 다시 만들어요 (크레딧 ${editCost.reorg}).`
            : "현재 편집을 유지합니다."}
        </Muted>
      </Box>

      <Box label="변형도 점수">
        <h3 className="mb-1.5 flex items-center justify-between gap-2 text-sm font-bold">
          변형도 점수 <span className="rounded-md bg-pink px-2 py-0.5 text-xs font-bold text-text">NEW</span>
        </h3>
        <div className="flex items-baseline gap-1.5">
          <b className="text-2xl font-black tabular-nums">{derived.score}</b>
          <Muted className="mt-0">/ 100 · 권장 60점 이상</Muted>
        </div>
        <div className="my-2 h-1.5 overflow-hidden rounded-md bg-line">
          <i
            className="block h-full bg-[linear-gradient(90deg,var(--brand),var(--ok))] transition-[width] duration-300"
            style={{ width: `${derived.score}%` }}
          />
        </div>
        <ul>
          {derived.checks.map((c) => (
            <li key={c.label} className={cn("flex justify-between gap-2 py-0.5 text-xs", c.ok ? "text-text" : "text-sub")}>
              <span>
                {c.ok ? "✓" : "○"} {c.label}
              </span>
              <em className="text-sub not-italic">+{c.pts}</em>
            </li>
          ))}
        </ul>
        <Muted>원본에 더한 내 해설·편집이 많을수록 수익화 심사(재사용 콘텐츠)에 유리해요.</Muted>
      </Box>

      <Btn variant="cta" size="lg" className="min-h-12 w-full rounded-[0.75rem]" onClick={actions.saveVideo} disabled={busy}>
        영상 저장하기
      </Btn>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn className={btn2} onClick={actions.saveZip} disabled={busy}>
          캡컷 ZIP 저장
        </Btn>
        <Btn className={btn2} onClick={actions.copyScript}>
          대본 복사
        </Btn>
        <Btn className={btn2} onClick={actions.saveSrt} disabled={busy}>
          자막 파일 받기
        </Btn>
        <Btn className={btn2} onClick={actions.makeJa} disabled={busy}>
          일본어판 만들기
        </Btn>
      </div>
      {st.job && (
        <div className="mx-auto mt-1.5 w-full max-w-[26.25rem]">
          <div className="mb-1.5 flex justify-between text-xs text-sub">
            <span>{st.job.label}</span>
            <b className="font-black text-brand">{st.job.pct}%</b>
          </div>
          <Progress value={st.job.pct} label={st.job.label} />
        </div>
      )}
      <Muted className={cn(st.saveFailed && "text-danger")}>{st.saveTxt}</Muted>
      {st.msg && (
        <p role="status" className="mt-1.5 text-caption text-ok">
          {st.msg}
        </p>
      )}

      <Box>
        <h3 className="mb-1.5 text-sm font-bold">내 채널 업로드</h3>
        <label className="text-xs text-sub" htmlFor="ed-ch">
          채널
        </label>
        <Select id="ed-ch" value={st.channel} onChange={(e) => actions.set({ channel: e.target.value as "kr" | "jp" })}>
          <option value="kr">고양이 쇼츠 (KR)</option>
          <option value="jp">ねこショート (JP)</option>
        </Select>
        <label className="mt-2 block text-xs text-sub" htmlFor="ed-when">
          공개 시점
        </label>
        <Select
          id="ed-when"
          value={st.when}
          onChange={(e) => actions.set({ when: e.target.value as "now" | "t21" | "best" })}
        >
          <option value="now">바로 공개</option>
          <option value="t21">오늘 오후 9:00 예약</option>
          <option value="best">레이더 추천 시간대 (오후 7~9시)</option>
        </Select>
        <div className="mt-2.5">
          <Btn variant="cta" className="min-h-10 rounded-[0.625rem] text-sm" onClick={actions.upload} disabled={busy}>
            내 채널에 업로드
          </Btn>
        </div>
        <Muted>제목·설명·해시태그가 자동으로 들어가고, 올린 영상은 레이더 성과 추적에 등록돼요.</Muted>
      </Box>
    </>
  );
}
