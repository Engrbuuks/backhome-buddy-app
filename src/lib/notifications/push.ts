/**
 * Web push — the only free channel that reaches a buddy who is not looking at
 * the site.
 *
 * SECURITY: no "use server" here on purpose. Every export from a "use server"
 * module becomes a callable HTTP endpoint, and `sendPushToUser` takes a user id
 * as an argument — exposed, it would let a stranger push arbitrary text to any
 * buddy's phone. It is reachable only from other server code. The two things a
 * browser legitimately needs to call live in ./push-actions.ts, guarded.
 *
 * Setup, once, before any of this does anything:
 *   npx web-push generate-vapid-keys
 * then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. With no keys
 * configured every function here no-ops quietly rather than throwing, so the
 * app runs perfectly well without push until you turn it on.
 */

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

if (typeof window !== "undefined") {
  throw new Error("notifications/push is server-only and must never reach the browser.");
}

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@backhomebuddy.ng";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping the notification should land. */
  url?: string;
  /** Keeps a time boxed offer on screen until the buddy deals with it. */
  urgent?: boolean;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
};

/**
 * Push to every device a user has registered.
 *
 * Never throws. A notification failing must not take down the action that
 * triggered it: an offer still stands even if the buzz did not arrive.
 *
 * Returns how many devices accepted it, which the caller records so a silent
 * offer can later be distinguished from an ignored one.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  ctx?: { typeKey?: string; requestId?: string },
): Promise<{ sent: number; failed: number; reason?: string }> {
  if (!ensureConfigured()) {
    await logDelivery(userId, false, "VAPID keys not configured", ctx);
    return { sent: 0, failed: 0, reason: "push not configured" };
  }

  const db = createAdminClient();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) {
    await logDelivery(userId, false, "no registered devices", ctx);
    return { sent: 0, failed: 0, reason: "no devices" };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 * 30 },   // half an hour: longer than any offer window
      );
      sent++;
      await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString(), failure_count: 0 }).eq("id", s.id);
    } catch (e: any) {
      failed++;
      const code = e?.statusCode;
      // 404/410 mean the browser threw this subscription away. Keeping it would
      // mean failing forever against an endpoint that no longer exists.
      if (code === 404 || code === 410) {
        dead.push(s.id);
      } else {
        // A transient failure. Count it, but keep the subscription: a device
        // that was simply offline deserves another chance.
        await db.from("push_subscriptions")
          .update({ failure_count: (Number((s as any).failure_count) || 0) + 1 })
          .eq("id", s.id);
      }
    }
  }

  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);

  await logDelivery(userId, sent > 0, sent > 0 ? undefined : `all ${subs.length} device(s) failed`, ctx);
  return { sent, failed };
}

async function logDelivery(
  userId: string,
  accepted: boolean,
  reason?: string,
  ctx?: { typeKey?: string; requestId?: string },
) {
  try {
    const db = createAdminClient();
    await db.from("notification_deliveries").insert({
      user_id: userId,
      channel: "push",
      provider: "web-push",
      type_key: ctx?.typeKey ?? null,
      request_id: ctx?.requestId ?? null,
      accepted,
      reason: reason ?? null,
    });
  } catch {
    /* Recording a delivery must never break the thing being delivered. */
  }
}

/** Is push switched on for this deployment? Used by the UI to decide whether
 *  to even offer the "turn on notifications" prompt. */
export function pushConfigured(): boolean {
  return ensureConfigured();
}
