"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { VETTING_CHECKS } from "@/lib/admin/vetting-checks";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

export async function listBuddies() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data } = await db.from("buddy_profiles")
    .select("id, vetting, skills, bank_name, bank_account_number, bank_account_name, created_at, city, date_of_birth, nin, address, state, lga, coverage_areas, occupation, experience, availability, has_smartphone, can_drive, has_drivers_license, criminal_record, criminal_record_details, consent_background_checks, consent_data_processing, guarantors, next_of_kin, id_doc_type, id_doc_path, utility_bill_path, pcc_path, vetting_checks, vetting_notes, profiles!buddy_profiles_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: false });
  const buddies = data ?? [];
  // Short-lived signed URLs for vetting documents (admin-only view).
  const paths = buddies.flatMap((b: any) => [b.id_doc_path, b.utility_bill_path, b.pcc_path]).filter(Boolean) as string[];
  if (paths.length) {
    const { data: signed } = await db.storage.from("vetting").createSignedUrls(paths, 3600);
    const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const b of buddies as any[]) {
      b.id_doc_url = b.id_doc_path ? urlOf.get(b.id_doc_path) : undefined;
      b.utility_bill_url = b.utility_bill_path ? urlOf.get(b.utility_bill_path) : undefined;
      b.pcc_url = b.pcc_path ? urlOf.get(b.pcc_path) : undefined;
    }
  }
  return buddies;
}

export async function updateVettingCheck(buddyId: string, key: string, value: boolean) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  if (!VETTING_CHECKS.some(([k]) => k === key)) return { error: "Unknown check." };
  const db = createAdminClient();
  const { data: row } = await db.from("buddy_profiles").select("vetting_checks").eq("id", buddyId).maybeSingle();
  const checks = { ...(row?.vetting_checks ?? {}), [key]: value };
  const { error } = await db.from("buddy_profiles").update({ vetting_checks: checks }).eq("id", buddyId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "vetting_check", target_id: buddyId, detail: { key, value } });
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export async function saveVettingNotes(buddyId: string, notes: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").update({ vetting_notes: notes.slice(0, 4000) }).eq("id", buddyId);
  if (error) return { error: error.message };
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export async function setBuddyVetting(buddyId: string, vetting: "approved" | "rejected" | "suspended" | "under_review") {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  if (vetting === "approved") {
    // Approval is the RESULT of completed checks, not a shortcut around them.
    const { data: row } = await db.from("buddy_profiles").select("vetting_checks").eq("id", buddyId).maybeSingle();
    const checks = (row?.vetting_checks ?? {}) as Record<string, boolean>;
    const missing = VETTING_CHECKS.filter(([k]) => !checks[k]).map(([, label]) => label);
    if (missing.length) return { error: `Cannot approve yet — outstanding checks: ${missing.join("; ")}.` };
  }
  const { error } = await db.from("buddy_profiles").update({ vetting }).eq("id", buddyId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "set_buddy_vetting", target_id: buddyId, detail: { vetting } });
  revalidatePath("/admin/buddies");
  return { error: "" };
}

/** Buddies may exist only as profiles.role=buddy without a buddy_profiles row (manual role flip). Surface those too. */
export async function listBuddyProfilesMissing() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data: roles } = await db.from("profiles").select("id, full_name, email").eq("role", "buddy");
  const { data: bps } = await db.from("buddy_profiles").select("id");
  const have = new Set((bps ?? []).map((b) => b.id));
  return (roles ?? []).filter((r) => !have.has(r.id));
}

export async function createBuddyProfileRow(profileId: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").insert({ id: profileId, vetting: "under_review" });
  if (error) return { error: error.message };
  revalidatePath("/admin/buddies");
  return { error: "" };
}

export async function listLedger() {
  if (!(await admin())) return [];
  const db = createAdminClient(); // transactions is service-role-only by design
  const { data } = await db.from("transactions")
    .select("id, kind, amount_ngn, note, created_at, requests(title)")
    .order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}

export async function listRequestsByStatus(statuses: string[]) {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data } = await db.from("requests")
    .select("id, title, status, client_price_ngn, buddy_payout_ngn, created_at, profiles!requests_client_id_fkey(full_name)")
    .in("status", statuses).order("created_at", { ascending: false });
  return data ?? [];
}
