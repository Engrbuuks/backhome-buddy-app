"use client";
import React, { useState, useTransition } from "react";
import { ErrorState } from "@/components/StateBlocks";
import { decideCharge } from "@/lib/admin/charge-actions";

export default function ClientCharges({ charges }: { charges: any[] }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  // Which charge the client is pushing back on, and what they want to say.
  const [pushingBack, setPushingBack] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  if (!charges.length) return null;
  const run = (fn: () => Promise<{ error: string }>) => start(async () => { setError(""); const r = await fn(); if (r?.error) setError(r.error); });

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-extrabold">Additional costs</h2>
      <p className="mt-1 text-xs leading-5 text-bbb-slate">Sometimes a task meets an unforeseen cost (an official fee, a required return visit). We pause and ask first — work on the affected item continues only after your approval.</p>
      {error && <div className="mt-3"><ErrorState title="Action failed" message={error} /></div>}
      <div className="mt-4 space-y-3">
        {charges.map((c: any) => (
          <div key={c.id} className="rounded-2xl bg-bbb-bg p-4">
            <p className="text-sm font-semibold">₦{Number(c.amount_ngn).toLocaleString()}</p>
            <p className="mt-1 text-sm text-bbb-slate">{c.reason}</p>
            {c.status === "proposed" ? (
              pushingBack === c.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="What do you think it should be, or why does this not look right?"
                    className="min-h-[80px] w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={pending || !reason.trim()}
                      onClick={() => run(async () => {
                        const r = await decideCharge(c.id, false, reason);
                        if (!r?.error) { setPushingBack(null); setReason(""); }
                        return r;
                      })}
                      className="h-10 flex-1 rounded-xl bg-amber-500 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      Send to our team
                    </button>
                    <button type="button" onClick={() => { setPushingBack(null); setReason(""); }} className="h-10 rounded-xl border border-bbb-border px-4 text-sm font-bold text-bbb-slate">
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button disabled={pending} onClick={() => run(() => decideCharge(c.id, true))} className="h-10 flex-1 rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Approve</button>
                  <button disabled={pending} onClick={() => { setPushingBack(c.id); setReason(""); }} className="h-10 flex-1 rounded-xl border border-bbb-border bg-white text-sm font-bold hover:border-amber-300 hover:text-amber-700 disabled:opacity-50">Push back on this</button>
                </div>
              )
            ) : (
              <p className="mt-2 text-xs font-bold capitalize text-bbb-slate">{c.status === "paid" ? "Paid — work continuing" : c.status}</p>
            )}
            {c.status === "approved" && <p className="mt-1 text-xs text-bbb-slate">Approved — pay by the same transfer details as your quote; we&apos;ll confirm once it lands.</p>}
            {c.status === "declined" && c.decline_reason && <p className="mt-1 text-xs text-bbb-slate">You said: &ldquo;{c.decline_reason}&rdquo;. Our team will come back to you.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
