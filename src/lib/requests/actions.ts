"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

/**
 * Request intake (build step 5). No money yet — just creating and listing
 * requests. RLS does the heavy lifting: a client only ever sees/creates their
 * own requests; the admin sees all. These reads go through the session client
 * (RLS-enforced) on purpose — we WANT the database to filter by role.
 */

// Active service types + regions for the client's New Request form dropdowns.
export async function getRequestFormOptions() {
  const supabase = createClient();
  const [{ data: services }, { data: regions }, { data: upliftRow }, { data: urgentRow }] = await Promise.all([
    supabase.from("service_types").select("id, name, base_price_ngn, pricing_mode, from_price_usd").eq("active", true).order("sort_order"),
    supabase.from("regions").select("id, name, state, zone").eq("active", true).order("name"),
    supabase.from("app_settings").select("value").eq("key", "pricing_zone_b_uplift_pct").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "pricing_urgent_surcharge_pct").maybeSingle(),
  ]);
  const pct = Number((upliftRow?.value as any)?.pct);
  const upct = Number((urgentRow?.value as any)?.pct);
  return {
    services: services ?? [],
    regions: regions ?? [],
    zoneBUpliftPct: Number.isFinite(pct) && pct >= 0 ? pct : 25,
    urgentSurchargePct: Number.isFinite(upct) && upct >= 0 ? upct : 40,
  };
}

// Client creates a request. RLS "client creates own request" enforces client_id = self.
export async function createRequest(_prev: unknown, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "client") {
    return { error: "Only clients can submit requests." };
  }
  const supabase = createClient();

  const title = String(formData.get("title") || "").trim().slice(0, 140);
  if (!title) return { error: "Please give your request a short title." };

  const regionRaw = String(formData.get("region_id") || "");
  const isOtherState = regionRaw === "__other__";
  const requestedState = isOtherState ? String(formData.get("requested_state") || "").slice(0, 80).trim() : null;
  if (isOtherState && !requestedState) return { error: "Tell us which state the task is in." };

  const { error } = await supabase.from("requests").insert({
    client_id: profile.id,
    service_type_id: (formData.get("service_type_id") as string) || null,
    region_id: isOtherState ? null : regionRaw || null,
    requested_state: requestedState,
    expectations: String(formData.get("expectations") || "").slice(0, 2000).trim() || null,
    status: "submitted",
    title,
    description: String(formData.get("description") || "").slice(0, 4000),
    urgency: String(formData.get("urgency") || "standard"),
    display_currency: "USD",
    recipient_name: String(formData.get("recipient_name") || "").slice(0, 120),
    recipient_phone: String(formData.get("recipient_phone") || "").slice(0, 32),
    recipient_address: String(formData.get("recipient_address") || "").slice(0, 300),
  });
  if (error) return { error: error.message };

  revalidatePath("/client/dashboard");
  redirect("/client/dashboard");
}

// Client's own requests (RLS auto-filters to theirs).
export async function listMyRequests() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id, title, status, urgency, client_price_ngn, fx_rate, created_at, service_types(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Admin: all requests (RLS "admin reads all requests" allows it).
export async function listAllRequests() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id, title, status, urgency, client_price_ngn, created_at, service_types(name), profiles!requests_client_id_fkey(full_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// One request with its quote items + proofs (RLS scopes who can see it).
export async function getRequestById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("*, service_types(name), quote_items(id, label, amount_ngn), proofs(id, kind, file_url, note, created_at)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}
