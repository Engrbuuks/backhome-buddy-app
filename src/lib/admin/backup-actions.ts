"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

const TABLES = [
  "profiles", "buddy_profiles", "service_types", "regions", "requests",
  "quote_items", "proofs", "payments", "payouts", "refunds", "transactions",
  "disputes", "saved_recipients", "request_timeline", "audit_log", "app_settings",
] as const;

/** Dump all critical tables as one JSON snapshot (service-role read).
 *  This is the free-tier backup: download it and keep it somewhere safe. */
export async function exportBackup() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized.", data: null as string | null };
  const db = createAdminClient();
  const snapshot: Record<string, unknown> = {
    _meta: { exported_at: new Date().toISOString(), by: p.id, app: "backhome-buddy" },
  };
  for (const table of TABLES) {
    const { data, error } = await db.from(table).select("*");
    if (error) return { error: `${table}: ${error.message}`, data: null };
    snapshot[table] = data ?? [];
  }
  await db.from("audit_log").insert({ actor_id: p.id, action: "export_backup" });
  return { error: "", data: JSON.stringify(snapshot) };
}
