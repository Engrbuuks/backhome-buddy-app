import { createAdminClient } from "@/lib/supabase/admin";

/** Central catalog + settings for all notification emails.
 *  Config is stored in app_settings under NOTIF_SETTINGS_KEY as JSON, so it can
 *  be edited by admins with no redeploy. Anything not overridden falls back to
 *  the defaults defined here. */

export const NOTIF_SETTINGS_KEY = "notification_settings";

export type Audience = "client" | "buddy" | "team";

export type NotifDef = {
  key: string;
  label: string;          // human name in the admin UI
  audience: Audience;     // who normally receives it
  essential: boolean;     // transactional — turning off is risky (money / onboarding blockers)
  group: string;          // UI grouping
  defaultSubject: string;
};

/** The full catalog of notification types the app can send. `key` is stable and
 *  is what call sites reference. Subjects here are the defaults; admins can
 *  override subject + body in settings. */
export const NOTIF_DEFS: ReadonlyArray<NotifDef> = [
  // Money / transactional (essential)
  { key: "payment_received", label: "Payment received", audience: "client", essential: true, group: "Payments", defaultSubject: "Payment received" },
  { key: "extra_payment_confirmed", label: "Additional payment confirmed", audience: "client", essential: true, group: "Payments", defaultSubject: "Additional payment confirmed" },
  { key: "extra_cost_approval", label: "Additional cost needs approval", audience: "client", essential: true, group: "Payments", defaultSubject: "Additional cost needs your approval" },
  { key: "payout_eligible", label: "Payout eligible for release", audience: "buddy", essential: false, group: "Payments", defaultSubject: "Your payout is now eligible for release." },
  { key: "payout_sent", label: "Payout sent to buddy", audience: "buddy", essential: true, group: "Payments", defaultSubject: "You have been paid" },
  { key: "refund_sent", label: "Refund sent", audience: "client", essential: true, group: "Payments", defaultSubject: "Refund sent" },

  // Task lifecycle
  { key: "quote_ready", label: "Quote ready", audience: "client", essential: true, group: "Task updates", defaultSubject: "Your quote is ready" },
  { key: "buddy_assigned_client", label: "Buddy assigned (to client)", audience: "client", essential: false, group: "Task updates", defaultSubject: "A vetted buddy is now on your request." },
  { key: "task_assigned_buddy", label: "New task assigned (to buddy)", audience: "buddy", essential: false, group: "Task updates", defaultSubject: "New task assigned" },
  { key: "work_started", label: "Work has started", audience: "client", essential: false, group: "Task updates", defaultSubject: "Work has started" },
  { key: "proof_approved_confirm", label: "Proof approved — please confirm", audience: "client", essential: false, group: "Task updates", defaultSubject: "Proof approved — please confirm" },
  { key: "changes_requested", label: "Changes requested (to buddy)", audience: "buddy", essential: false, group: "Task updates", defaultSubject: "Changes requested" },
  { key: "client_confirmed", label: "Client confirmed completion", audience: "buddy", essential: false, group: "Task updates", defaultSubject: "Client confirmed completion" },
  { key: "completion_auto", label: "Completion auto-confirmed", audience: "buddy", essential: false, group: "Task updates", defaultSubject: "Completion auto-confirmed" },
  { key: "dispute_resolved", label: "Dispute resolved", audience: "client", essential: false, group: "Task updates", defaultSubject: "Dispute resolved" },
  { key: "new_reply", label: "New reply from team", audience: "client", essential: false, group: "Task updates", defaultSubject: "New reply from our team" },

  // Onboarding / vetting (mostly essential — blockers if missed)
  { key: "sign_nda", label: "Please sign your NDA", audience: "buddy", essential: true, group: "Onboarding", defaultSubject: "Please sign your NDA" },
  { key: "docs_needed", label: "Documents needed for verification", audience: "buddy", essential: true, group: "Onboarding", defaultSubject: "Documents needed for verification" },
  { key: "guarantor_needed", label: "Please add guarantor details", audience: "buddy", essential: false, group: "Onboarding", defaultSubject: "Please add guarantor details" },

  // Team / ops alerts
  { key: "team_new_request", label: "New request received", audience: "team", essential: false, group: "Team alerts", defaultSubject: "New request on Backhome Buddy" },
  { key: "team_new_dispute", label: "New dispute raised", audience: "team", essential: false, group: "Team alerts", defaultSubject: "A dispute was raised" },
  { key: "team_proof_review", label: "Proof awaiting review", audience: "team", essential: false, group: "Team alerts", defaultSubject: "Proof is awaiting review" },
  { key: "team_new_buddy", label: "New buddy signed up", audience: "team", essential: false, group: "Team alerts", defaultSubject: "A new buddy signed up" },
];

export type NotifTypeConfig = { enabled: boolean; subject?: string; body?: string; recipientOverride?: string };
export type NotifSettings = {
  types: Record<string, NotifTypeConfig>;
  teamEmails: string[];                 // where "team" audience notifications go
  fromAddress?: string;                 // sender override (default from env)
  replyTo?: string;                     // reply-to override
};

export function defaultSettings(): NotifSettings {
  const types: Record<string, NotifTypeConfig> = {};
  for (const d of NOTIF_DEFS) types[d.key] = { enabled: true };
  return { types, teamEmails: [], fromAddress: "", replyTo: "" };
}

/** Effective settings = defaults merged with any admin overrides in app_settings. */
export async function getNotifSettings(): Promise<NotifSettings> {
  const base = defaultSettings();
  try {
    const db = createAdminClient();
    const { data } = await db.from("app_settings").select("value").eq("key", NOTIF_SETTINGS_KEY).maybeSingle();
    const v = data?.value as Partial<NotifSettings> | undefined;
    if (!v) return base;
    return {
      types: { ...base.types, ...(v.types || {}) },
      teamEmails: Array.isArray(v.teamEmails) ? v.teamEmails : base.teamEmails,
      fromAddress: v.fromAddress ?? base.fromAddress,
      replyTo: v.replyTo ?? base.replyTo,
    };
  } catch {
    return base;
  }
}

export function defFor(key: string): NotifDef | undefined {
  return NOTIF_DEFS.find((d) => d.key === key);
}
