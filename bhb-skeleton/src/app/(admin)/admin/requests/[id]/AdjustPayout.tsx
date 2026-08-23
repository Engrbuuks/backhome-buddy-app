"use client";
import React, { useState, useTransition } from "react";
import { Coins, Loader2 } from "lucide-react";
import { adjustBuddyPayout } from "@/lib/admin/workflow-actions";
import { formatNGN } from "@/components/money";

/** Change a buddy's payout after the quote stage (e.g. on a completed task).
 *  If the task is already paid out, this records the difference as a top-up. */
export default function AdjustPayout({ requestId, current, status }: { requestId: string; current: number; status: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(Number(current || 0));
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const alreadyPaid = status === "paid_out";

  const save = () => start(async () => {
    setErr(""); setMsg("");
    const res = await adjustBuddyPayout(requestId, amount, reason.trim() || undefined);
    if (res.error) { setErr(res.error); return; }
    const diff = (res as any).diff ?? 0;
    setMsg(alreadyPaid
      ? `Updated. ${diff > 0 ? `Top-up of ${formatNGN(diff)} recorded for the buddy.` : `Correction of ${formatNGN(Math.abs(diff))} recorded.`}`
      : "Payout updated. The new amount will be used when you release it.");
  });

  return (
    <div className="mt-3 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-bbb-charcoal">Buddy payout</p>
          <p className="text-xs text-bbb-slate">Current: {formatNGN(current || 0)}</p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-bbb-border bg-white px-3 py-1.5 text-xs font-bold text-bbb-strong hover:border-bbb-strong">
            <Coins className="h-3.5 w-3.5" /> Adjust
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {alreadyPaid && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">This task is already paid out. Raising the amount records a top-up for the difference; lowering it records a correction.</p>
          )}
          <label className="block text-xs font-bold text-bbb-slate">New payout (₦)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional — for your records)" className="h-10 w-full rounded-xl border border-bbb-border px-3 text-xs outline-none focus:border-bbb-strong" />
          {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
          {msg && <p className="text-xs font-semibold text-green-700">{msg}</p>}
          <div className="flex gap-2">
            <button disabled={pending} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save payout
            </button>
            <button onClick={() => { setOpen(false); setMsg(""); setErr(""); }} className="rounded-xl px-3 py-2 text-sm font-bold text-bbb-slate">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
