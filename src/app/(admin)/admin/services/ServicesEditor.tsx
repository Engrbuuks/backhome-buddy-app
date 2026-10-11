"use client";
import React, { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { EmptyState, ErrorState } from "@/components/StateBlocks";
import { formatNGN } from "@/components/money";
import { saveServiceType, deleteServiceType, saveZoneUpliftPct, saveUrgentSurchargePct } from "@/lib/admin/config-actions";
import type { ServiceType } from "@/types/db";

type Row = Partial<ServiceType> & { _new?: boolean };

export default function ServicesEditor({ initial, upliftPct, urgentPct }: { initial: ServiceType[]; upliftPct: number; urgentPct: number }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [uplift, setUplift] = useState(String(upliftPct));
  const [upliftSaved, setUpliftSaved] = useState(false);
  const [urgent, setUrgent] = useState(String(urgentPct));
  const [urgentSaved, setUrgentSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // `boolean` added for handles_cash — the first checkbox-backed field on a service.
  function update(idx: number, field: keyof ServiceType, value: string | number | boolean) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { _new: true, name: "", base_price_ngn: 0, default_buddy_payout_pct: 60, active: true, trust_tier: "standard", handles_cash: false, min_completed_tasks: 0 }]);
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
          pricing_mode: (row as any).pricing_mode === "from" ? "from" : "quote",
          from_price_usd: Number((row as any).from_price_usd ?? 0),
          active: row.active ?? true,
          trust_tier: (row as any).trust_tier ?? "standard",
          handles_cash: Boolean((row as any).handles_cash),
          min_completed_tasks: Number((row as any).min_completed_tasks ?? 0),
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

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-3xl border border-bbb-border bg-white p-4 shadow-soft">
        <div className="min-w-[200px]">
          <p className="font-display text-base font-extrabold">Zone B uplift</p>
          <p className="text-xs text-bbb-slate">Published &quot;from&quot; prices are for Zone A states (Lagos, Abuja). Zone B states show the from-price + this percentage. Zones are set per state under Areas.</p>
        </div>
        <Field label="Uplift %" type="number" value={uplift} onChange={(e) => { setUplift(e.target.value); setUpliftSaved(false); }} className="w-28" />
        <button disabled={pending} onClick={() => startTransition(async () => { try { await saveZoneUpliftPct(Number(uplift)); setUpliftSaved(true); } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } })} className="h-11 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save uplift</button>
        {upliftSaved && <span className="text-sm font-semibold text-green-700">Saved ✓</span>}
        <div className="ml-2 border-l border-bbb-border pl-4">
          <p className="text-sm font-bold">Urgent surcharge</p>
          <p className="text-xs text-bbb-slate">Added on top for urgent tasks (shown to the client before submitting).</p>
        </div>
        <Field label="Surcharge %" type="number" value={urgent} onChange={(e) => { setUrgent(e.target.value); setUrgentSaved(false); }} className="w-28" />
        <button disabled={pending} onClick={() => startTransition(async () => { try { await saveUrgentSurchargePct(Number(urgent)); setUrgentSaved(true); } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } })} className="h-11 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save surcharge</button>
        {urgentSaved && <span className="text-sm font-semibold text-green-700">Saved ✓</span>}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No services yet" description="Add your first service type to get started." actionLabel="Add service" onAction={addRow} />
      ) : (
        <div className="space-y-3">
          {rows.map((service, idx) => (
            <article key={service.id ?? `new-${idx}`} className="grid gap-3 rounded-3xl border border-bbb-border bg-white p-4 shadow-soft md:grid-cols-[1.2fr_130px_100px_150px_130px_1fr_auto] md:items-end">
              <Field label="Service name" value={service.name ?? ""} onChange={(e) => update(idx, "name", e.target.value)} />
              <Field label="Base price (₦)" type="number" value={String(service.base_price_ngn ?? 0)} onChange={(e) => update(idx, "base_price_ngn", Number(e.target.value))} />
              <Field label="Payout %" type="number" value={String(service.default_buddy_payout_pct ?? 60)} onChange={(e) => update(idx, "default_buddy_payout_pct", Number(e.target.value))} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">Pricing mode</span>
                <select value={(service as any).pricing_mode ?? "quote"} onChange={(e) => update(idx, "pricing_mode" as any, e.target.value)} className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
                  <option value="quote">Quote only</option>
                  <option value="from">From price</option>
                </select>
              </label>
              <Field label="From $ (Zone A)" type="number" value={String((service as any).from_price_usd ?? 0)} onChange={(e) => update(idx, "from_price_usd" as any, Number(e.target.value))} />
              <div>
                <p className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">Client sees</p>
                <p className="rounded-xl bg-bbb-bg px-3 py-2.5 text-xs font-bold leading-5">{(service as any).pricing_mode === "from" && Number((service as any).from_price_usd) > 0 ? `from $${Number((service as any).from_price_usd)} (A) · $${Math.round(Number((service as any).from_price_usd) * (1 + Number(uplift || 0) / 100))} (B)` : "Priced per task — free quote in 24h"}</p>
              </div>
              <div className="md:col-span-7 grid gap-3 border-t border-bbb-border pt-3 md:grid-cols-[200px_200px_1fr] md:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">Trust tier</span>
                  <select
                    value={(service as any).trust_tier ?? "standard"}
                    onChange={(e) => update(idx, "trust_tier" as any, e.target.value)}
                    className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong"
                  >
                    <option value="standard">Standard</option>
                    <option value="high_value">High value — large sums, irreversible</option>
                    <option value="safeguarding">Safeguarding — vulnerable person</option>
                  </select>
                </label>
                <Field
                  label="Min completed tasks"
                  type="number"
                  value={String((service as any).min_completed_tasks ?? 0)}
                  onChange={(e) => update(idx, "min_completed_tasks" as any, Number(e.target.value))}
                />
                <label className="flex items-start gap-2.5 pb-2.5 text-sm leading-5">
                  <input
                    type="checkbox"
                    checked={Boolean((service as any).handles_cash)}
                    onChange={(e) => update(idx, "handles_cash" as any, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-bbb-border accent-[#079516]"
                  />
                  <span className="text-bbb-slate">
                    <span className="font-semibold text-bbb-charcoal">Buddy would receive client funds</span>
                    <span className="mt-0.5 block text-xs">Tick to flag it, then pay the vendor directly. A buddy holding client cash is the largest fraud surface in this model, and removing the cash beats policing it.</span>
                  </span>
                </label>
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
