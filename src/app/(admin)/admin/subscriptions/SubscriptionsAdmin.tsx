"use client";
/**
 * Monthly retainers, and the one number that tells you whether this business
 * is working: revenue you can count on next month without selling anything.
 */
import React, { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";
import { createSubscription, updateSubscription, runSubscriptionsNow } from "@/lib/subscriptions/actions";

export default function SubscriptionsAdmin({
  rows = [], clients = [], services = [], regions = [], mrrNgn = 0, migrationMissing = false,
}: {
  rows?: any[]; clients?: any[]; services?: any[]; regions?: any[]; mrrNgn?: number; migrationMissing?: boolean;
}) {
  const [error, setError] = useState("");
  const [report, setReport] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, action] = useFormState(createSubscription, { error: "" } as any);

  const active = rows.filter((r) => r.status === "active");

  return (
    <AdminShell title="Monthly Retainers">
      <PageHeader
        eyebrow="Money"
        title="Monthly Retainers"
        description="A price agreed once, a task raised every month, and no quote in between. This is the only revenue here that arrives without you selling it again."
      />

      {migrationMissing && (
        <section className="mb-5 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
          <h2 className="font-display text-base font-extrabold text-amber-900">Retainers are not installed yet</h2>
          <p className="mt-1 text-sm text-amber-800">
            Run <strong>supabase/migrations/0045_service_catalogue_and_instant_pricing.sql</strong> in Supabase.
          </p>
        </section>
      )}

      {error && <div className="mb-4"><ErrorState title="That did not go through" message={error} /></div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Monthly recurring</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-green-700">{formatNGN(mrrNgn)}</p>
          <p className="mt-1 text-xs text-bbb-slate">Due next month without a single new sale</p>
        </div>
        <div className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Active retainers</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Average</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {formatNGN(active.length ? Math.round(mrrNgn / active.length) : 0)}
          </p>
          <p className="mt-1 text-xs text-bbb-slate">Per retainer, per month</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark"
        >
          {open ? "Close" : "Set up a retainer"}
        </button>
        <button
          disabled={pending}
          onClick={() => start(async () => {
            setError(""); setReport(null);
            const r = await runSubscriptionsNow();
            if (!r) { setError("Not authorized."); return; }
            setReport(r);
          })}
          className="h-11 rounded-xl border border-bbb-border px-5 text-sm font-bold text-bbb-slate hover:bg-bbb-bg disabled:opacity-50"
        >
          {pending ? "Raising…" : "Raise what is due now"}
        </button>
      </div>

      {report && (
        <div className="mb-5 rounded-2xl bg-bbb-bg p-4 text-sm">
          <p className="font-semibold">
            {report.due} due, {report.raised} raised.
          </p>
          {report.skipped?.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-bbb-slate">
              {report.skipped.map((s: any) => <li key={s.id}>{s.title} — {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      {open && (
        <form action={action} className="mb-6 space-y-3 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <p className="font-display text-base font-extrabold">New retainer</p>
          <p className="text-sm text-bbb-slate">
            The title becomes the title of every month&apos;s task. The price is what you agreed with the client, and
            it is the whole reason this skips the quote.
          </p>
          {state?.error && <ErrorState title="Could not save" message={state.error} />}
          {(state as any)?.saved && <p className="text-sm font-bold text-green-700">Saved. The first task is scheduled.</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Client</span>
              <select name="client_id" required className="mt-1 h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm">
                <option value="">Pick the client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Service</span>
              <select name="service_type_id" className="mt-1 h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm">
                <option value="">No specific service</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Title of each month&apos;s task</span>
            <input name="title" required placeholder="e.g. Monthly visit to Mrs Okeke, Bodija" className="mt-1 h-11 w-full rounded-xl border border-bbb-border px-3 text-sm" />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">State</span>
              <select name="region_id" className="mt-1 h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm">
                <option value="">Not set</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Monthly price (₦)</span>
              <input name="monthly_price_ngn" type="number" min={1} required placeholder="45000" className="mt-1 h-11 w-full rounded-xl border border-bbb-border px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Day of month</span>
              <input name="day_of_month" type="number" min={1} max={28} defaultValue={1} className="mt-1 h-11 w-full rounded-xl border border-bbb-border px-3 text-sm" />
              <span className="mt-1 block text-[11px] text-bbb-slate">1 to 28, so February never skips</span>
            </label>
          </div>

          <textarea name="description" rows={3} placeholder="What should happen each month?" className="w-full rounded-xl border border-bbb-border p-3 text-sm" />

          <div className="grid gap-3 sm:grid-cols-3">
            <input name="recipient_name" placeholder="Recipient name" className="h-11 rounded-xl border border-bbb-border px-3 text-sm" />
            <input name="recipient_phone" placeholder="Recipient phone" className="h-11 rounded-xl border border-bbb-border px-3 text-sm" />
            <input name="recipient_address" placeholder="Recipient address" className="h-11 rounded-xl border border-bbb-border px-3 text-sm" />
          </div>

          <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">
            Create the retainer
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">
          No retainers yet. The easiest first one is a client who has already paid you once and was pleased.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RetainerRow key={r.id} r={r} onError={setError} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function RetainerRow({ r, onError }: { r: any; onError: (s: string) => void }) {
  const [price, setPrice] = useState(String(Math.round(Number(r.monthly_price_ngn ?? 0))));
  const [pending, start] = useTransition();
  const client = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? {};

  const change = (patch: any) => start(async () => {
    onError("");
    const res = await updateSubscription(r.id, patch);
    if (res?.error) onError(res.error);
  });

  return (
    <article className={`rounded-2xl border p-4 shadow-soft ${r.status === "active" ? "border-bbb-border bg-white" : "border-bbb-border bg-bbb-bg"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.title}</p>
          <p className="text-xs text-bbb-slate">
            {client.full_name || client.email || "—"}
            {r.service_types?.name ? ` · ${r.service_types.name}` : ""}
            {r.regions?.name ? ` · ${r.regions.name}` : ""}
            {" · "}day {r.day_of_month}
            {r.runs_count > 0 ? ` · ${r.runs_count} raised so far` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display font-extrabold">{formatNGN(Number(r.monthly_price_ngn ?? 0))}<span className="text-xs font-semibold text-bbb-slate">/month</span></p>
          <p className="text-[11px] text-bbb-slate">
            {r.status === "active" ? `next ${formatDate(r.next_run_on)}` : r.status}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)}
          className="h-9 w-32 rounded-lg border border-bbb-border px-2 text-sm"
        />
        <button
          disabled={pending || Number(price) === Math.round(Number(r.monthly_price_ngn ?? 0))}
          onClick={() => change({ monthly_price_ngn: Number(price) })}
          className="h-9 rounded-lg bg-bbb-strong px-3 text-xs font-bold text-white disabled:opacity-40"
        >
          Change price
        </button>
        {r.status === "active" ? (
          <button disabled={pending} onClick={() => change({ status: "paused" })} className="h-9 rounded-lg border border-bbb-border px-3 text-xs font-bold text-bbb-slate disabled:opacity-50">
            Pause
          </button>
        ) : r.status === "paused" ? (
          <button disabled={pending} onClick={() => change({ status: "active" })} className="h-9 rounded-lg border border-bbb-border px-3 text-xs font-bold text-green-700 disabled:opacity-50">
            Resume
          </button>
        ) : null}
        {r.status !== "cancelled" && (
          <button
            disabled={pending}
            onClick={() => { if (window.confirm("Cancel this retainer? No further tasks will be raised.")) change({ status: "cancelled" }); }}
            className="h-9 rounded-lg border border-bbb-border px-3 text-xs font-bold text-bbb-slate hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
