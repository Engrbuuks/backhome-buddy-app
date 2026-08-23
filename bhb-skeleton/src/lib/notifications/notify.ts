import { createAdminClient } from "@/lib/supabase/admin";

/** Notifications = in-app row + (when RESEND_API_KEY is set) a branded email.
 *  Every notification in this system is a major action, so both channels fire
 *  together. Email failures never break the action — they log and move on. */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.backhomebuddy.ng";
const FROM = process.env.EMAIL_FROM || "Backhome Buddy <notifications@backhomebuddy.ng>";

function emailHtml(title: string, body: string, link?: string) {
  // `link` may be a relative path ("/apply") or a full URL ("https://calendly.com/..").
  // Only prepend APP_URL for relative paths, so full URLs aren't doubled up.
  const href = link ? (/^https?:\/\//i.test(link) ? link : `${APP_URL}${link}`) : "";
  const label = link && /calendly\.com/i.test(link) ? "Book your interview"
    : link && /^https?:\/\//i.test(link) && !new RegExp(APP_URL, "i").test(link) ? "Open link"
    : "Open in Backhome Buddy";
  // Bulletproof table-based button — renders and clicks reliably across Gmail,
  // Outlook, Apple Mail and mobile webviews (a styled <a> can be swallowed by
  // some clients' sandboxed preview frames).
  const btn = href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr>
        <td align="center" bgcolor="#079516" style="background:#079516;border-radius:10px;">
          <a href="${href}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
        </td>
      </tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F6;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E6E7E8;">
      <tr><td style="background:#15803D;padding:18px 28px;">
        <span style="color:#ffffff;font-size:16px;font-weight:800;letter-spacing:.3px;">Backhome Buddy</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:19px;color:#1D1D1F;">${title}</h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#444;">${body}</p>
        ${btn}
        ${href ? `<p style="margin:18px 0 0;padding:12px;background:#F6F8F6;border-radius:8px;font-size:12px;line-height:1.6;color:#444;">If the button doesn't open, copy and paste this link into your browser:<br><a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#079516;font-weight:700;word-break:break-all;">${href}</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #E6E7E8;">
        <p style="margin:0;font-size:11px;line-height:1.6;color:#737375;">Your tasks handled right — with proof. This email was sent because of activity on your Backhome Buddy account. Need help? Reply to this email or visit <a href="https://backhomebuddy.ng" target="_blank" rel="noopener noreferrer" style="color:#079516;">backhomebuddy.ng</a>.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/**
 * Record whether Resend accepted a message, so "the client says they never got
 * it" becomes a checkable fact instead of a guess.
 *
 * Query it with:
 *   select created_at, detail from audit_log
 *   where action = 'email_send' order by created_at desc limit 50;
 *
 * `sent: true`  → we handed it to Resend; if it never arrived, the problem is
 *                 downstream (SPF/DKIM/DMARC, spam filing, a wrong address).
 * `sent: false` → it never left the app; `reason` says why.
 *
 * Volume is kept sane: essential types are always logged, non-essential ones
 * only when the send fails. Logging never throws — it must not be able to break
 * the action that triggered it.
 */
async function logEmailOutcome(entry: {
  to: string;
  subject: string;
  typeKey?: string;
  sent: boolean;
  reason?: string;
  always?: boolean;
}) {
  try {
    if (!entry.always && entry.sent) return; // successes are only logged for essential types
    const db = createAdminClient();
    await db.from("audit_log").insert({
      actor_id: null,
      action: "email_send",
      detail: {
        to: entry.to,
        subject: entry.subject,
        type_key: entry.typeKey ?? null,
        sent: entry.sent,
        reason: entry.reason ?? null,
      },
    });
  } catch (e) {
    console.error("Email outcome logging failed:", e);
  }
}

export async function sendBrandedEmail(to: string, subject: string, body: string, link?: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return; // email channel not configured — in-app only
  try {
    const payload: any = { from: FROM, to: [to], subject, html: emailHtml(subject, body, link) };
    if (replyTo) payload.reply_to = replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("Email send failed:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("Email send error:", e);
  }
}

async function sendEmail(to: string, subject: string, body: string, link?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) {
    // Email channel not configured, or no address on file — in-app only.
    await logEmailOutcome({ to: to || "(none)", subject, sent: false, reason: key ? "no recipient email on file" : "RESEND_API_KEY not set" });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: emailHtml(subject, body, link) }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Email send failed:", res.status, text);
      await logEmailOutcome({ to, subject, sent: false, reason: `Resend ${res.status}: ${text.slice(0, 200)}` });
    }
  } catch (e) {
    console.error("Email send error:", e);
    await logEmailOutcome({ to, subject, sent: false, reason: e instanceof Error ? e.message : "send error" });
  }
}

/** Public email send that reports success/error (used by admin re-engagement). */
export async function sendEmailPublic(to: string, subject: string, body: string, link?: string): Promise<{ error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "Email is not configured (RESEND_API_KEY missing)." };
  if (!to) return { error: "No recipient email." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: emailHtml(subject, body, link) }),
    });
    if (!res.ok) return { error: `Email send failed (${res.status}).` };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Email send error." };
  }
}

/** Send an email with one or more attachments (used for the branded quote PDF).
 *  Attachments are { filename, content } where content is base64 (no data URI).
 *  Reads Resend's response body so attachment/content problems surface instead
 *  of silently succeeding. */
export async function sendEmailWithAttachments(
  to: string, subject: string, body: string,
  attachments: Array<{ filename: string; content: string }>, link?: string
): Promise<{ error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "Email is not configured (RESEND_API_KEY missing)." };
  if (!to) return { error: "No recipient email." };

  // Guard: never claim an attachment when the content is empty/invalid.
  const clean = (attachments || []).filter((a) => a && a.filename && a.content && a.content.length > 0);
  if (attachments.length && !clean.length) {
    return { error: "Attachment content was empty — nothing was attached." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html: emailHtml(subject, body, link),
        attachments: clean.map((a) => ({
          filename: a.filename,
          content: a.content,           // base64 string
          content_type: "application/pdf",
        })),
      }),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("Resend attachment send failed:", res.status, text);
      return { error: `Email send failed (${res.status}): ${text.slice(0, 200)}` };
    }
    // Success bodies include an id; a body-level error means it didn't really send.
    try {
      const j = text ? JSON.parse(text) : {};
      if (j?.error) {
        console.error("Resend body error:", j.error);
        return { error: typeof j.error === "string" ? j.error : (j.error?.message || "Resend rejected the message.") };
      }
    } catch { /* non-JSON success body is fine */ }
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Email send error." };
  }
}

/** In-app notification + email for a single user. Optionally pass a `typeKey`
 *  to make it respect the admin notification settings (on/off, custom wording,
 *  recipient override). Without a typeKey it behaves as before (always sends). */
export async function notify(userId: string, title: string, body: string, link?: string, typeKey?: string) {
  if (typeKey) {
    await notifyTyped({ typeKey, userId, subject: title, body, link });
    return;
  }
  const db = createAdminClient();
  await db.from("notifications").insert({ user_id: userId, title, body, link: link ?? null });
  const { data: p } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (p?.email) await sendEmail(p.email, title, body, link);
}

/** In-app notification only — no email. Use when an email is already being sent
 *  separately for the same event, to avoid the buddy/client getting two emails. */
export async function notifyInApp(userId: string, title: string, body: string, link?: string) {
  const db = createAdminClient();
  await db.from("notifications").insert({ user_id: userId, title, body, link: link ?? null });
}

/** In-app notification + email for every admin. */
export async function notifyAdmins(title: string, body: string, link?: string) {
  const db = createAdminClient();
  const { data: admins } = await db.from("profiles").select("id, email").eq("role", "admin");
  if (!admins?.length) return;
  await db.from("notifications").insert(admins.map((a) => ({ user_id: a.id, title, body, link: link ?? null })));
  for (const a of admins) {
    if (a.email) await sendEmail(a.email, title, body, link);
  }
}

/** Settings-aware notification. Looks up the type's config: skips the email if
 *  disabled, applies custom subject/body if set, and routes to the right
 *  recipient (the user, an override, or the team addresses). Always still writes
 *  the in-app notification row for user-facing types so nothing is lost in-app. */
export async function notifyTyped(opts: {
  typeKey: string;
  userId?: string;          // the user this concerns (for in-app + default recipient)
  subject?: string;         // fallback subject if no override configured
  body: string;
  link?: string;
}) {
  const { getNotifSettings, defFor, isEssential } = await import("@/lib/notifications/config");
  const settings = await getNotifSettings();
  const def = defFor(opts.typeKey);
  const cfg = settings.types[opts.typeKey] || { enabled: true };
  const essential = isEssential(opts.typeKey);
  const db = createAdminClient();

  const subject = (cfg.subject && cfg.subject.trim()) || opts.subject || def?.defaultSubject || "Backhome Buddy";
  const body = (cfg.body && cfg.body.trim()) || opts.body;

  // Always record the in-app notification for user-facing types (channel of record).
  if (opts.userId && def?.audience !== "team") {
    await db.from("notifications").insert({ user_id: opts.userId, title: subject, body, link: opts.link ?? null });
  }

  // Email is switchable — EXCEPT for essential types. Missing a payment, payout,
  // refund, quote, assignment, proof turnaround, dispute outcome or onboarding
  // blocker costs real money or strands someone, so those always send regardless
  // of the admin toggle. A stale `enabled: false` in saved settings can no longer
  // silence them.
  if (!cfg.enabled && !essential) return;

  // Resolve recipient(s).
  let recipients: string[] = [];
  if (def?.audience === "team") {
    recipients = settings.teamEmails.filter(Boolean);
  } else if (cfg.recipientOverride && cfg.recipientOverride.trim()) {
    recipients = [cfg.recipientOverride.trim()];
  } else if (opts.userId) {
    const { data: p } = await db.from("profiles").select("email").eq("id", opts.userId).maybeSingle();
    if (p?.email) recipients = [p.email];
  }
  if (recipients.length === 0) {
    await logEmailOutcome({
      to: "(none)", subject, typeKey: opts.typeKey, sent: false,
      reason: def?.audience === "team" ? "no team emails configured" : "no recipient email on file",
      always: essential,
    });
    return;
  }

  const from = (settings.fromAddress && settings.fromAddress.trim()) || undefined;
  const replyTo = (settings.replyTo && settings.replyTo.trim()) || undefined;
  for (const to of recipients) {
    const r = await sendConfiguredEmail(to, subject, body, opts.link, from, replyTo);
    await logEmailOutcome({ to, subject, typeKey: opts.typeKey, sent: r.sent, reason: r.reason, always: essential });
  }
}

/** Like sendBrandedEmail but with optional from/reply-to overrides. Reports the
 *  outcome so the caller can record it. Never throws. */
async function sendConfiguredEmail(
  to: string, subject: string, body: string, link?: string, fromOverride?: string, replyTo?: string
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };
  if (!to) return { sent: false, reason: "no recipient email on file" };
  try {
    const payload: any = { from: fromOverride || FROM, to: [to], subject, html: emailHtml(subject, body, link) };
    if (replyTo) payload.reply_to = replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Email send failed:", res.status, text);
      return { sent: false, reason: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("Email send error:", e);
    return { sent: false, reason: e instanceof Error ? e.message : "send error" };
  }
}
