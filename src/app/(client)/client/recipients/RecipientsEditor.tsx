"use client";
import React, { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Field } from "@/components/FormControls";
import { ErrorState, EmptyState } from "@/components/StateBlocks";
import { saveRecipient, deleteRecipient } from "@/lib/client/actions";

type Row = { id?: string; name: string; phone?: string; address?: string; notes?: string; _new?: boolean };

export default function RecipientsEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const run = (fn: () => Promise<{ error: string }>, after?: () => void) => start(async () => { setError(""); const r = await fn(); if (r?.error) setError(r.error); else after?.(); });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Saved recipients</h1>
          <p className="mt-1 text-sm text-bbb-slate">People we deal with on your behalf — reusable across requests.</p>
        </div>
        <button onClick={() => setRows((r) => [{ _new: true, name: "" }, ...r])} className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark">+ Add recipient</button>
      </div>
      {error && <div className="mb-4"><ErrorState title="Could not save" message={error} /></div>}
      {rows.length === 0 ? (
        <EmptyState title="No recipients yet" description="Add family members or contacts you frequently send us to." actionLabel="Add recipient" onAction={() => setRows([{ _new: true, name: "" }])} />
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <article key={r.id ?? `new-${i}`} className="grid gap-3 rounded-3xl border border-bbb-border bg-white p-4 shadow-soft md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
              <Field label="Name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Field label="Phone" value={r.phone ?? ""} onChange={(e) => update(i, { phone: e.target.value })} />
              <Field label="Address" value={r.address ?? ""} onChange={(e) => update(i, { address: e.target.value })} />
              <div className="flex gap-2">
                <button disabled={pending} onClick={() => run(() => saveRecipient(r), () => r._new && setRows((a) => a.map((x, idx) => idx === i ? { ...x, _new: false } : x)))} className="h-11 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save</button>
                <button disabled={pending} onClick={() => r.id ? run(() => deleteRecipient(r.id!), () => setRows((a) => a.filter((_, idx) => idx !== i))) : setRows((a) => a.filter((_, idx) => idx !== i))} className="grid h-11 w-11 place-items-center rounded-xl border border-bbb-border text-bbb-slate hover:border-red-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
