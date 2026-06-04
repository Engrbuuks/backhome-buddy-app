"use client";
import React, { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState, ErrorState } from "@/components/StateBlocks";
import { saveRegion, deleteRegion } from "@/lib/admin/config-actions";

interface Region { id?: string; name: string; state?: string | null; active?: boolean; _new?: boolean; }

export default function RegionsEditor({ initial }: { initial: Region[] }) {
  const [rows, setRows] = useState<Region[]>(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function update(idx: number, field: keyof Region, value: string) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { _new: true, name: "", state: "", active: true }]);
  }
  function save(idx: number) {
    const row = rows[idx];
    if (!row.name?.trim()) { setError("Region name is required."); return; }
    setError("");
    startTransition(async () => {
      try {
        await saveRegion({ id: row.id, name: row.name, state: row.state ?? "", active: row.active ?? true });
        setRows((r) => r.map((x, i) => (i === idx ? { ...x, _new: false } : x)));
      } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    });
  }
  function remove(idx: number) {
    const row = rows[idx];
    if (!row.id) { setRows((r) => r.filter((_, i) => i !== idx)); return; }
    startTransition(async () => {
      try {
        await deleteRegion(row.id!);
        setRows((r) => r.filter((_, i) => i !== idx));
      } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
    });
  }

  return (
    <AdminShell title="Regions / Coverage Config">
      <PageHeader
        eyebrow="Coverage"
        title="Covered cities & states"
        description="Operational coverage. Powers request feasibility and buddy assignment filters. Saves to the live database."
        actionLabel="+ Add region"
        onAction={addRow}
      />
      {error && <div className="mb-4"><ErrorState title="Could not save" message={error} /></div>}
      {rows.length === 0 ? (
        <EmptyState title="No regions yet" description="Add the first city/state you cover." actionLabel="Add region" onAction={addRow} />
      ) : (
        <div className="space-y-3">
          {rows.map((region, idx) => (
            <article key={region.id ?? `new-${idx}`} className="grid gap-3 rounded-3xl border border-bbb-border bg-white p-4 shadow-soft md:grid-cols-[1fr_1fr_110px_auto] md:items-end">
              <Field label="Region / City" value={region.name ?? ""} onChange={(e) => update(idx, "name", e.target.value)} />
              <Field label="State" value={region.state ?? ""} onChange={(e) => update(idx, "state", e.target.value)} />
              <div>
                <p className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">Status</p>
                <div className="pt-1"><StatusPill status={region.active === false ? "Inactive" : "Active"} /></div>
              </div>
              <div className="flex gap-2">
                <button disabled={pending} onClick={() => save(idx)} className="h-11 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save</button>
                <button disabled={pending} onClick={() => remove(idx)} className="grid h-11 w-11 place-items-center rounded-xl border border-bbb-border text-bbb-slate hover:border-red-300 hover:text-red-600" aria-label="Disable region"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
