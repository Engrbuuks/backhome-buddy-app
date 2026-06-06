"use client";
import React, { useState, useTransition } from "react";
import { ErrorState } from "@/components/StateBlocks";
import { recordManualPayment, assignBuddy, reviewProof } from "@/lib/admin/workflow-actions";
import { ProofMedia } from "@/components/ProofMedia";

export default function WorkflowPanel({ request, buddies }: { request: any; buddies: any[] }) {
  const [error, setError] = useState("");
  const [buddyId, setBuddyId] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string }>) => start(async () => { setError(""); const r = await fn(); if (r?.error) setError(r.error); });

  const proofs = request.proofs ?? [];
  return (
    <div className="mb-5 rounded-3xl border-2 border-bbb-strong/30 bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-extrabold">Next action</h2>
      {error && <div className="mt-3"><ErrorState title="Action failed" message={error} /></div>}

      {request.status === "quoted" && (
        <div className="mt-4">
          <p className="text-sm text-bbb-slate">Client received the quote. When their bank transfer lands, record it — funds will be marked held.</p>
          <button disabled={pending} onClick={() => run(() => recordManualPayment(request.id))} className="mt-3 h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Record offline payment (₦)</button>
        </div>
      )}

      {request.status === "paid" && (
        <div className="mt-4">
          <p className="text-sm text-bbb-slate">Funds held. Assign an approved buddy.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select value={buddyId} onChange={(e) => setBuddyId(e.target.value)} className="h-11 rounded-xl border border-bbb-border bg-white px-3 text-sm">
              <option value="">Select buddy…</option>
              {buddies.map((b: any) => <option key={b.id} value={b.id}>{b.profiles?.full_name ?? b.profiles?.email}</option>)}
            </select>
            <button disabled={pending || !buddyId} onClick={() => run(() => assignBuddy(request.id, buddyId))} className="h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Assign buddy</button>
          </div>
          {buddies.length === 0 && <p className="mt-2 text-xs text-amber-600">No approved buddies — approve one in Supabase (buddy_profiles.vetting = approved) or via Buddy Management later.</p>}
        </div>
      )}

      {request.status === "proof_ready" && (
        <div className="mt-4">
          <p className="text-sm font-bold">Submitted proof:</p>
          <div className="mt-2 space-y-2">{proofs.filter((p: any) => p.note).map((p: any) => <div key={p.id} className="rounded-xl bg-bbb-bg p-3 text-sm">{p.note}</div>)}</div>
          <ProofMedia proofs={proofs} />
          <div className="mt-3 flex flex-wrap gap-3">
            <button disabled={pending} onClick={() => run(() => reviewProof(request.id, true, ""))} className="h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Approve proof</button>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs fixing?" className="h-11 flex-1 rounded-xl border border-bbb-border px-3 text-sm" />
            <button disabled={pending || !note.trim()} onClick={() => run(() => reviewProof(request.id, false, note))} className="h-11 rounded-xl border border-bbb-border px-5 text-sm font-bold hover:border-red-300 hover:text-red-600 disabled:opacity-50">Request changes</button>
          </div>
        </div>
      )}

      {["assigned", "in_progress"].includes(request.status) && <p className="mt-3 text-sm text-bbb-slate">Waiting on the buddy ({request.status === "assigned" ? "not started yet" : "working"}). Proof will appear here for review.</p>}
      {request.status === "proof_approved" && <p className="mt-3 text-sm text-bbb-slate">Approved — waiting for the client to confirm completion. Then the payout becomes eligible.</p>}
      {request.status === "completed" && <p className="mt-3 text-sm font-bold text-bbb-dark">Completed and client-confirmed. Release it from the Payouts Queue.</p>}
    </div>
  );
}
