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
