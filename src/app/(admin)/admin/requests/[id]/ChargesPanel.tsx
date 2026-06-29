"use client";
import React, { useState, useTransition } from "react";
import { ErrorState } from "@/components/StateBlocks";
import { proposeCharge, recordChargePayment } from "@/lib/admin/charge-actions";

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-600",
};

export default function ChargesPanel({ request, charges }: { request: any; charges: any[] }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [buddyExtra, setBuddyExtra] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string }>) => start(async () => { setError(""); const r = await fn(); if (r?.error) setError(r.error); });
  const activeTask = ["paid", "assigned", "in_progress", "proof_submitted"].includes(request.status);

  return (
    <div className="mb-5 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-extrabold">Additional charges</h2>
      <p className="mt-1 text-xs text-bbb-slate">For significant unforeseen costs mid-task. The client must approve before work continues; collect by transfer (verify in your bank first), then record it here.</p>
      {error && <div className="mt-3"><ErrorState title="Action failed" message={error} /></div>}

      {charges.length > 0 && (
        <div className="mt-4 space-y-2">
          {charges.map((c: any) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-bbb-bg p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">₦{Number(c.amount_ngn).toLocaleString()} <span className="font-normal text-bbb-slate">· {c.reason}</span></p>
                {Number(c.buddy_extra_ngn) > 0 && <p className="text-xs text-bbb-slate">Buddy share: ₦{Number(c.buddy_extra_ngn).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[c.status] ?? ""}`}>{c.status}</span>
                {c.status === "approved" && (
                  <button disabled={pending} onClick={() => run(() => recordChargePayment(c.id))} className="rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Record payment</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTask ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_140px_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Reason (the client sees this)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Agency demanded an official re-stamping fee" className="h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Extra (₦)</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Buddy share (₦)</span>
            <input type="number" value={buddyExtra} onChange={(e) => setBuddyExtra(e.target.value)} className="h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          </label>
          <button disabled={pending || !reason || !amount} onClick={() => run(async () => { const r = await proposeCharge(request.id, reason, Number(amount), Number(buddyExtra || 0)); if (!r?.error) { setReason(""); setAmount(""); setBuddyExtra(""); } return r; })} className="h-11 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Propose to client</button>
        </div>
      ) : (
        charges.length === 0 && <p className="mt-3 text-xs text-bbb-slate">Available once the task is paid/active.</p>
      )}
    </div>
  );
}
