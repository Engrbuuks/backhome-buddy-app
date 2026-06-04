"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

export async function getUsdRate(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "fx_usd_ngn").single();
  return Number((data?.value as any)?.rate ?? 1500);
}
export async function setUsdRate(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const rate = Number(formData.get("rate"));
  if (!(rate > 0)) return { error: "Enter a valid rate (₦ per $1)." };
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({ key: "fx_usd_ngn", value: { rate }, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "set_fx_rate", detail: { rate } });
  revalidatePath("/admin/fx");
  return { error: "", saved: true };
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
