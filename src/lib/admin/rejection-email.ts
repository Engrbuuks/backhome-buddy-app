/**
 * SECURITY: no "use server" here, deliberately. The recipient address is a
 * parameter. Exported from a "use server" file this was an open relay: anyone
 * on the internet could send "your Backhome Buddy application was rejected"
 * from this company's authenticated sending domain, to any address, with the
 * greeting name under their control — harassment at your expense, and a fast
 * route to the domain being blocklisted.
 *
 * It is only ever called from admin-guarded actions (ops-actions.ts and
 * recruitment-actions.ts), which already know who is asking and who the
 * applicant is.
 */
import { sendEmailPublic } from "@/lib/notifications/notify";

if (typeof window !== "undefined") {
  throw new Error("admin/rejection-email is server-only and must never reach the browser.");
}

/** Sends a warm, encouraging rejection email that leaves the door open to
 *  reapply later. Used by both buddy-vetting and recruitment rejections.
 *  Failures are swallowed so they never block the status change itself. */
export async function sendRejectionEmail(to: string | null | undefined, name: string | null | undefined, kind: "buddy" | "recruit") {
  if (!to) return;
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const subject = "An update on your Backhome Buddy application";

  const body = kind === "buddy"
    ? `Hi ${first},

Thank you for taking the time to apply to become a Backhome Buddy and for going through our vetting process. We know it takes real effort, and we appreciate it.

After careful review, we're not able to move forward with your application at this time. This isn't a reflection of your worth — we hold our vetting to a high standard because our clients trust us with sensitive, personal tasks back home, and we have to be very careful about who represents us.

Please don't be discouraged. Circumstances and our needs change over time, and you're welcome to apply again in the future. If you do, we'd be glad to consider you afresh.

Thank you again, and we wish you all the very best.

Warm regards,
The Backhome Buddy team`
    : `Hi ${first},

Thank you for your interest in joining Backhome Buddy and for the time you gave to the process. We genuinely appreciate it.

After careful consideration, we won't be moving forward with your application at this stage. This is not a judgement of your ability — we simply have to be selective, because our clients trust us with important and personal matters back home.

We'd warmly encourage you to apply again in the future. Our needs grow and change, and we'd be happy to reconsider you another time.

Wishing you the very best,
The Backhome Buddy team`;

  try {
    await sendEmailPublic(to, subject, body);
  } catch {
    // Never let an email failure block the rejection itself.
  }
}
