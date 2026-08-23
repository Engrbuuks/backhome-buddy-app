import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

/** Supabase Auth "Send Email" hook.
 *  Auth emails (signup confirmation, password reset, magic link, email change)
 *  are delivered here and sent via the Resend HTTP API — the same channel as
 *  the app's transactional emails. This replaces SMTP entirely.
 *
 *  Setup: Supabase → Authentication → Hooks → Send Email → HTTPS →
 *  https://app.backhomebuddy.NG/api/auth/send-email → copy the generated
 *  secret into Vercel env as SEND_EMAIL_HOOK_SECRET → redeploy. */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.backhomebuddy.NG";
const FROM = process.env.EMAIL_FROM || "Backhome Buddy <support@backhomebuddy.ng>";

const COPY: Record<string, { subject: string; title: string; body: string; button: string }> = {
  signup: {
    subject: "Confirm your email — Backhome Buddy",
    title: "Confirm your email",
    body: "Welcome to Backhome Buddy — the trusted way to get things done in Nigeria, with verifiable proof every step of the way. Confirm your email address to activate your account. The link expires in 24 hours.",
    button: "Confirm my email",
  },
  recovery: {
    subject: "Reset your Backhome Buddy password",
    title: "Reset your password",
    body: "We received a request to reset the password on your Backhome Buddy account. Click below to choose a new one. Didn't request this? Ignore this email — your password stays unchanged.",
    button: "Choose a new password",
  },
  magiclink: {
    subject: "Your Backhome Buddy sign-in link",
    title: "Your sign-in link",
    body: "Click below to sign in to your Backhome Buddy account. This link works once and expires shortly. Didn't request this? Ignore this email and your account stays secure.",
    button: "Sign me in",
  },
  email_change: {
    subject: "Confirm your new email — Backhome Buddy",
    title: "Confirm your new email address",
    body: "You asked to change the email address on your Backhome Buddy account. Confirm the change by clicking below. Didn't request this? Do not click the button, and consider changing your password.",
    button: "Confirm new email",
  },
  invite: {
    subject: "You're invited — Backhome Buddy",
    title: "You've been invited",
    body: "You've been invited to Backhome Buddy. Click below to accept the invitation and set up your account.",
    button: "Accept invitation",
  },
};

function html(title: string, body: string, link: string, button: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F6;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E6E7E8;">
<tr><td style="background:#15803D;padding:18px 28px;"><span style="color:#ffffff;font-size:16px;font-weight:800;letter-spacing:.3px;">Backhome Buddy</span></td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-size:19px;color:#1D1D1F;">${title}</h1>
<p style="margin:0;font-size:14px;line-height:1.7;color:#444;">${body}</p>
<a href="${link}" style="display:inline-block;margin-top:20px;background:#079516;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;">${button}</a>
<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#737375;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${link}" style="color:#079516;word-break:break-all;">${link}</a></p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #E6E7E8;"><p style="margin:0;font-size:11px;line-height:1.6;color:#737375;">Your tasks handled right — with proof. If you didn't request this email, you can safely ignore it. Questions? Visit <a href="https://backhomebuddy.ng" style="color:#079516;">backhomebuddy.ng</a>.</p></td></tr>
</table></td></tr></table></body></html>`;
}

/** Verify the standard-webhooks signature Supabase signs hooks with. */
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;
  // Reject stale messages (>5 min) to prevent replay.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,?/, "").replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signature.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    try {
      return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch { return false; }
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret) return NextResponse.json({ error: "Hook secret not configured" }, { status: 500 });
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }

  const email: string | undefined = payload?.user?.email;
  const d = payload?.email_data ?? {};
  const action: string = d.email_action_type || "signup";
  if (!email || !d.token_hash) return NextResponse.json({ error: "Missing email data" }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const redirect = d.redirect_to || APP_URL;
  const link = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(d.token_hash)}&type=${encodeURIComponent(action)}&redirect_to=${encodeURIComponent(redirect)}`;
  const copy = COPY[action] ?? COPY.signup;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from: FROM, to: [email], subject: copy.subject, html: html(copy.title, copy.body, link, copy.button) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Auth email send failed:", res.status, detail);
    return NextResponse.json({ error: `Email provider error ${res.status}` }, { status: 500 });
  }
  return NextResponse.json({});
}

/** Self-diagnostic: open https://app.backhomebuddy.NG/api/auth/send-email in a
 *  browser. Reports which env pieces the running deployment can actually see
 *  (booleans only — no secret values). Add ?selftest=1 to attempt a real
 *  Resend send to the FROM address itself, surfacing Resend's exact verdict. */
export async function GET(req: NextRequest) {
  const report: Record<string, unknown> = {
    deployment_ok: true,
    SEND_EMAIL_HOOK_SECRET_configured: Boolean(process.env.SEND_EMAIL_HOOK_SECRET),
    RESEND_API_KEY_configured: Boolean(process.env.RESEND_API_KEY),
    NEXT_PUBLIC_SUPABASE_URL_configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    sender: FROM,
    hint: "All three must be true. If one is false: fix the Vercel env var (exact name, Production scope) and REDEPLOY.",
  };

  if (new URL(req.url).searchParams.get("selftest") === "1" && process.env.RESEND_API_KEY) {
    const selfAddress = FROM.includes("<") ? FROM.split("<")[1].replace(">", "").trim() : FROM;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM, to: [selfAddress], subject: "Backhome Buddy — email self-test", html: "<p>If you can read this, Resend sending works end to end.</p>" }),
      });
      report.selftest_status = res.status;
      report.selftest_response = (await res.text().catch(() => "")).slice(0, 400);
      report.selftest_verdict = res.ok ? `SENT — check the ${selfAddress} inbox` : "FAILED — the response above is Resend's exact reason";
    } catch (e) {
      report.selftest_verdict = `Network error: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }
  return NextResponse.json(report);
}
