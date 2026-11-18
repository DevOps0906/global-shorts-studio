import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/auth";
import { timeLabel } from "@/server/radar";

// 고객문의(task-008). 사용자 세션(RLS)으로 호출 — 본인 문의만 읽고 쓴다.

export const SUPPORT_KINDS = ["bug", "pay", "idea", "etc"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];
export const SUPPORT_BODY_MAX = 5000;

const KIND_LABEL: Record<SupportKind, string> = { bug: "오류 신고", pay: "결제·환불", idea: "기능 제안", etc: "기타" };

export type SupportTicket = { id: number; title: string; meta: string; status: "done" | "wait" };

type Row = { id: number; kind: SupportKind; body: string; status: string; created_at: string };

function toTicket(r: Row): SupportTicket {
  const body = r.body.replace(/\s+/g, " ").trim();
  const title = `[${KIND_LABEL[r.kind] ?? "기타"}] ${body.length > 24 ? `${body.slice(0, 24)}…` : body}`;
  const d = timeLabel(r.created_at)?.split(".").slice(0, 2).join(".") ?? "";
  return { id: r.id, title, meta: `${d} 접수`, status: r.status === "done" ? "done" : "wait" };
}

/** 내 문의 내역(최신순 50건). 실패 시 null(화면은 오류 상태) */
export async function loadMyTickets(): Promise<SupportTicket[] | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema("studio")
    .from("support_tickets")
    .select("id, kind, body, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return null;
  return (data as Row[]).map(toTicket);
}

export type CreateResult =
  | { ok: true; ticket: SupportTicket }
  | { ok: false; status: number; code: string; message: string };

/** 문의 접수. kind·body를 서버에서 검증한다 */
export async function createTicket(kind: unknown, body: unknown): Promise<CreateResult> {
  if (typeof kind !== "string" || !(SUPPORT_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "문의 종류를 선택해 주세요." };
  }
  if (typeof body !== "string" || !body.trim()) {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "문의 내용을 입력해 주세요." };
  }
  if ([...body].length > SUPPORT_BODY_MAX) {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: `문의 내용은 ${SUPPORT_BODY_MAX.toLocaleString("en-US")}자까지 쓸 수 있어요.` };
  }
  const session = await getSession();
  if (!session) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "로그인이 필요해요." };

  const sb = await createClient();
  const { data, error } = await sb
    .schema("studio")
    .from("support_tickets")
    .insert({ user_id: session.user.id, kind, body })
    .select("id, kind, body, status, created_at")
    .single();
  if (error || !data) {
    console.error("[support] 접수 실패", error?.code ?? "");
    return { ok: false, status: 500, code: "UPSTREAM_ERROR", message: "잠시 후 다시 시도해 주세요." };
  }
  return { ok: true, ticket: toTicket(data as Row) };
}
