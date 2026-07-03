"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

// Tasks assigned to me (RLS: assigned_buddy_id = auth.uid()).
export async function listMyTasks() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id, title, status, urgency, buddy_payout_ngn, recipient_address, created_at, service_types(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// My buddy profile (bank details etc).
export async function getMyBuddyProfile() {
  const supabase = createClient();
  const { data } = await supabase.from("buddy_profiles").select("*").single();
  return data ?? null;
}

// Save my payout/bank details (RLS: id = auth.uid()).
export async function savePayoutDetails(_prev: unknown, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buddy") return { error: "Only buddies can edit payout details." };
  const supabase = createClient();
  const payload = {
    id: profile.id,
    bank_name: String(formData.get("bank_name") || ""),
    bank_account_number: String(formData.get("bank_account_number") || ""),
    bank_account_name: String(formData.get("bank_account_name") || ""),
  };
  const { error } = await supabase.from("buddy_profiles").upsert(payload);
  if (error) return { error: error.message };
  revalidatePath("/buddy/settings");
  return { error: "", saved: true };
}

export async function updateBuddySkills(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const skills = String(formData.get("skills") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const supabase = createClient();
  const { error } = await supabase.from("buddy_profiles").upsert({ id: p.id, skills });
  if (error) return { error: error.message };
  revalidatePath("/buddy/profile");
  return { error: "", saved: true };
}

/** Buddy edits their own profile details. Only fields a buddy may safely change
 *  are accepted here — identity/verification fields (NIN, DOB, documents,
 *  vetting status) are intentionally NOT editable. */
export async function updateBuddyDetails(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const g = (k: string) => String(formData.get(k) || "").trim();
  const coverage = g("coverage_areas").split(",").map((s) => s.trim()).filter(Boolean);

  const update: Record<string, unknown> = {
    id: p.id,
    city: g("city") || null,
    state: g("state") || null,
    lga: g("lga") || null,
    occupation: g("occupation") || null,
    experience: g("experience") || null,
    availability: g("availability") || null,
    coverage_areas: coverage.length ? coverage : null,
    has_smartphone: formData.get("has_smartphone") === "on",
    can_drive: formData.get("can_drive") === "on",
  };
  const supabase = createClient();
  const { error } = await supabase.from("buddy_profiles").upsert(update);
  if (error) return { error: error.message };
  revalidatePath("/buddy/profile");
  return { error: "", saved: true };
}
