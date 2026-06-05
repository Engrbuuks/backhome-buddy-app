import { createAdminClient } from "@/lib/supabase/admin";

/** Insert an in-app notification (service-role — users have no insert policy by design). */
export async function notify(userId: string, title: string, body: string, link?: string) {
  const db = createAdminClient();
  await db.from("notifications").insert({ user_id: userId, title, body, link: link ?? null });
}

export async function notifyAdmins(title: string, body: string, link?: string) {
  const db = createAdminClient();
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  if (!admins?.length) return;
  await db.from("notifications").insert(admins.map((a) => ({ user_id: a.id, title, body, link: link ?? null })));
}
