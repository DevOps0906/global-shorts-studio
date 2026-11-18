"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/btn";
import { Card, Chip } from "@/components/ui/card";
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


const h2Cls = "text-h2 leading-[1.55] font-black";
const lblCls = "mt-3 mb-1.5 block text-caption leading-[1.55] text-sub";

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

function applyBig(on: boolean) {
  document.documentElement.classList.toggle("big-text", on);
}

export function SettingsClient({ initial }: { initial: SettingsValue | null }) {
  const router = useRouter();
  const [lastSaved, setLastSaved] = useState<SettingsValue>(initial ?? defaultSettings);
  const [v, setV] = useState<SettingsValue>(initial ?? defaultSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const { show, toast } = useToast(2200);
  const vRef = useRef(v);
  const savedRef = useRef(lastSaved);
  const savingRef = useRef(false);

  // 큰 글씨 모드: 서버 렌더가 html 클래스를 못 정해(cacheComponents) 첫 페인트 뒤 적용돼 잠깐 깜빡일 수 있음.
  // 고르는 즉시 미리 적용, 화면을 떠나면 마지막 저장값으로 복원
  useEffect(() => {
    applyBig(v.big);
  }, [v.big]);
  useEffect(() => () => applyBig(savedRef.current.big), []);

  const doSave = useCallback(
    async () => {
      if (savingRef.current) return;
      const sending = vRef.current;
      savingRef.current = true;
      setSaving(true);
      setError("");
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sending),
        });
        if (!res.ok) throw new Error(String(res.status));
        savedRef.current = sending;
        setLastSaved(sending);
        setDirty(vRef.current !== sending);
        show("설정을 저장했어요.");
        router.refresh();
      } catch {
        setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        setDirty(true);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [router, show],
  );

  // 저장하지 않은 변경이 있으면 브라우저 이탈 시 경고
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!initial) {
    return (
      <Card>
        <p role="alert" className="text-body">설정을 불러오지 못했어요.</p>
        <div className="mt-3">
          <Btn onClick={() => router.refresh()}>다시 불러오기</Btn>
        </div>
      </Card>
    );
  }

  function change(patch: Partial<SettingsValue>) {
    const next = { ...vRef.current, ...patch };
    vRef.current = next;
    setV(next);
    setDirty(true);
    setError("");
  }

  function reset() {
    vRef.current = savedRef.current;
    setV(savedRef.current);
    setDirty(false);
    setError("");
    show("마지막 저장값으로 되돌렸어요.");
  }

  const saved = error
    ? error
    : saving
      ? "저장하는 중이에요."
      : dirty
        ? "저장하지 않은 변경이 있어요."
        : "저장된 설정이에요.";

  return (
    <>
      {toast}
      <Card>
        <h2 className={h2Cls}>제작 기본값</h2>
        <span className={lblCls}>기본 언어</span>
        <ChipRow options={mockLangs} value={v.lang} onPick={(lang) => change({ lang })} />
        <span className={lblCls}>기본 프리셋</span>
        <ChipRow options={mockPresets} value={v.preset} onPick={(preset) => change({ preset })} />
        <span className={lblCls}>기본 영상 길이</span>
        <ChipRow options={mockLengths} value={v.len} onPick={(len) => change({ len })} />
      </Card>

      <Card>
        <h2 className={h2Cls}>알림·편의</h2>
        <div className="mt-3 flex flex-col gap-2">
          {mockToggles.map((t) => {
            const on = v[t.key];
            return (
              <div key={t.key} className="flex flex-wrap items-center gap-3 rounded-[0.875rem] bg-card px-3.5 py-3">
                <div className="min-w-0 flex-[1_1_11.25rem]">
                  <b className="block text-base leading-[1.55]">{t.label}</b>
                  <span className="block text-caption leading-[1.55] text-sub">{t.desc}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t.label}
                  onClick={() => change({ [t.key]: !on })}
                  className={cn(
                    "relative h-6 w-10.5 flex-none cursor-pointer rounded-full transition-colors after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']",
                    on ? "bg-ok" : "bg-[var(--switch-off)]",
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

      <Card>
        <h2 className={h2Cls}>화면 크기 미리보기</h2>
        <p className="mt-3 text-caption leading-[1.55] text-sub">큰 글씨 모드를 켜면 아래 글자가 커져요. (시니어 사용자용)</p>
        <p className={cn("mt-3", v.big ? "text-xl" : "text-base")}>이 글씨 크기로 모든 화면이 표시돼요.</p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-2">
            <Btn variant="cta" loading={saving} onClick={() => void doSave()}>
              {saving ? "저장 중…" : "설정 저장"}
            </Btn>
            <Btn onClick={reset} disabled={!dirty || saving}>
              저장값으로 되돌리기
            </Btn>
          </div>
          <span role="status" className={cn("text-caption leading-[1.55]", error ? "text-danger" : "text-sub")}>{saved}</span>
        </div>
      </Card>
    </>
  );
}
