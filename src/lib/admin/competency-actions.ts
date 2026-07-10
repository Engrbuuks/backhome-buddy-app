"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

/** Map a service type name to a competency dimension, so a task can be matched
 *  to the right buddy strength. Extend as your service catalog grows. */
export function taskTypeToDimension(serviceName?: string): keyof CompScores | null {
  const s = (serviceName || "").toLowerCase();
  if (/propert|land|inspect|verif|house|building/.test(s)) return "comp_property";
  if (/welfare|visit|check|family|elder|care/.test(s)) return "comp_welfare";
  if (/document|office|govern|paper|certificate|registrat/.test(s)) return "comp_documents";
  if (/purchase|buy|market|shop|deliver|errand/.test(s)) return "comp_purchases";
  return null;
}

export type CompScores = {
  proof_test_score: number | null;
  comp_property: number | null;
  comp_welfare: number | null;
  comp_documents: number | null;
  comp_purchases: number | null;
  comp_communication: number | null;
  comp_reliability: number | null;
};

export type CompetencyInput = CompScores & {
  competency_specialisms?: string;
  competency_notes?: string;
  approved_task_types?: string[];
};

/** Save a buddy's competency assessment (from the interview scorecard). */
export async function saveCompetency(buddyId: string, input: CompetencyInput) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const clamp = (n: number | null | undefined) => (n == null ? null : Math.max(1, Math.min(5, Math.round(n))));
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").update({
    proof_test_score: clamp(input.proof_test_score),
    comp_property: clamp(input.comp_property),
    comp_welfare: clamp(input.comp_welfare),
    comp_documents: clamp(input.comp_documents),
    comp_purchases: clamp(input.comp_purchases),
    comp_communication: clamp(input.comp_communication),
    comp_reliability: clamp(input.comp_reliability),
    competency_specialisms: input.competency_specialisms?.trim() || null,
    competency_notes: input.competency_notes?.trim() || null,
    approved_task_types: input.approved_task_types?.length ? input.approved_task_types : null,
    competency_assessed_at: new Date().toISOString(),
    competency_assessed_by: p.id,
  }).eq("id", buddyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export type BuddyMatch = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  lga?: string;
  coverage_areas?: string[];
  score: number;          // computed fit score
  reasons: string[];      // why they matched
  approved: boolean;      // cleared for this task type
  proofScore: number | null;
};

/** Rank approved, vetted buddies by fit for a given task (by type + location).
 *  Higher score = better fit. Used on the admin request/assignment screen. */
export async function matchBuddiesForTask(requestId: string): Promise<{ error: string; matches: BuddyMatch[] }> {
  const p = await admin(); if (!p) return { error: "Not authorized.", matches: [] };
  const db = createAdminClient();

  // Load the task + its service type name + location hints.
  const { data: req } = await db
    .from("requests")
    .select("id, title, recipient_address, regions(name), service_types(name)")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { error: "Request not found.", matches: [] };

  const svcName = (req as any).service_types?.name as string | undefined;
  const dim = taskTypeToDimension(svcName);
  const taskTypeKey = dim ? dim.replace("comp_", "") : null; // property|welfare|documents|purchases
  const regionName = (req as any).regions?.name as string | undefined;
  const address = (req as any).recipient_address as string | undefined;
  const loc = { region: regionName, address };

  // Candidate buddies: vetted/approved only.
  const { data: buddies } = await db
    .from("buddy_profiles")
    .select("id, city, state, lga, coverage_areas, approved_task_types, proof_test_score, comp_property, comp_welfare, comp_documents, comp_purchases, comp_communication, comp_reliability, vetting, profiles!buddy_profiles_id_fkey(full_name)")
    .in("vetting", ["approved"]);

  const matches: BuddyMatch[] = [];
  for (const b of (buddies ?? []) as any[]) {
    const reasons: string[] = [];
    let score = 0;

    // 1. Task-type competency (the biggest factor).
    if (dim) {
      const rating = b[dim] as number | null;
      if (rating) { score += rating * 10; reasons.push(`${taskTypeKey} skill ${rating}/5`); }
    }
    // 2. Cleared for this task type?
    const approved = Boolean(taskTypeKey && Array.isArray(b.approved_task_types) && b.approved_task_types.includes(taskTypeKey));
    if (approved) { score += 15; reasons.push("Cleared for this task type"); }

    // 3. Location match (region name / address text vs buddy coverage).
    const cov = (b.coverage_areas || []).map((c: string) => c.toLowerCase());
    const hay = [b.city, b.state, b.lga, ...cov].filter(Boolean).map((x: string) => x.toLowerCase());
    const addrLc = (loc.address || "").toLowerCase();
    const needles = [loc.region].filter((x): x is string => Boolean(x)).map((x) => x.toLowerCase());
    let locHit = false;
    for (const n of needles) {
      if (hay.some((h) => h.includes(n) || n.includes(h))) { locHit = true; break; }
    }
    // Also try: does the recipient address mention any of the buddy's areas?
    if (!locHit && addrLc) {
      if (hay.some((h) => h.length > 2 && addrLc.includes(h))) locHit = true;
    }
    if (locHit) { score += 25; reasons.push("Covers the task area"); }
    else reasons.push("⚠ Location not confirmed");

    // 4. Proof-test gate + soft factors.
    if (b.proof_test_score) {
      if (b.proof_test_score <= 2) { score -= 20; reasons.push(`⚠ Low proof score ${b.proof_test_score}/5`); }
      else { score += b.proof_test_score * 2; }
    }
    if (b.comp_reliability) score += b.comp_reliability;
    if (b.comp_communication) score += b.comp_communication;

    const prof = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    matches.push({
      id: b.id, name: prof?.full_name || "Unnamed buddy",
      city: b.city, state: b.state, lga: b.lga, coverage_areas: b.coverage_areas,
      score, reasons, approved, proofScore: b.proof_test_score ?? null,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return { error: "", matches };
}
