"use server";
/**
 * The two push operations a browser legitimately performs on its own behalf.
 *
 * Every export here is a public HTTP endpoint, so each one establishes who is
 * calling and binds the row to that user. A subscription is always written
 * against the signed-in profile, never against a user id supplied by the
 * caller — otherwise anyone could register their own device against someone
 * else's account and receive that person's task offers.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

/** The public VAPID key the browser needs in order to subscribe. Public by
 *  design; the private half never leaves the server. */
export async function getPushPublicKey(): Promise<string | null> {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { error: "Incomplete subscription." };
  }

  const db = createAdminClient();
  // Upsert on endpoint: re-subscribing the same browser must update the row,
  // not create a second one that would push the same message twice. It also
  // re-points an endpoint at the current user if a device is handed over.
  const { error } = await db
    .from("push_subscriptions")
    .upsert(
      {
        user_id: p.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: (sub.userAgent || "").slice(0, 300) || null,
        failure_count: 0,
      },
      { onConflict: "endpoint" },
    );
  if (error) return { error: error.message };
  return { error: "" };
}

export async function removePushSubscription(endpoint: string) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  const db = createAdminClient();
  // Scoped to the caller: you may only unsubscribe your own device.
  const { error } = await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", p.id);
  if (error) return { error: error.message };
  return { error: "" };
}

/** Send the signed-in user a test push, so they can confirm it works on their
 *  own phone rather than finding out when they miss a real task. */
export async function sendTestPush() {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  const { sendPushToUser } = await import("@/lib/notifications/push");
  const r = await sendPushToUser(p.id, {
    title: "Notifications are working",
    body: "This is how a new task offer will reach you.",
    url: "/buddy/dashboard",
    tag: "bhb-test",
  }, { typeKey: "push_test" });
  if (r.sent === 0) return { error: r.reason === "no devices" ? "No device registered yet on this phone." : "Could not send. Check notification permission." };
  return { error: "" };
}
