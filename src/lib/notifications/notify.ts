import { createAdminClient } from "@/lib/supabase/admin";

/** Notifications = in-app row + (when RESEND_API_KEY is set) a branded email.
 *  Every notification in this system is a major action, so both channels fire
 *  together. Email failures never break the action — they log and move on. */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.backhomebuddy.NG";
const FROM = process.env.EMAIL_FROM || "Backhome Buddy <notifications@backhomebuddy.ng>";

function emailHtml(title: string, body: string, link?: string) {
  const btn = link
    ? `<a href="${APP_URL}${link}" style="display:inline-block;margin-top:20px;background:#079516;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;">Open in Backhome Buddy</a>`
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
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #E6E7E8;">
        <p style="margin:0;font-size:11px;line-height:1.6;color:#737375;">Your tasks handled right — with proof. This email was sent because of activity on your Backhome Buddy account. Need help? Reply to this email or visit <a href="https://backhomebuddy.ng" style="color:#079516;">backhomebuddy.ng</a>.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
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

/** In-app notification + email for a single user. */
export async function notify(userId: string, title: string, body: string, link?: string) {
  const db = createAdminClient();
  await db.from("notifications").insert({ user_id: userId, title, body, link: link ?? null });
  const { data: p } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (p?.email) await sendEmail(p.email, title, body, link);
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
