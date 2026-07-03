"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { notify } from "@/lib/notifications/notify";

/** Messages on a single request. Both the request's client and admins can read;
 *  either side can post. Each new message notifies the other party. */

async function requestFor(requestId: string) {
  const db = createAdminClient();
  const { data } = await db.from("requests").select("id, client_id, title").eq("id", requestId).maybeSingle();
  return data;
}

export async function getRequestMessages(requestId: string) {
  const p = await getCurrentProfile();
  if (!p) return [];
  const req = await requestFor(requestId);
  if (!req) return [];
  // Access: admin, or the owning client.
  if (p.role !== "admin" && req.client_id !== p.id) return [];
  const db = createAdminClient();
  const { data } = await db.from("request_messages").select("*").eq("request_id", requestId).order("created_at");
  return data ?? [];
}

export async function sendRequestMessage(requestId: string, content: string) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not authenticated." };
  const text = String(content || "").trim();
  if (text.length < 1) return { error: "Message is empty." };
  if (text.length > 4000) return { error: "Message is too long." };

  const req = await requestFor(requestId);
  if (!req) return { error: "Request not found." };

  const isAdmin = p.role === "admin";
  const isClient = req.client_id === p.id;
  if (!isAdmin && !isClient) return { error: "Not authorised for this request." };

  const sender = isAdmin ? "staff" : "client";
  const db = createAdminClient();
  const { error } = await db.from("request_messages").insert({
    request_id: requestId, sender, sender_id: p.id, content: text,
  });
  if (error) return { error: error.message };

  // Notify the other party (in-app + email), linking to their view of the request.
  if (isAdmin && req.client_id) {
    await notify(req.client_id, `New message about "${req.title}"`, text.slice(0, 160), `/client/requests/${requestId}`);
  } else if (isClient) {
    const { notifyAdmins } = await import("@/lib/notifications/notify");
    await notifyAdmins(`Client replied on "${req.title}"`, text.slice(0, 160), `/admin/requests/${requestId}`);
  }
  return { error: "" };
}
