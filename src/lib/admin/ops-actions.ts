"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

export async function listBuddies() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data } = await db.from("buddy_profiles")
    .select("id, vetting, skills, bank_name, bank_account_number, created_at, profiles!buddy_profiles_id_fkey(full_name, email, phone)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function setBuddyVetting(buddyId: string, vetting: "approved" | "rejected" | "suspended" | "under_review") {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
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
