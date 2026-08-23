"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { notify } from "@/lib/notifications/notify";

/** Messages on a single request. Both the request's client and admins can read;
 *  either side can post. Each new message notifies the other party. */

async function requestFor(requestId: string) {
  const db = createAdminClient();
  const { data } = await db.from("requests").select("id, client_id, assigned_buddy_id, title").eq("id", requestId).maybeSingle();
  return data;
}

/** First name only, so buddy and client never see full identities. */
function firstNameOf(full?: string | null, fallback = "") {
  return (full || "").trim().split(/\s+/)[0] || fallback;
}

export async function getRequestMessages(requestId: string) {
  const p = await getCurrentProfile();
  if (!p) return [];
  const req = await requestFor(requestId);
  if (!req) return [];
  // Access: admin, the owning client, or the assigned buddy.
  const allowed = p.role === "admin" || req.client_id === p.id || req.assigned_buddy_id === p.id;
  if (!allowed) return [];
  const db = createAdminClient();
  const { data } = await db.from("request_messages").select("*").eq("request_id", requestId).order("created_at");
  let msgs = data ?? [];

  // Audience filtering: admins see everything. A client never sees buddy-only
  // messages; a buddy never sees client-only messages. Legacy rows are 'all'.
  const isAdmin = p.role === "admin";
  const isClient = req.client_id === p.id;
  if (!isAdmin) {
    msgs = msgs.filter((m: any) => {
      const aud = m.audience || "all";
      if (aud === "all") return true;
      if (isClient) return aud === "client";
      return aud === "buddy"; // viewer is the buddy
    });
  }

  // Attach a display first-name for client/buddy senders (staff shown as the team).
  const senderIds = Array.from(new Set(msgs.map((m: any) => m.sender_id).filter(Boolean)));
  const names = new Map<string, string>();
  if (senderIds.length) {
    const { data: profs } = await db.from("profiles").select("id, full_name").in("id", senderIds);
    for (const pr of profs ?? []) names.set((pr as any).id, firstNameOf((pr as any).full_name));
  }
  // Sign any attachment keys (stored in the proofs bucket).
  const withAtt = msgs.filter((m: any) => m.attachment_url);
  let signedMap = new Map<string, string>();
  if (withAtt.length) {
    const { signProofUrls } = await import("@/lib/storage/sign");
    const signed = await signProofUrls(withAtt.map((m: any) => ({ id: m.id, file_url: m.attachment_url })) as any[]);
    signedMap = new Map(signed.map((s: any) => [s.id, s.signedUrl as string]).filter(([, v]) => v) as [string, string][]);
  }
  return msgs.map((m: any) => ({
    ...m,
    sender_first_name: m.sender === "staff" ? null : (names.get(m.sender_id) || null),
    attachment_signed: m.attachment_url ? (signedMap.get(m.id) || null) : null,
  }));
}

export async function sendRequestMessage(
  requestId: string,
  content: string,
  audience: "all" | "client" | "buddy" = "all",
  attachment?: { url: string; kind: "image" | "video" | "file"; name?: string }
) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not authenticated." };
  const text = String(content || "").trim();
  const hasAttachment = Boolean(attachment?.url);
  if (text.length < 1 && !hasAttachment) return { error: "Message is empty." };
  if (text.length > 4000) return { error: "Message is too long." };

  const req = await requestFor(requestId);
  if (!req) return { error: "Request not found." };

  const isAdmin = p.role === "admin";
  const isClient = req.client_id === p.id;
  const isBuddy = req.assigned_buddy_id === p.id;
  if (!isAdmin && !isClient && !isBuddy) return { error: "Not authorised for this request." };

  const aud: "all" | "client" | "buddy" = isAdmin && ["all", "client", "buddy"].includes(audience) ? audience : "all";

  const sender = isAdmin ? "staff" : isBuddy ? "buddy" : "client";
  const db = createAdminClient();
  const { error } = await db.from("request_messages").insert({
    request_id: requestId, sender, sender_id: p.id, content: text, audience: aud,
    attachment_url: attachment?.url || null,
    attachment_kind: hasAttachment ? attachment!.kind : null,
    attachment_name: attachment?.name || null,
  });
  if (error) return { error: error.message };

  const { notifyAdmins } = await import("@/lib/notifications/notify");
  const previewBase = text || (hasAttachment ? (attachment!.kind === "image" ? "📷 Photo" : attachment!.kind === "video" ? "🎥 Video" : "📎 File") : "");
  const preview = previewBase.slice(0, 160).replace(/[*_`#>-]/g, "");
  if (isAdmin) {
    if (aud !== "buddy" && req.client_id) await notify(req.client_id, `New message about "${req.title}"`, preview, `/client/requests/${requestId}`);
    if (aud !== "client" && req.assigned_buddy_id) await notify(req.assigned_buddy_id, `Message about "${req.title}"`, preview, `/buddy/tasks/${requestId}`);
  } else if (isClient) {
    await notifyAdmins(`Client replied on "${req.title}"`, preview, `/admin/requests/${requestId}`);
    if (req.assigned_buddy_id) await notify(req.assigned_buddy_id, `Client message on "${req.title}"`, preview, `/buddy/tasks/${requestId}`);
  } else if (isBuddy) {
    await notifyAdmins(`Buddy enquiry on "${req.title}"`, preview, `/admin/requests/${requestId}`);
    if (req.client_id) await notify(req.client_id, `Your buddy asked about "${req.title}"`, preview, `/client/requests/${requestId}`);
  }
  return { error: "" };
}
