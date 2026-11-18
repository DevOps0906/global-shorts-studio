"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hero } from "@/components/home/hero";
import { Btn } from "@/components/ui/btn";
import { Chip } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Message } from "@/components/ui/state-blocks";
import {
  checkFile,
  errorText,
  LICENSE_CHIPS,
  postJson,
  uploadSigned,
  type ApiError,
  type LicenseType,
} from "@/components/studio/api";
import { HOT, LANG_CHIPS, LEN_CHIPS, PRESET_CHIPS, SOURCE_COMMENTS } from "@/mocks/home";
import { cn } from "@/lib/utils";

const lbl = "mt-[1.375rem] mb-2.5 block text-sm font-bold";

export function SetupScreen() {
  const params = useSearchParams();
  const router = useRouter();
  // 대본형 우선 추천(PLAN 4-1): type을 명시하지 않으면 대본형이 기본값
  const type = params.get("type") === "video" ? "video" : "script";
  const src = HOT.find((h) => h.id === params.get("src"));

  const [len, setLen] = useState("keep");
  const [lang, setLang] = useState("ko");
  const [preset, setPreset] = useState("brand");
  const [comments, setComments] = useState(src ? SOURCE_COMMENTS : "");
  const [rights, setRights] = useState(false);
  const [warn, setWarn] = useState(false);
  const [license, setLicense] = useState<LicenseType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mime, setMime] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading" | "starting">("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const projectRef = useRef<string | null>(null); // 업로드까지 끝난 작업물(분석 시작만 재시도)
  const keyRef = useRef(""); // 그 작업물을 만들 때의 길이·언어·유형·파일
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase !== "idle";

  const pick = useCallback((f: File | undefined) => {
    if (!f || busy) return;
    const r = checkFile(f);
    projectRef.current = null;
    setError(null);
    if (r.code) {
      setFile(null);
      setFileError(r.code);
      return;
    }
    setFileError(null);
    setFile(f);
    setMime(r.mime);
  }, [busy]);

  // PC: 화면 어디에나 끌어다 놓기
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      pick(e.dataTransfer?.files?.[0]);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [pick]);

  const fail = (e: ApiError) => {
    if (e.code === "RIGHTS_NOT_CONFIRMED") setWarn(true);
    if (e.code === "UNSUPPORTED_FORMAT" || e.code === "FILE_TOO_LARGE") {
      projectRef.current = null;
      setFileError(e.code);
      return;
    }
    if (e.code === "SOURCE_NOT_UPLOADED") projectRef.current = null;
    setError(e);
  };

  const start = async () => {
    if (busy) return;
    setError(null);
    if (!file) {
      setFileError("NO_FILE");
      return;
    }
    if (!rights || !license) {
      setWarn(true);
      return;
    }
    // 길이·언어·유형·파일이 바뀌었으면 새 작업물(서버 값은 생성 때 고정)
    const key = [type, lang, len, mime, file.name, file.size, file.lastModified].join("|");
    if (keyRef.current !== key) projectRef.current = null;
    let projectId = projectRef.current;
    if (!projectId) {
      setPhase("creating");
      const created = await postJson<{ projectId: string; upload: { signedUrl: string } }>("/api/projects", {
        type,
        lang,
        length: len,
        mimeType: mime,
        size: file.size,
      });
      if (!created.ok) {
        setPhase("idle");
        fail(created.error);
        return;
      }
      setPhase("uploading");
      setPct(0);
      const ok = await uploadSigned(created.data.upload.signedUrl, file, setPct);
      if (!ok) {
        setPhase("idle");
        setError({ status: 0, code: "UPLOAD_FAILED", message: "" });
        return;
      }
      projectId = created.data.projectId;
      projectRef.current = projectId;
      keyRef.current = key;
    }
    setPhase("starting");
    const res = await postJson<{ jobId: string }>(`/api/projects/${projectId}/analyze`, {
      rightsConfirmed: true,
      licenseType: license,
    });
    if (res.ok || res.error.code === "JOB_ALREADY_RUNNING" || res.error.code === "INVALID_STATE") {
      router.push(`/studio/${projectId}/analyzing`);
      return;
    }
    setPhase("idle");
    fail(res.error);
  };

  const label =
    phase === "creating"
      ? "준비하는 중..."
      : phase === "uploading"
        ? `올리는 중 ${pct}%`
        : phase === "starting"
          ? "분석 시작하는 중..."
          : "분석 시작 (크레딧 1)";

  return (
    <main className="mx-auto w-full max-w-[60rem] px-5">
      <Hero className="pt-7" />
      <div className="mx-auto max-w-[32.5rem] pt-2 pb-20">
        <div className="text-center">
          <Link href="/" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-sub">
            ← {type === "video" ? "영상형" : "대본형"} · 유형 바꾸기
          </Link>
        </div>
        <p className="mt-2 text-center text-caption text-sub">
          길이·언어를 고른 뒤 맨 아래에서 영상을 고르세요. PC는 화면 어디에나 끌어다 놓아도 돼요.
        </p>
        {src && (
          <div className="mt-[1.125rem] flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
            <span className="aspect-[9/16] w-11 flex-none rounded-md" style={{ background: src.bg }} />
            <div>
              <b className="block text-sm">레이더 소재 · {src.title}</b>
              <span className="text-xs text-sub">
                {src.channel} · {src.views} · 원본 댓글 20개를 불러왔어요
              </span>
            </div>
          </div>
        )}

        <span className={lbl}>길이</span>
        <div className="flex flex-wrap gap-2">
          {LEN_CHIPS.map((c) => (
            <Chip key={c.v} selected={len === c.v} disabled={busy} onClick={() => setLen(c.v)} className="min-h-10 px-4">
              {c.l} <small className="text-xs font-medium text-sub">{c.s}</small>
            </Chip>
          ))}
        </div>
        <span className={lbl}>언어</span>
        <div className="flex flex-wrap gap-2">
          {LANG_CHIPS.map((c) => (
            <Chip key={c.v} selected={lang === c.v} disabled={busy} onClick={() => setLang(c.v)} className="min-h-10 px-4">
              {c.l}
              {c.n && <span className="rounded-[0.3125rem] bg-pink px-[0.3125rem] py-px text-2xs text-text">NEW</span>}
            </Chip>
          ))}
        </div>
        <label htmlFor="cmt" className={lbl}>
          참고할 원본 댓글 <small className="font-medium text-sub">(선택)</small>
          {src && (
            <span className="ml-2 inline-block rounded-full border border-brand px-2 py-px align-middle text-xs font-bold text-brand">
              레이더에서 자동 채움
            </span>
          )}
        </label>
        <textarea
          id="cmt"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="원본 영상의 댓글을 붙여넣으면 대본·댓글 반응에 참고해요"
          className="min-h-[4.75rem] w-full resize-y rounded-xl border border-line bg-panel p-3 text-sm text-text placeholder:text-sub"
        />
        <p className="mt-2 text-caption text-sub">
          레이더 소재로 시작하면 원본 댓글을 자동으로 채워요. 직접 고치거나 지워도 돼요.
        </p>
        <span className={lbl}>
          스타일 프리셋 <small className="font-medium text-sub">(생성 후에도 바꿀 수 있어요)</small>
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_CHIPS.map((c) => (
            <Chip key={c.v} selected={preset === c.v} disabled={busy} onClick={() => setPreset(c.v)} className="min-h-10 px-4">
              {c.l}
            </Chip>
          ))}
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-brand/20 bg-brand/5 p-3.5 text-caption">
          <input
            type="checkbox"
            checked={rights}
            disabled={busy}
            onChange={() => {
              setRights(!rights);
              setWarn(false);
            }}
            className="mt-0.5 size-[1.125rem] flex-none accent-brand"
          />
          <span>
            이 영상을 편집·게시할 권리가 있어요{" "}
            <small className="mt-1 block text-caption text-sub">
              직접 촬영했거나, 원작자에게 허락을 받았거나, 라이선스가 있는 영상만 올려 주세요. 원본 출처는 작업에 기록돼요.
            </small>
          </span>
        </label>
        <span className="mt-4 mb-2.5 block text-sm font-bold">권리 유형</span>
        <div className="flex flex-wrap gap-2">
          {LICENSE_CHIPS.map((c) => (
            <Chip
              key={c.v}
              selected={license === c.v}
              disabled={busy}
              onClick={() => {
                setLicense(c.v);
                setWarn(false);
              }}
              className="min-h-10 px-4"
            >
              {c.l}
            </Chip>
          ))}
        </div>
        {warn && (
          <p role="alert" className="mt-2 text-caption text-danger">
            {errorText("RIGHTS_NOT_CONFIRMED")}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "mt-5 w-full cursor-pointer rounded-2xl border-[0.09375rem] border-dashed border-line bg-panel px-4 py-10 text-center text-text transition-[transform,filter] hover:-translate-y-[0.0625rem] hover:brightness-[1.18] active:scale-[0.96]",
            busy && "cursor-not-allowed opacity-55",
            fileError && "border-danger",
          )}
        >
          <span aria-hidden className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-cta text-bg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="block text-base font-bold">{file ? "다른 영상 고르기" : "눌러서 원본 영상 고르기"}</span>
          <span className="mt-1 block text-caption text-sub">(PC는 화면 어디에나 끌어다 놓아도 돼요)</span>
          <span className="my-2.5 flex flex-wrap justify-center gap-1.5">
            {["MP4", "MOV", "WebM", "최대 3분", "최대 500MB"].map((f) => (
              <em key={f} className="rounded-md bg-card2 px-2 py-0.5 text-xs font-bold text-text not-italic">
                {f}
              </em>
            ))}
          </span>
          <span className="block text-caption text-sub">고르면 제목·대본·컷 편집까지 알아서 만들어요</span>
        </button>
        {fileError && (
          <div className="mt-3">
            <Message title="이 영상은 올릴 수 없어요" code={fileError === "NO_FILE" ? undefined : fileError}>
              {fileError === "NO_FILE" ? "먼저 원본 영상을 골라 주세요." : errorText(fileError)}
            </Message>
          </div>
        )}
        {file && !fileError && (
          <p className="mt-3 text-center text-caption text-text/85">
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
          </p>
        )}
        {phase === "uploading" && (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-xs text-sub">
              <span>영상 올리는 중</span>
              <b className="font-black text-brand">{pct}%</b>
            </div>
            <Progress value={pct} label="업로드 진행률" />
          </div>
        )}
        {error && (
          <div className="mt-3">
            <Message
              title={error.code === "INSUFFICIENT_CREDITS" ? "크레딧이 부족해요" : "시작하지 못했어요"}
              code={error.code === "UPLOAD_FAILED" ? undefined : error.code}
            >
              {error.code === "UPLOAD_FAILED" ? "업로드가 끊겼어요. 다시 시도해 주세요." : errorText(error.code)}
            </Message>
            {error.code === "INSUFFICIENT_CREDITS" && (
              <div className="mt-2 text-center">
                <Link href="/me" className="inline-flex min-h-10 items-center rounded-xl bg-cta px-4 text-sm font-black text-bg">
                  크레딧 충전
                </Link>
              </div>
            )}
          </div>
        )}
        <Btn variant="cta" size="lg" loading={busy} onClick={start} className="mt-5 w-full">
          {label}
        </Btn>
      </div>
    </main>
  );
}
