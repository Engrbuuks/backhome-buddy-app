"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { CURRENCIES, DEFAULT_RATES, isCurrency, type Currency, type RateMap } from "@/lib/money/currency";

/** All display-currency rates (NGN per 1 unit). NGN is always 1. */
export async function getRates(): Promise<RateMap> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "fx_rates").maybeSingle();
  const stored = (data?.value as any)?.rates || {};
  const out = { ...DEFAULT_RATES } as RateMap;
  for (const c of CURRENCIES) if (Number(stored[c]) > 0) out[c] = Number(stored[c]);
  out.NGN = 1;
  return out;
}

export async function setRates(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const rates: Partial<RateMap> = {};
  for (const c of CURRENCIES) {
    if (c === "NGN") continue;
    const v = Number(formData.get(`rate_${c}`));
    if (!(v > 0)) return { error: `Enter a valid rate for ${c} (₦ per 1 ${c}).` };
    rates[c] = v;
  }
  (rates as RateMap).NGN = 1;
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({ key: "fx_rates", value: { rates }, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "set_fx_rates", detail: rates });
  revalidatePath("/admin/fx");
  return { error: "", saved: true };
}

/** Bank details per currency, shown on invoices. */
export type BankDetail = { bank_name: string; account_name: string; account_number: string; extra?: string };
export async function getBankDetails(): Promise<Partial<Record<Currency, BankDetail>>> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "bank_details").maybeSingle();
  return ((data?.value as any)?.banks || {}) as Partial<Record<Currency, BankDetail>>;
}

export async function setBankDetails(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const banks: Partial<Record<Currency, BankDetail>> = {};
  for (const c of CURRENCIES) {
    const bank_name = String(formData.get(`bank_${c}_name`) || "").trim();
    const account_name = String(formData.get(`bank_${c}_account_name`) || "").trim();
    const account_number = String(formData.get(`bank_${c}_account_number`) || "").trim();
    const extra = String(formData.get(`bank_${c}_extra`) || "").trim();
    // Only store a currency's block if at least the account number is present.
    if (account_number) banks[c] = { bank_name, account_name, account_number, extra: extra || undefined };
  }
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({ key: "bank_details", value: { banks }, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "set_bank_details", detail: { currencies: Object.keys(banks) } });
  revalidatePath("/admin/fx");
  return { error: "", saved: true };
}

/** A client's admin-set preferred display currency (default USD if unset). */
export async function setClientCurrency(clientId: string, currency: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  if (!isCurrency(currency)) return { error: "Invalid currency." };
  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ preferred_currency: currency }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  return { error: "" };
}

/** The current client's own currency toggle (self-service). */
export async function setMyCurrency(currency: string) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  if (!isCurrency(currency)) return { error: "Invalid currency." };
  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ preferred_currency: currency }).eq("id", p.id);
  if (error) return { error: error.message };
  revalidatePath("/client/dashboard");
  return { error: "" };
}

// ---- legacy single-USD-rate helpers kept for anything still importing them ----
export async function getUsdRate(): Promise<number> {
  const rates = await getRates();
  return rates.USD;
}

/** Resolve the currency a given client should see (their preference, else USD),
 *  together with the current rate map. One call for client-facing pages. */
export async function getClientDisplay(clientId?: string): Promise<{ currency: Currency; rates: RateMap }> {
  const rates = await getRates();
  let currency: Currency = "USD";
  if (clientId) {
    const db = createAdminClient();
    const { data } = await db.from("profiles").select("preferred_currency").eq("id", clientId).maybeSingle();
    const pref = (data as any)?.preferred_currency;
    if (isCurrency(pref)) currency = pref;
  }
  return { currency, rates };
}

/** For the signed-in client's own pages. */
export async function getMyDisplay(): Promise<{ currency: Currency; rates: RateMap }> {
  const p = await getCurrentProfile();
  return getClientDisplay(p?.id);
}

export async function getAutoReleaseDays(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "auto_release_days").single();
  return Number((data?.value as any)?.days ?? 7);
}
export async function setAutoReleaseDays(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const days = Number(formData.get("days"));
  if (!(days >= 1 && days <= 30)) return { error: "Days must be between 1 and 30." };
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({ key: "auto_release_days", value: { days }, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "set_auto_release_days", detail: { days } });
  revalidatePath("/admin/fx");
  return { error: "", saved: true };
}
