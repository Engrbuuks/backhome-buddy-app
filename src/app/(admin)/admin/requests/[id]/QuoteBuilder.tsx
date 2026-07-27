"use client";
import React, { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { StatusPill } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN } from "@/components/money";
import { sendQuote } from "@/lib/admin/quote-actions";
import { acceptCounterOffer } from "@/lib/admin/quote-actions";
import { aiSuggestQuoteItems } from "@/lib/ai/assist-actions";

interface Item { label: string; amount_ngn: number }

export default function QuoteBuilder({ request, actionSlot, expectations, urgentSurchargePct = 40 }: { request: any; actionSlot?: React.ReactNode; expectations?: string | null; urgentSurchargePct?: number }) {
  const existing: Item[] = (request.quote_items ?? []).map((q: any) => ({ label: q.label, amount_ngn: Number(q.amount_ngn) }));
  const basePrice = Number(request.service_types?.base_price_ngn ?? 0);
  const defaults: Item[] = [{ label: request.service_types?.name ?? "Service", amount_ngn: basePrice }];
  if (request.urgency === "urgent") {
    defaults.push({ label: "Urgent priority surcharge", amount_ngn: Math.round(basePrice * urgentSurchargePct / 100) });
  }
  const [items, setItems] = useState<Item[]>(existing.length ? existing : defaults);
  const [payout, setPayout] = useState<number>(Number(request.buddy_payout_ngn ?? 0));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.amount_ngn || 0), 0), [items]);
  const defaultPct = Number(request.service_types?.default_buddy_payout_pct ?? 60);
  const suggested = Math.round(total * defaultPct / 100);
  const margin = total - (payout || 0);
  const negotiating = request.status === "quoted" && (request.quote_decision === "countered" || request.quote_decision === "changes_requested");
  const quotable = request.status === "submitted" || request.status === "draft" || negotiating;

  function update(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function aiSuggest() {
    setError("");
    startTransition(async () => {
      const res = await aiSuggestQuoteItems(request.id);
      if (res?.error) { setError(res.error); return; }
      if (res.items?.length) setItems(res.items);
    });
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await sendQuote({ requestId: request.id, items, buddy_payout_ngn: payout });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <AdminShell title="Quote Builder">
      <PageHeader eyebrow="Quote" title={request.title}
        description={`${request.profiles?.full_name ?? "Client"} · ${request.profiles?.email ?? ""}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill status={request.status} />
        {request.urgency === "urgent" && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">Urgent — quote within 6h</span>}
      </div>

      {request.quote_decision === "countered" && request.counter_amount_ngn && (
        <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-display text-base font-extrabold text-amber-900">💬 Client counter-offer</p>
          <p className="mt-1 text-sm text-amber-800">
            The client proposed <span className="font-extrabold">{formatNGN(Number(request.counter_amount_ngn))}</span> vs your quote of {formatNGN(Number(request.client_price_ngn ?? 0))}.
            {request.quote_decision_note ? <> They said: &quot;{request.quote_decision_note}&quot;</> : null}
          </p>
          <p className="mt-1 text-xs text-amber-700">Round {Number(request.negotiation_rounds || 0)} of 3. Accept their price, or edit the items below and send a revised quote.</p>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { setError(""); const r = await acceptCounterOffer(request.id); if (r?.error) setError(r.error); })}
            className="mt-3 h-11 rounded-xl bg-amber-600 px-5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
            {pending ? "…" : `Accept client's price (${formatNGN(Number(request.counter_amount_ngn))})`}
          </button>
        </div>
      )}

      {request.quote_decision === "changes_requested" && (
        <div className="mb-4 rounded-2xl border-2 border-bbb-strong/30 bg-bbb-soft p-4">
          <p className="font-display text-base font-extrabold">Client requested changes</p>
          <p className="mt-1 text-sm text-bbb-slate">&quot;{request.quote_decision_note}&quot; — adjust the items below and send a revised quote.</p>
        </div>
      )}
      {actionSlot}
      {expectations && (
        <div className="mb-4 rounded-2xl border border-bbb-border bg-bbb-soft p-4 shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-dark">Client&apos;s checklist (context for the quote — the quote remains the agreed scope)</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-bbb-charcoal">{expectations}</p>
        </div>
      )}
      {(request.regions?.name || request.requested_state) && (
        <div className="mb-4 rounded-2xl border border-bbb-border bg-white p-3 text-sm shadow-soft">
          <span className="font-semibold">Location: </span>
          {request.regions?.name
            ? <>{request.regions.name} <span className="text-bbb-slate">(Zone {request.regions.zone ?? "B"})</span></>
            : <span className="font-bold text-amber-700">Out of coverage — {request.requested_state} (expansion lead: quote only if we can reach it safely)</span>}
        </div>
      )}
      {request.description && (
        <div className="mb-5 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <p className="text-sm leading-7 text-bbb-slate">{request.description}</p>
          <p className="mt-3 text-xs text-bbb-slate">Recipient: {request.recipient_name || "—"} · {request.recipient_phone || "—"} · {request.recipient_address || "—"}</p>
        </div>
      )}
      {error && <div className="mb-4"><ErrorState title="Could not send quote" message={error} /></div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Line items</h2>
            <button onClick={() => setItems((a) => [...a, { label: "", amount_ngn: 0 }])} className="flex items-center gap-1 rounded-xl border border-bbb-border px-3 py-1.5 text-xs font-bold hover:border-bbb-strong"><Plus className="h-3.5 w-3.5" />Add item</button>
            {quotable && <button disabled={pending} onClick={aiSuggest} className="rounded-xl border border-bbb-border px-3 py-1.5 text-xs font-bold text-bbb-strong hover:border-bbb-strong disabled:opacity-50">{pending ? "…" : "✦ AI suggest items"}</button>}
          </div>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] items-end gap-3">
                <Field label={i === 0 ? "Item" : ""} value={it.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="e.g. Site visit" />
                <Field label={i === 0 ? "Amount (₦)" : ""} type="number" value={String(it.amount_ngn)} onChange={(e) => update(i, { amount_ngn: Number(e.target.value) })} />
                <button onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} className="grid h-11 w-11 place-items-center rounded-xl border border-bbb-border text-bbb-slate hover:border-red-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between"><span className="text-sm text-bbb-slate">Client price</span><span className="font-display text-xl font-extrabold">{formatNGN(total)}</span></div>
            <div className="mt-4">
              <Field label={`Buddy payout (₦) — suggested ${defaultPct}%: ${formatNGN(suggested)}`} type="number" value={String(payout)} onChange={(e) => setPayout(Number(e.target.value))} />
              <button onClick={() => setPayout(suggested)} className="mt-1 text-xs font-bold text-bbb-strong hover:text-bbb-dark">Use suggested</button>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-bbb-border pt-3">
              <span className="text-sm font-bold">Your margin</span>
              <span className={`font-display text-lg font-extrabold ${margin < 0 ? "text-red-600" : "text-bbb-dark"}`}>{formatNGN(margin)}</span>
            </div>
            <p className="mt-2 text-[11px] text-bbb-slate">The buddy never sees the client price — only their payout.</p>
          </div>
          <button disabled={pending || !quotable} onClick={submit} className="h-12 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
            {quotable ? (pending ? "Sending..." : "Send quote to client") : `Already ${request.status}`}
          </button>
        </aside>
      </div>
    </AdminShell>
  );
}
