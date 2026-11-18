import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  cancelFail,
  createProjectFail,
  fail,
  startAnalyzeFail,
  type Fail,
  type NewProjectInput,
} from "@/server/projects-rules";

// 작업물 생성·분석 시작·취소(task-006a). 사용자 세션(RLS)으로 DB definer 함수만 호출한다(service_role 없음).
// 소유·승인·권리·한도·크레딧 차감·큐 투입 판정은 모두 DB(studio.create_project·start_analyze·cancel_analyze)가 한다.

export const SOURCE_BUCKET = "sources";

export type CreatedProject = {
  ok: true;
  projectId: string;
  /** Storage 업로드 대상. 클라이언트는 storage.from(bucket).uploadToSignedUrl(path, token, file) */
  upload: { bucket: string; path: string; token: string; signedUrl: string };
};

type DbResult = { result?: unknown; project_id?: unknown; source_path?: unknown; job_id?: unknown };

const dbFail = () => fail(500, "UPSTREAM_ERROR", "잠시 후 다시 시도해 주세요.");

/** 작업물 생성 + 원본 서명 업로드 URL(Supabase 고정 유효시간 2시간, 덮어쓰기 불가) */
export async function createProject(input: NewProjectInput): Promise<CreatedProject | Fail> {
  const sb = await createClient();
  const { data, error } = await sb.schema("studio").rpc("create_project", {
    p_type: input.type,
    p_lang: input.lang,
    p_length: input.length,
    p_ext: input.ext,
  });
  if (error) {
    console.error("[projects] create_project 실패", error.code ?? "");
    return dbFail();
  }
  const r = (data ?? {}) as DbResult;
  if (r.result !== "ok" || typeof r.project_id !== "string" || typeof r.source_path !== "string") {
    return createProjectFail(r.result);
  }

  const { data: signed, error: signError } = await sb.storage.from(SOURCE_BUCKET).createSignedUploadUrl(r.source_path);
  if (signError || !signed) {
    console.error("[projects] 서명 업로드 URL 실패", signError?.message ?? "");
    return fail(502, "UPSTREAM_ERROR", "업로드 준비에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
  return {
    ok: true,
    projectId: r.project_id,
    upload: { bucket: SOURCE_BUCKET, path: signed.path, token: signed.token, signedUrl: signed.signedUrl },
  };
}

/** 분석 시작. license = null이면 권리 미확인(DB가 RIGHTS_NOT_CONFIRMED + 정책 기록) */
export async function startAnalyze(projectId: string, license: string | null): Promise<{ ok: true; jobId: string } | Fail> {
  const sb = await createClient();
  const { data, error } = await sb.schema("studio").rpc("start_analyze", { p_project: projectId, p_license: license });
  if (error) {
    console.error("[projects] start_analyze 실패", error.code ?? "");
    return dbFail();
  }
  const r = (data ?? {}) as DbResult;
  const jobId = typeof r.job_id === "string" ? r.job_id : undefined;
  if (r.result === "ok" && jobId) return { ok: true, jobId };
  return startAnalyzeFail(r.result, jobId);
}

/** 분석 취소(3단계 시작 전만, 크레딧 환불) */
export async function cancelJob(jobId: string): Promise<{ ok: true } | Fail> {
  const sb = await createClient();
  const { data, error } = await sb.schema("studio").rpc("cancel_analyze", { p_job: jobId });
  if (error) {
    console.error("[projects] cancel_analyze 실패", error.code ?? "");
    return dbFail();
  }
  return data === "ok" ? { ok: true } : cancelFail(data);
}
