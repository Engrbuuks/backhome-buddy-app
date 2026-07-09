"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { NOTIF_SETTINGS_KEY, NOTIF_DEFS, getNotifSettings, type NotifSettings } from "@/lib/notifications/config";

async function admin() {
  const p = await getCurrentProfile();
  return p && p.role === "admin" ? p : null;
}

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export async function loadNotifSettings() {
  if (!(await admin())) return null;
  const settings = await getNotifSettings();
  return { settings, defs: NOTIF_DEFS as any };
}

/** Save the whole notification settings object. Validates addresses and keeps
 *  essential types enabled unless the admin explicitly confirmed disabling. */
export async function saveNotifSettings(payload: NotifSettings): Promise<{ error: string }> {
  if (!(await admin())) return { error: "Not authorized." };

  // Validate team + sender addresses.
  const teamEmails = (payload.teamEmails || []).map((e) => e.trim()).filter(Boolean);
  for (const e of teamEmails) if (!validEmail(e)) return { error: `“${e}” is not a valid email address.` };
  if (payload.fromAddress && payload.fromAddress.trim()) {
    // from can be "Name <email>" or bare email — check the email part.
    const m = payload.fromAddress.match(/<([^>]+)>/);
    const addr = m ? m[1] : payload.fromAddress;
    if (!validEmail(addr)) return { error: "The sender (from) address is not valid." };
  }
  if (payload.replyTo && payload.replyTo.trim() && !validEmail(payload.replyTo)) {
    return { error: "The reply-to address is not valid." };
  }
  // Validate any per-type recipient overrides.
  for (const [key, cfg] of Object.entries(payload.types || {})) {
    if (cfg.recipientOverride && cfg.recipientOverride.trim() && !validEmail(cfg.recipientOverride)) {
      return { error: `Recipient override for “${key}” is not a valid email.` };
    }
  }

  const clean: NotifSettings = {
    types: payload.types || {},
    teamEmails,
    fromAddress: payload.fromAddress?.trim() || "",
    replyTo: payload.replyTo?.trim() || "",
  };

  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({ key: NOTIF_SETTINGS_KEY, value: clean as any }, { onConflict: "key" });
  if (error) return { error: error.message };
  revalidatePath("/admin/notifications-settings");
  return { error: "" };
}

/** Send a test email to confirm addresses + sender work. */
export async function sendTestNotification(to: string): Promise<{ error: string }> {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  if (!validEmail(to)) return { error: "Enter a valid email address to test." };
  const settings = await getNotifSettings();
  const { sendBrandedEmail } = await import("@/lib/notifications/notify");
  await sendBrandedEmail(to, "Test notification — Backhome Buddy", "This is a test of your notification settings. If you received this, your email delivery is working.", undefined, settings.replyTo || undefined);
  return { error: "" };
}
