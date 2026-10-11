"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

/**
 * Admin-only no-code config: service_types + regions.
 *
 * Pattern (used for every admin write):
 *  1. Verify the caller is an admin (server-side — never trust the client).
 *  2. Use the service-role client to perform the write.
 *  3. revalidate the page so fresh data shows.
 *
 * RLS already restricts these tables to admin writes, but we double-check the
 * role here too: defense in depth, and it gives a clean error instead of a
 * silent RLS rejection.
 */
async function assertAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Not authorized.");
  }
}

// ---------- SERVICE TYPES ----------
export async function listServiceTypes() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveServiceType(input: {
  id?: string;
  name: string;
  base_price_ngn: number;
  default_buddy_payout_pct: number;
  pricing_mode?: string;
  from_price_usd?: number;
  active?: boolean;
  /** Exposure level, independent of skill. Decides which buddies may be offered it. */
  trust_tier?: "standard" | "high_value" | "safeguarding";
  /** True where the buddy would otherwise receive client funds. Pay the vendor direct instead. */
  handles_cash?: boolean;
  /** Completed tasks a buddy needs before this service type may be offered to them. */
  min_completed_tasks?: number;
}) {
  await assertAdmin();
  const db = createAdminClient();
  const row = {
    name: input.name,
    base_price_ngn: input.base_price_ngn,
    default_buddy_payout_pct: input.default_buddy_payout_pct,
    pricing_mode: input.pricing_mode === "from" ? "from" : "quote",
    from_price_usd: Number(input.from_price_usd ?? 0),
    active: input.active ?? true,
    trust_tier: ["standard", "high_value", "safeguarding"].includes(String(input.trust_tier))
      ? input.trust_tier : "standard",
    handles_cash: Boolean(input.handles_cash),
    // Clamped to the DB constraint so a typo cannot throw at the database.
    min_completed_tasks: Math.min(500, Math.max(0, Math.round(Number(input.min_completed_tasks ?? 0)))),
  };
  if (input.id) {
    const { error } = await db.from("service_types").update(row).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("service_types").insert(row);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/services");
}

// ---------- ZONE-B UPLIFT (global pricing setting) ----------
export async function getZoneUpliftPct(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "pricing_zone_b_uplift_pct").maybeSingle();
  const pct = Number((data?.value as any)?.pct);
  return Number.isFinite(pct) && pct >= 0 ? pct : 25;
}

export async function getUrgentSurchargePct(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "pricing_urgent_surcharge_pct").maybeSingle();
  const pct = Number((data?.value as any)?.pct);
  return Number.isFinite(pct) && pct >= 0 ? pct : 40;
}

export async function saveUrgentSurchargePct(pct: number) {
  await assertAdmin();
  if (!Number.isFinite(pct) || pct < 0 || pct > 200) throw new Error("Surcharge must be between 0 and 200%.");
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({
    key: "pricing_urgent_surcharge_pct",
    value: { pct },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
}

export async function saveZoneUpliftPct(pct: number) {
  await assertAdmin();
  if (!Number.isFinite(pct) || pct < 0 || pct > 200) throw new Error("Uplift must be between 0 and 200%.");
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({
    key: "pricing_zone_b_uplift_pct",
    value: { pct },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
}

export async function deleteServiceType(id: string) {
  await assertAdmin();
  const db = createAdminClient();
  // Soft-disable rather than hard-delete (historical requests may reference it).
  const { error } = await db.from("service_types").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
}

// ---------- REGIONS ----------
export async function listRegions() {
  const supabase = createClient();
  const { data, error } = await supabase.from("regions").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveRegion(input: { id?: string; name: string; state?: string; zone?: string; active?: boolean }) {
  await assertAdmin();
  const db = createAdminClient();
  const zone = input.zone === "A" ? "A" : "B";
  if (input.id) {
    const { error } = await db.from("regions").update({
      name: input.name, state: input.state ?? null, zone, active: input.active ?? true,
    }).eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("regions").insert({
      name: input.name, state: input.state ?? null, zone, active: input.active ?? true,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/regions");
}

export async function deleteRegion(id: string) {
  await assertAdmin();
  const db = createAdminClient();
  const { error } = await db.from("regions").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/regions");
}

// ---------- OFFER MODE (the safety valve) ----------

export async function getOfferModeSetting(): Promise<"off" | "advisory" | "automatic"> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "offer_mode").maybeSingle();
  const m = (data?.value as any)?.mode;
  return m === "off" || m === "automatic" ? m : "advisory";
}

/**
 * Switch how task offers behave.
 *
 * Moving to "automatic" is the consequential one: from then on a paid task
 * cascades down the shortlist on its own and expires unanswered offers. Only
 * worth doing once the delivery records show buddies are actually receiving
 * alerts, otherwise offers expire unseen and everything lands back in the
 * admin queue anyway, with extra steps.
 */
export async function setOfferMode(mode: "off" | "advisory" | "automatic") {
  await assertAdmin();
  if (!["off", "advisory", "automatic"].includes(mode)) throw new Error("Unknown offer mode.");
  const db = createAdminClient();
  const { error } = await db
    .from("app_settings")
    .upsert({ key: "offer_mode", value: { mode }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  await db.from("audit_log").insert({ action: "set_offer_mode", detail: { mode } });
  revalidatePath("/admin/services");
  revalidatePath("/admin/requests");
}
