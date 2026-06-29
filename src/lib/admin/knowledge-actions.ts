"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { DEFAULT_KNOWLEDGE, KNOWLEDGE_SETTING_KEY, getKnowledgeBase } from "@/lib/support/knowledge";

/** Admin → Knowledge Base. Stored in app_settings (service-role writes only). */

export async function getKnowledgeForAdmin() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const text = await getKnowledgeBase();
  return { text, isDefault: text === DEFAULT_KNOWLEDGE };
}

export async function saveKnowledge(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const text = String(formData.get("text") || "").trim();
  if (!text) return { error: "Knowledge base cannot be empty. Use Reset to restore the default instead." };
  if (text.length > 20000) return { error: "Too long — keep it under 20,000 characters so replies stay fast." };
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({
    key: KNOWLEDGE_SETTING_KEY,
    value: { text },
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "update_knowledge_base", detail: { chars: text.length } });
  revalidatePath("/admin/knowledge");
  return { error: "", saved: true };
}

export async function resetKnowledge(_prev: unknown, _formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { error } = await db.from("app_settings").delete().eq("key", KNOWLEDGE_SETTING_KEY);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "reset_knowledge_base", detail: {} });
  revalidatePath("/admin/knowledge");
  return { error: "", saved: true };
}
