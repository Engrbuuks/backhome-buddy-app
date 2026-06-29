"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { notifyAdmins, notify } from "@/lib/notifications/notify";
import { askClaude } from "@/lib/support/ai";

/** One thread per user: fetch or lazily create. */
export async function getMyThread() {
  const p = await getCurrentProfile();
  if (!p) return null;
  const supabase = createClient();
  const { data: existing } = await supabase.from("chat_threads").select("id").eq("user_id", p.id).limit(1).single();
  let threadId = existing?.id as string | undefined;
  if (!threadId) {
    const { data: created } = await supabase.from("chat_threads").insert({ user_id: p.id }).select("id").single();
    threadId = created?.id;
  }
  if (!threadId) return null;
  const { data: messages } = await supabase.from("chat_messages").select("*").eq("thread_id", threadId).order("created_at");
  return { id: threadId, messages: messages ?? [] };
}

export async function sendChatMessage(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  const content = String(formData.get("content") || "").trim().slice(0, 2000);
  const threadId = String(formData.get("thread_id") || "");
  if (!content || !threadId) return { error: "Type a message." };

  const supabase = createClient(); // RLS enforces thread ownership + sender='user'
  const { count } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).eq("thread_id", threadId);
  const isFirst = (count ?? 0) === 0;
  const { error: insErr } = await supabase.from("chat_messages").insert({ thread_id: threadId, sender: "user", content });
  if (insErr) return { error: insErr.message };

  const db = createAdminClient();
  await db.from("chat_threads").update({ last_message_at: new Date().toISOString(), status: "open" }).eq("id", threadId);
  if (isFirst) await notifyAdmins("New support chat", `${p.full_name ?? p.email}: ${content.slice(0, 120)}`, "/admin/chats");

  // Context: the client's own requests, so the AI can answer specifically.
  const { data: reqs } = await db.from("requests").select("title, status, client_price_ngn, fx_rate").eq("client_id", p.id).order("created_at", { ascending: false }).limit(8);
  const ctx = (reqs ?? []).length
    ? "This client's current requests (title — status):\n" + (reqs ?? []).map((r) => `- ${r.title} — ${r.status}`).join("\n")
    : "This client has no requests yet.";

  const { data: history } = await db.from("chat_messages").select("sender, content").eq("thread_id", threadId).order("created_at");
  const reply = await askClaude(history ?? [], ctx);
  await db.from("chat_messages").insert({ thread_id: threadId, sender: "assistant", content: reply });
  revalidatePath("/client/support");
  return { error: "" };
}

// ----- admin side (service role) -----
export async function listThreadsForAdmin() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return [];
  const db = createAdminClient();
  const { data: threads } = await db.from("chat_threads").select("id, user_id, status, last_message_at").order("last_message_at", { ascending: false }).limit(50);
  const ids = (threads ?? []).map((t) => t.user_id).filter(Boolean);
  const { data: profs } = ids.length ? await db.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] as any[] };
  const nameOf = new Map((profs ?? []).map((x) => [x.id, x.full_name ?? x.email]));
  const out: any[] = [];
  for (const t of threads ?? []) {
    const { data: last } = await db.from("chat_messages").select("content, sender").eq("thread_id", t.id).order("created_at", { ascending: false }).limit(1).single();
    out.push({ ...t, user_name: t.user_id ? (nameOf.get(t.user_id) ?? "—") : "Website visitor", preview: last?.content?.slice(0, 90) ?? "", last_sender: last?.sender });
  }
  return out;
}

export async function getThreadForAdmin(id: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const db = createAdminClient();
  const { data: t } = await db.from("chat_threads").select("id, user_id").eq("id", id).single();
  if (!t) return null;
  const { data: prof } = t.user_id ? await db.from("profiles").select("full_name, email").eq("id", t.user_id).single() : { data: null };
  const { data: messages } = await db.from("chat_messages").select("*").eq("thread_id", id).order("created_at");
  return { id: t.id, user: prof, messages: messages ?? [] };
}

export async function staffReply(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const threadId = String(formData.get("thread_id") || "");
  const content = String(formData.get("content") || "").trim().slice(0, 2000);
  if (!content || !threadId) return { error: "Type a reply." };
  const db = createAdminClient();
  const { error } = await db.from("chat_messages").insert({ thread_id: threadId, sender: "staff", content });
  if (error) return { error: error.message };
  await db.from("chat_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
  const { data: t } = await db.from("chat_threads").select("user_id").eq("id", threadId).single();
  if (t?.user_id) await notify(t.user_id, "New reply from our team", content.slice(0, 120), "/client/support");
  revalidatePath(`/admin/chats/${threadId}`); revalidatePath("/admin/chats");
  return { error: "" };
}
