"use client";
import React, { useState, useTransition } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";
import { recordManualRefund } from "@/lib/money/edge-actions";

export default function RefundsQueue({ rows }: { rows: any[] }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <AdminShell title="Refunds & Cancellations">
      <PageHeader eyebrow="Money back" title="Refunds & Cancellations" description="Cancelled requests still holding client funds. Transfer the refund to the client, then record it here — funds-held flips off and the ledger records the debit." />
      {error && <div className="mb-4"><ErrorState title="Refund failed" message={error} /></div>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No refunds pending — no cancelled requests with held funds.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-bbb-slate">{r.profiles?.full_name ?? "—"} · cancelled {formatDate(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-extrabold">{formatNGN(Number(r.client_price_ngn ?? 0))}</span>
                <button disabled={pending} onClick={() => start(async () => { setError(""); const res = await recordManualRefund(r.id); if (res?.error) setError(res.error); })} className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Record refund sent</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
