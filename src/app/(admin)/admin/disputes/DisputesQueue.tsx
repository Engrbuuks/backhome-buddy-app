"use client";
import React, { useState, useTransition } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";
import { resolveDispute } from "@/lib/money/edge-actions";

export default function DisputesQueue({ rows }: { rows: any[] }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const act = (id: string, outcome: "refund" | "release" | "resume") =>
    start(async () => { setError(""); const r = await resolveDispute(id, outcome); if (r?.error) setError(r.error); });
  return (
    <AdminShell title="Disputes">
      <PageHeader eyebrow="Resolution" title="Open disputes" description="Review the client's issue, check the proof and timeline on the request page, then decide: refund the client, release to the buddy, or resume the work." />
      {error && <div className="mb-4"><ErrorState title="Action failed" message={error} /></div>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No open disputes.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <article key={d.id} className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <a href={`/admin/requests/${d.requests?.id}`} className="truncate font-semibold hover:text-bbb-strong">{d.requests?.title}</a>
                  <p className="text-xs text-bbb-slate">raised {formatDate(d.created_at)} · {formatNGN(Number(d.requests?.client_price_ngn ?? 0))}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={pending} onClick={() => act(d.id, "refund")} className="h-10 rounded-xl border border-bbb-border px-4 text-sm font-bold hover:border-red-300 hover:text-red-600 disabled:opacity-50">Refund client</button>
                  <button disabled={pending} onClick={() => act(d.id, "release")} className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Release to buddy</button>
                  <button disabled={pending} onClick={() => act(d.id, "resume")} className="h-10 rounded-xl border border-bbb-border px-4 text-sm font-bold hover:border-bbb-strong disabled:opacity-50">Resume work</button>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-bbb-bg p-3 text-sm text-bbb-slate">{d.reason}</p>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
