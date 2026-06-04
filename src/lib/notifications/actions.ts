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
export async function markAllRead() {
  const supabase = createClient(); // RLS: update own
  await supabase.from("notifications").update({ read: true }).eq("read", false);
  revalidatePath("/client/notifications"); revalidatePath("/buddy/notifications"); revalidatePath("/admin/notifications");
  return { error: "" };
}
