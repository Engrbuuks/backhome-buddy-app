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

/** Returns the saved identity for a visitor key, so the widget knows whether to
 *  show the name/email step. */
export async function getVisitorIdentity(visitorKey: string) {
  if (!KEY_RE.test(visitorKey)) return null;
  const db = createAdminClient();
  const { data } = await db.from("chat_threads").select("visitor_name, visitor_email").eq("visitor_key", visitorKey).maybeSingle();
  return data ?? null;
}

/** Save the visitor's name (and optional email) before the conversation starts.
 *  Creates the thread if needed so the identity is attached from the first message. */
export async function saveVisitorIdentity(visitorKey: string, name: string, email: string) {
  if (!KEY_RE.test(visitorKey)) return { error: "Invalid session — refresh the page." };
  const cleanName = String(name || "").trim().slice(0, 80);
  const cleanEmail = String(email || "").trim().slice(0, 120);
  if (cleanName.length < 2) return { error: "Please tell us your name." };
  if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) return { error: "That email doesn't look right." };
  const db = createAdminClient();
  let { data: t } = await db.from("chat_threads").select("id").eq("visitor_key", visitorKey).maybeSingle();
  if (!t) {
    const { data: created, error } = await db.from("chat_threads").insert({ visitor_key: visitorKey, visitor_name: cleanName, visitor_email: cleanEmail || null }).select("id").single();
    if (error || !created) return { error: "Could not start chat — try again." };
  } else {
    await db.from("chat_threads").update({ visitor_name: cleanName, visitor_email: cleanEmail || null }).eq("id", t.id);
  }
  return { error: "" };
}

export async function sendVisitorMessage(visitorKey: string, raw: string) {
  if (!KEY_RE.test(visitorKey)) return { error: "Invalid session — refresh the page.", messages: [] as any[] };
  const content = String(raw || "").trim().slice(0, 1500);
  if (!content) return { error: "Type a message.", messages: [] };
  if (limited(visitorKey)) return { error: "Too many messages — give it a minute.", messages: [] };

  const db = createAdminClient();
  let { data: t } = await db.from("chat_threads").select("id, visitor_name").eq("visitor_key", visitorKey).maybeSingle();
  let isNew = false;
  if (!t) {
    const { data: created, error } = await db.from("chat_threads").insert({ visitor_key: visitorKey }).select("id, visitor_name").single();
    if (error || !created) return { error: "Could not start chat — try again.", messages: [] };
    t = created; isNew = true;
  }
  await db.from("chat_messages").insert({ thread_id: t.id, sender: "user", content });
  await db.from("chat_threads").update({ last_message_at: new Date().toISOString(), status: "open" }).eq("id", t.id);
  const who = t.visitor_name ? t.visitor_name : "Visitor";
  if (isNew) await notifyAdmins("New website chat", `${who}: ${content.slice(0, 120)}`, "/admin/chats");

  const { data: history } = await db.from("chat_messages").select("sender, content").eq("thread_id", t.id).order("created_at");
  const nameNote = t.visitor_name ? ` The visitor's name is ${t.visitor_name}; address them by their first name naturally.` : "";
  const reply = await askClaude(history ?? [],
    `This is an anonymous website visitor (not signed in). You cannot see any account or request data. Answer questions about how Backhome Buddy works and warmly encourage them to sign up at /signup to create a request — quotes are free.${nameNote}`);
  await db.from("chat_messages").insert({ thread_id: t.id, sender: "assistant", content: reply });

  const { data: messages } = await db.from("chat_messages").select("id, sender, content, created_at").eq("thread_id", t.id).order("created_at");
  return { error: "", messages: messages ?? [] };
}
