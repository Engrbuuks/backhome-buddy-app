"use client";
import React, { useState, useTransition } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";
import { releaseManualPayout } from "@/lib/admin/workflow-actions";
import { runAutoReleaseNow } from "@/lib/money/auto-release-action";

export default function PayoutsQueue({ rows }: { rows: any[] }) {
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();
  return (
    <AdminShell title="Payouts Queue">
      <PageHeader eyebrow="Money out" title="Payouts Queue" description="Client-confirmed tasks. Transfer to the buddy's bank, then record the release here. Funds-held flips off and the ledger records the debit." actionLabel="Run auto-release check" onAction={() => start(async () => { setInfo(""); setError(""); const r = await runAutoReleaseNow(); if (r.error) setError(r.error); else setInfo(r.released ? `${r.released} request(s) auto-confirmed.` : "Nothing eligible for auto-release yet."); })} />
      {info && <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">{info}</div>}
      {error && <div className="mb-4"><ErrorState title="Release failed" message={error} /></div>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No payouts pending.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-bbb-slate">{r.buddy_name || "Unnamed buddy"} · {r.bank?.bank_account_number ? `${r.bank.bank_name} ${r.bank.bank_account_number} (${r.bank.bank_account_name})` : "⚠ no bank details on file"} · {formatDate(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-extrabold">{formatNGN(Number(r.buddy_payout_ngn ?? 0))}</span>
                <button
                  disabled={pending}
                  onClick={() => start(async () => {
                    if (!r.bank?.bank_account_number && !confirm("This buddy has no bank details on file. Only record this if you've paid them another way (cash, transfer to phone, etc.). Continue?")) return;
                    setError(""); const res = await releaseManualPayout(r.id); if (res?.error) setError(res.error);
                  })}
                  className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
                >Record payout released</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
