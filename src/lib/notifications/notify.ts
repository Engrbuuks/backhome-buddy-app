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
  if (!key || !to) return; // email channel not configured — in-app only
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, html: emailHtml(subject, body, link) }),
    });
    if (!res.ok) console.error("Email send failed:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("Email send error:", e);
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
  const { getNotifSettings, defFor } = await import("@/lib/notifications/config");
  const settings = await getNotifSettings();
  const def = defFor(opts.typeKey);
  const cfg = settings.types[opts.typeKey] || { enabled: true };
  const db = createAdminClient();

  const subject = (cfg.subject && cfg.subject.trim()) || opts.subject || def?.defaultSubject || "Backhome Buddy";
  const body = (cfg.body && cfg.body.trim()) || opts.body;

  // Always record the in-app notification for user-facing types (channel of record).
  if (opts.userId && def?.audience !== "team") {
    await db.from("notifications").insert({ user_id: opts.userId, title: subject, body, link: opts.link ?? null });
  }

  // Email is optional and switchable.
  if (!cfg.enabled) return;

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
  if (recipients.length === 0) return;

  const from = (settings.fromAddress && settings.fromAddress.trim()) || undefined;
  const replyTo = (settings.replyTo && settings.replyTo.trim()) || undefined;
  for (const to of recipients) {
    await sendConfiguredEmail(to, subject, body, opts.link, from, replyTo);
  }
}

/** Like sendBrandedEmail but with optional from/reply-to overrides. */
async function sendConfiguredEmail(to: string, subject: string, body: string, link?: string, fromOverride?: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  try {
    const payload: any = { from: fromOverride || FROM, to: [to], subject, html: emailHtml(subject, body, link) };
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
