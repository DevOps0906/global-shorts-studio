"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/ui/btn";
import { Card, Chip } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  defaultSettings,
  mockLangs,
  mockLengths,
  mockPresets,
  mockToggles,
  type SettingsValue,
} from "@/mocks/settings";

const cardCls = "md:p-5.5";
const h2Cls = "text-lg font-black md:text-h2";
const lblCls = "mt-3 mb-1.5 block text-caption text-sub";

function ChipRow({
  options,
  value,
  onPick,
}: {
  options: { label: string; value: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.value} selected={value === o.value} onClick={() => onPick(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function SettingsClient() {
  const [v, setV] = useState<SettingsValue>(defaultSettings);
  const [save, setSave] = useState(-1);
  const [saved, setSaved] = useState("아직 저장하지 않은 변경이 없어요.");
  const { show, toast } = useToast(2200);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const saving = save >= 0;

  useEffect(() => () => clearInterval(timer.current), []);
  // 큰 글씨 모드: 화면에서만 <html class="big-text"> 토글 (저장 없음)
  useEffect(() => {
    document.documentElement.classList.toggle("big-text", v.big);
    return () => document.documentElement.classList.remove("big-text");
  }, [v.big]);

  function change(patch: Partial<SettingsValue>) {
    setV((s) => ({ ...s, ...patch }));
    setSaved("저장하지 않은 변경이 있어요.");
  }

  function doSave() {
    if (saving) return;
    let p = 0;
    setSave(0);
    timer.current = setInterval(() => {
      p = Math.min(100, p + 14 + Math.floor(Math.random() * 20));
      if (p >= 100) {
        clearInterval(timer.current);
        setSave(-1);
        setSaved("방금 저장했어요.");
        show("설정을 저장했어요.");
      } else setSave(p);
    }, 240);
  }

  function reset() {
    setV(defaultSettings);
    setSaved("기본값으로 되돌렸어요. 저장을 눌러 확정하세요.");
    show("기본값으로 되돌렸어요.");
  }

  return (
    <>
      {toast}
      <Card className={cardCls}>
        <h2 className={h2Cls}>제작 기본값</h2>
        <span className={lblCls}>기본 언어</span>
        <ChipRow options={mockLangs} value={v.lang} onPick={(lang) => change({ lang })} />
        <span className={lblCls}>기본 프리셋</span>
        <ChipRow options={mockPresets} value={v.preset} onPick={(preset) => change({ preset })} />
        <span className={lblCls}>기본 영상 길이</span>
        <ChipRow options={mockLengths} value={v.len} onPick={(len) => change({ len })} />
      </Card>

      <Card className={cardCls}>
        <h2 className={h2Cls}>알림·편의</h2>
        <div className="mt-3 flex flex-col gap-2">
          {mockToggles.map((t) => {
            const on = v[t.key];
            return (
              <div key={t.key} className="flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3">
                <div className="min-w-0 flex-[1_1_11.25rem]">
                  <b className="block text-base">{t.label}</b>
                  <span className="block text-caption text-sub">{t.desc}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t.label}
                  onClick={() => change({ [t.key]: !on })}
                  className={cn(
                    "relative h-6 w-10.5 flex-none cursor-pointer rounded-full transition-colors",
                    on ? "bg-ok" : "bg-line",
                  )}
                >
                  <i
                    className={cn(
                      "absolute top-0.75 size-4.5 rounded-full bg-text transition-[left] duration-200",
                      on ? "left-5.25" : "left-0.75",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className={cardCls}>
        <h2 className={h2Cls}>화면 크기 미리보기</h2>
        <p className="text-caption text-sub">큰 글씨 모드를 켜면 아래 글자가 커져요. (시니어 사용자용)</p>
        <p className={cn("mt-2", v.big ? "text-xl" : "text-base")}>이 글씨 크기로 모든 화면이 표시돼요.</p>
      </Card>

      <Card className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-2">
            <Btn variant="cta" size="lg" loading={saving} onClick={doSave}>
              {saving ? "저장 중…" : "설정 저장"}
            </Btn>
            <Btn size="sm" onClick={reset}>
              기본값으로 되돌리기
            </Btn>
          </div>
          <span className="text-caption text-sub">{saved}</span>
        </div>
        {saving && (
          <div className="mt-3.5 mb-1.5 w-full max-w-105">
            <div className="mb-1.5 flex justify-between text-caption text-sub">
              <span>설정 저장 중…</span>
              <b className="font-black text-brand">{save}%</b>
            </div>
            <Progress value={save} label="설정 저장 진행률" />
          </div>
        )}
      </Card>
    </>
  );
}
