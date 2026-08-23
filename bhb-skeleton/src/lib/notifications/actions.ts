"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function listMyNotifications() {
  const supabase = createClient(); // RLS: own only
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}
export async function getUnreadCount() {
  const supabase = createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
  return count ?? 0;
}
export async function markRead(id: string) {
  if (!id) return { error: "Missing id." };
  const supabase = createClient(); // RLS: update own
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("read", false);
  revalidatePath("/client/notifications"); revalidatePath("/buddy/notifications"); revalidatePath("/admin/notifications");
  return { error: error?.message ?? "" };
}
export async function markAllRead() {
  const supabase = createClient(); // RLS: update own
  await supabase.from("notifications").update({ read: true }).eq("read", false);
  revalidatePath("/client/notifications"); revalidatePath("/buddy/notifications"); revalidatePath("/admin/notifications");
  return { error: "" };
}

/** Mark read any of the current user's unread notifications whose `link` matches
 *  the given path. Called when the user opens the underlying item elsewhere, so
 *  the notification and its unread count stay in sync automatically. */
export async function markReadByLink(link: string) {
  if (!link) return { error: "" };
  const supabase = createClient(); // RLS: update own
  // Match the exact link, or any link that starts with this path (e.g. a hash
  // or query suffix like "/admin/buddies#<id>"), so opening the item clears it.
  const base = link.split(/[#?]/)[0];
  await supabase.from("notifications").update({ read: true })
    .eq("read", false)
    .or(`link.eq.${base},link.like.${base}#%,link.like.${base}?%`);
  revalidatePath("/client/notifications"); revalidatePath("/buddy/notifications"); revalidatePath("/admin/notifications");
  return { error: "" };
}
