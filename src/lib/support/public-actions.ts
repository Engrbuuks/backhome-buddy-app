"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifications/notify";
import { askClaude } from "@/lib/support/ai";

/** Per-instance rate limit: 6 visitor messages/minute per key. */
const hits = new Map<string, { n: number; t: number }>();
function limited(key: string, max = 6, win = 60_000) {
  const now = Date.now(); const a = hits.get(key);
  if (!a || now - a.t > win) { hits.set(key, { n: 1, t: now }); return false; }
  a.n += 1; return a.n > max;
}
const KEY_RE = /^[a-zA-Z0-9-]{16,64}$/;

export async function getVisitorMessages(visitorKey: string) {
  if (!KEY_RE.test(visitorKey)) return [];
  const db = createAdminClient();
  const { data: t } = await db.from("chat_threads").select("id").eq("visitor_key", visitorKey).maybeSingle();
  if (!t) return [];
  const { data } = await db.from("chat_messages").select("id, sender, content, created_at").eq("thread_id", t.id).order("created_at");
  return data ?? [];
}

export async function sendVisitorMessage(visitorKey: string, raw: string) {
  if (!KEY_RE.test(visitorKey)) return { error: "Invalid session — refresh the page.", messages: [] as any[] };
  const content = String(raw || "").trim().slice(0, 1500);
  if (!content) return { error: "Type a message.", messages: [] };
  if (limited(visitorKey)) return { error: "Too many messages — give it a minute.", messages: [] };

  const db = createAdminClient();
  let { data: t } = await db.from("chat_threads").select("id").eq("visitor_key", visitorKey).maybeSingle();
  let isNew = false;
  if (!t) {
    const { data: created, error } = await db.from("chat_threads").insert({ visitor_key: visitorKey }).select("id").single();
    if (error || !created) return { error: "Could not start chat — try again.", messages: [] };
    t = created; isNew = true;
  }
  await db.from("chat_messages").insert({ thread_id: t.id, sender: "user", content });
  await db.from("chat_threads").update({ last_message_at: new Date().toISOString(), status: "open" }).eq("id", t.id);
  if (isNew) await notifyAdmins("New website chat", `Visitor: ${content.slice(0, 120)}`, "/admin/chats");

  const { data: history } = await db.from("chat_messages").select("sender, content").eq("thread_id", t.id).order("created_at");
  const reply = await askClaude(history ?? [],
    "This is an anonymous website visitor (not signed in). You cannot see any account or request data. Answer questions about how Backhome Buddy works and warmly encourage them to sign up at /signup to create a request — quotes are free.");
  await db.from("chat_messages").insert({ thread_id: t.id, sender: "assistant", content: reply });

  const { data: messages } = await db.from("chat_messages").select("id, sender, content, created_at").eq("thread_id", t.id).order("created_at");
  return { error: "", messages: messages ?? [] };
}
