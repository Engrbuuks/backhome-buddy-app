"use client";
import React, { useState, useTransition } from "react";
import { KeyRound, Copy, Check, Loader2 } from "lucide-react";
import { adminResetClientPassword } from "@/lib/admin/clients-actions";

/** Lets an admin trigger a password reset for this client. Emails the link and
 *  also shows a copyable recovery link as a fallback (in case email doesn't
 *  deliver — e.g. spam), which the admin can send via WhatsApp etc. */
export default function ResetPasswordButton({ clientId, hasEmail }: { clientId: string; hasEmail: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ emailed?: boolean; link?: string } | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const go = () => start(async () => {
    setErr(""); setRes(null);
    const r = await adminResetClientPassword(clientId);
    if (r.error) { setErr(r.error); return; }
    setRes({ emailed: r.emailed, link: r.link });
  });

  const copy = async () => {
    if (!res?.link) return;
    try { await navigator.clipboard.writeText(res.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  if (!hasEmail) return <p className="text-sm text-bbb-slate">No email on file — can't reset password.</p>;

  return (
    <div>
      <button onClick={go} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-bbb-border px-4 py-2.5 text-sm font-bold text-bbb-charcoal hover:border-bbb-strong disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? "Sending…" : "Reset this client's password"}
      </button>

      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}

      {res && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
          {res.emailed && <p className="font-semibold text-green-800">✓ A reset email has been sent to the client.</p>}
          {res.link && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-bbb-slate">Backup link (send via WhatsApp if the email doesn&apos;t arrive):</p>
              <div className="mt-1 flex items-center gap-2">
                <input readOnly value={res.link} className="flex-1 rounded-lg border border-bbb-border bg-white px-2 py-1.5 text-xs" />
                <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-bbb-slate">This link lets them set a new password. It expires for security, so send it promptly.</p>
            </div>
          )}
          {!res.link && !res.emailed && <p className="text-amber-700">Triggered, but no confirmation — check email configuration.</p>}
        </div>
      )}
    </div>
  );
}
