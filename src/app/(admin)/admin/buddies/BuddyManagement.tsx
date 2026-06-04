"use client";
import React, { useState, useTransition } from "react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { setBuddyVetting, createBuddyProfileRow } from "@/lib/admin/ops-actions";

export default function BuddyManagement({ buddies, missing }: { buddies: any[]; missing: any[] }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string }>) => start(async () => { setError(""); const r = await fn(); if (r?.error) setError(r.error); });

  return (
    <AdminShell title="Buddy Management">
      <PageHeader eyebrow="People" title="Buddy Management" description="Vet applications, approve or suspend buddies. Only approved buddies can be assigned tasks." />
      {error && <div className="mb-4"><ErrorState title="Action failed" message={error} /></div>}

      {missing.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">Accounts with buddy role but no buddy profile:</p>
          {missing.map((m: any) => (
            <div key={m.id} className="mt-2 flex items-center justify-between text-sm">
              <span>{m.full_name ?? m.email}</span>
              <button disabled={pending} onClick={() => run(() => createBuddyProfileRow(m.id))} className="rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Create profile</button>
            </div>
          ))}
        </div>
      )}

      {buddies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No buddy applications yet.</div>
      ) : (
        <div className="space-y-3">
          {buddies.map((b: any) => (
            <article key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="font-semibold">{b.profiles?.full_name ?? b.profiles?.email}</p>
                <p className="text-xs text-bbb-slate">{b.profiles?.email} · {b.profiles?.phone ?? "—"}{b.bank_name ? ` · ${b.bank_name} ${b.bank_account_number ?? ""}` : " · no payout details yet"}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={statusLabel(b.vetting)} />
                {b.vetting !== "approved" && <button disabled={pending} onClick={() => run(() => setBuddyVetting(b.id, "approved"))} className="rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Approve</button>}
                {b.vetting === "approved" && <button disabled={pending} onClick={() => run(() => setBuddyVetting(b.id, "suspended"))} className="rounded-lg border border-bbb-border px-3 py-1.5 text-xs font-bold hover:border-red-300 hover:text-red-600 disabled:opacity-50">Suspend</button>}
                {["applied", "under_review"].includes(b.vetting) && <button disabled={pending} onClick={() => run(() => setBuddyVetting(b.id, "rejected"))} className="rounded-lg border border-bbb-border px-3 py-1.5 text-xs font-bold hover:border-red-300 hover:text-red-600 disabled:opacity-50">Reject</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
