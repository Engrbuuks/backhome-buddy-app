"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { ALL_QUESTIONS, isHonesty } from "@/lib/admin/interview-catalog";
import { summarize } from "@/lib/admin/competency-helpers";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

export type AnswerMap = Record<string, { score?: number; note?: string }>;

export type InterviewData = {
  id: string;
  recruit_id: string | null;
  buddy_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  status: string;
  answers: AnswerMap;
  proof_test_score: number | null;
  proof_test_note: string | null;
  comp_property: number | null; comp_welfare: number | null; comp_documents: number | null;
  comp_purchases: number | null; comp_communication: number | null; comp_reliability: number | null;
  coverage_note: string | null; specialisms: string | null; concerns: string | null;
  approved_task_types: string[] | null;
  overall_score: number | null; decision: string | null;
  created_at: string; completed_at: string | null;
};

/** Get the open interview for a candidate, or create one. `who` identifies the
 *  person: either a recruit or a buddy (profile) id. */
export async function startOrGetInterview(who: { recruitId?: string; buddyId?: string; name?: string; email?: string }) {
  const p = await admin(); if (!p) return { error: "Not authorized.", interview: null as any };
  const db = createAdminClient();

  // Look for an existing in-progress interview for this person.
  let q = db.from("interviews").select("*").eq("status", "in_progress").order("created_at", { ascending: false }).limit(1);
  if (who.buddyId) q = q.eq("buddy_id", who.buddyId);
  else if (who.recruitId) q = q.eq("recruit_id", who.recruitId);
  const { data: existing } = await q.maybeSingle();
  if (existing) return { error: "", interview: existing as InterviewData };

  const { data: created, error } = await db.from("interviews").insert({
    recruit_id: who.recruitId ?? null,
    buddy_id: who.buddyId ?? null,
    candidate_name: who.name ?? null,
    candidate_email: who.email ?? null,
    interviewer_id: p.id,
    answers: {},
  }).select("*").single();
  if (error) return { error: error.message, interview: null as any };
  return { error: "", interview: created as InterviewData };
}

/** Save interview progress (autosave-friendly). */
export async function saveInterview(id: string, patch: Partial<InterviewData>) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const allowed: any = {};
  for (const k of ["answers", "proof_test_score", "proof_test_note", "comp_property", "comp_welfare",
    "comp_documents", "comp_purchases", "comp_communication", "comp_reliability", "coverage_note",
    "specialisms", "concerns", "approved_task_types", "overall_score", "decision"]) {
    if (k in patch) allowed[k] = (patch as any)[k];
  }
  const { error } = await db.from("interviews").update(allowed).eq("id", id);
  if (error) return { error: error.message };
  return { error: "" };
}

/** Compute overall score + suggested decision — see competency-helpers. */

/** Complete the interview: mark done and SYNC competency into the buddy profile
 *  (if this is a buddy), so the task-fit matcher immediately benefits. */
export async function completeInterview(id: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: iv } = await db.from("interviews").select("*").eq("id", id).maybeSingle();
  if (!iv) return { error: "Interview not found." };

  const s = summarize((iv.answers as AnswerMap) || {}, iv.proof_test_score);
  const decision = iv.decision || s.decision;

  await db.from("interviews").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    overall_score: iv.overall_score ?? s.overall,
    decision,
  }).eq("id", id);

  // Sync competency into the buddy profile so matching uses it right away.
  if (iv.buddy_id) {
    await db.from("buddy_profiles").update({
      proof_test_score: iv.proof_test_score,
      comp_property: iv.comp_property, comp_welfare: iv.comp_welfare,
      comp_documents: iv.comp_documents, comp_purchases: iv.comp_purchases,
      comp_communication: iv.comp_communication, comp_reliability: iv.comp_reliability,
      competency_specialisms: iv.specialisms, competency_notes: iv.concerns,
      approved_task_types: iv.approved_task_types,
      competency_assessed_at: new Date().toISOString(),
      competency_assessed_by: p.id,
    }).eq("id", iv.buddy_id);
  }

  revalidatePath("/admin/buddies");
  revalidatePath("/admin/recruitment");
  revalidatePath(`/admin/interview/${id}`);
  return { error: "", decision };
}

/** Past interviews for a candidate (reopen/review). */
export async function listInterviews(who: { recruitId?: string; buddyId?: string }) {
  const p = await admin(); if (!p) return [];
  const db = createAdminClient();
  let q = db.from("interviews").select("id, status, overall_score, decision, created_at, completed_at").order("created_at", { ascending: false });
  if (who.buddyId) q = q.eq("buddy_id", who.buddyId);
  else if (who.recruitId) q = q.eq("recruit_id", who.recruitId);
  const { data } = await q;
  return data ?? [];
}

export async function getInterview(id: string): Promise<InterviewData | null> {
  const p = await admin(); if (!p) return null;
  const db = createAdminClient();
  const { data } = await db.from("interviews").select("*").eq("id", id).maybeSingle();
  return (data as InterviewData) ?? null;
}
