"use client";
import React, { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { EmptyState, ErrorState } from "@/components/StateBlocks";
import { formatNGN } from "@/components/money";
import { saveServiceType, deleteServiceType } from "@/lib/admin/config-actions";
import type { ServiceType } from "@/types/db";

type Row = Partial<ServiceType> & { _new?: boolean };

export default function ServicesEditor({ initial }: { initial: ServiceType[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function update(idx: number, field: keyof ServiceType, value: string | number) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { _new: true, name: "", base_price_ngn: 0, default_buddy_payout_pct: 60, active: true }]);
  }
  function save(idx: number) {
    const row = rows[idx];
    if (!row.name?.trim()) { setError("Service name is required."); return; }
    setError("");
    startTransition(async () => {
      try {
        await saveServiceType({
          id: row.id,
          name: row.name!,
          base_price_ngn: Number(row.base_price_ngn ?? 0),
          default_buddy_payout_pct: Number(row.default_buddy_payout_pct ?? 60),
          active: row.active ?? true,
        });
        // mark as saved (clear _new) — server revalidate will refresh on next load
        setRows((r) => r.map((x, i) => (i === idx ? { ...x, _new: false } : x)));
      } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    });
  }
  function remove(idx: number) {
    const row = rows[idx];
    if (!row.id) { setRows((r) => r.filter((_, i) => i !== idx)); return; }
    startTransition(async () => {
      try {
        await deleteServiceType(row.id!);
        setRows((r) => r.filter((_, i) => i !== idx));
      } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    });
  }

  return (
    <AdminShell title="Service & Pricing Config">
      <PageHeader
        eyebrow="Catalogue"
        title="Service & pricing configuration"
        description="Edit service types, base pricing and default buddy payout percentage. Changes save to the live database."
        actionLabel="+ Add service"
        onAction={addRow}
      />
      {error && <div className="mb-4"><ErrorState title="Could not save" message={error} /></div>}
      {rows.length === 0 ? (
        <EmptyState title="No services yet" description="Add your first service type to get started." actionLabel="Add service" onAction={addRow} />
      ) : (
        <div className="space-y-3">
          {rows.map((service, idx) => (
            <article key={service.id ?? `new-${idx}`} className="grid gap-3 rounded-3xl border border-bbb-border bg-white p-4 shadow-soft md:grid-cols-[1fr_150px_120px_120px_auto] md:items-end">
              <Field label="Service name" value={service.name ?? ""} onChange={(e) => update(idx, "name", e.target.value)} />
              <Field label="Base price (₦)" type="number" value={String(service.base_price_ngn ?? 0)} onChange={(e) => update(idx, "base_price_ngn", Number(e.target.value))} />
              <Field label="Payout %" type="number" value={String(service.default_buddy_payout_pct ?? 60)} onChange={(e) => update(idx, "default_buddy_payout_pct", Number(e.target.value))} />
              <div>
                <p className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">Preview</p>
                <p className="rounded-xl bg-bbb-bg px-3 py-2.5 text-sm font-bold">{formatNGN(Number(service.base_price_ngn || 0))}</p>
              </div>
              <div className="flex gap-2">
                <button disabled={pending} onClick={() => save(idx)} className="h-11 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save</button>
                <button disabled={pending} onClick={() => remove(idx)} className="grid h-11 w-11 place-items-center rounded-xl border border-bbb-border text-bbb-slate hover:border-red-300 hover:text-red-600" aria-label="Disable service"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
