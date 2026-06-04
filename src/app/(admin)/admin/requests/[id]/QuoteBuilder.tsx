"use client";
import React, { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { StatusPill } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN } from "@/components/money";
import { sendQuote } from "@/lib/admin/quote-actions";

interface Item { label: string; amount_ngn: number }

export default function QuoteBuilder({ request }: { request: any }) {
  const existing: Item[] = (request.quote_items ?? []).map((q: any) => ({ label: q.label, amount_ngn: Number(q.amount_ngn) }));
  const [items, setItems] = useState<Item[]>(existing.length ? existing : [{ label: request.service_types?.name ?? "Service", amount_ngn: Number(request.service_types?.base_price_ngn ?? 0) }]);
  const [payout, setPayout] = useState<number>(Number(request.buddy_payout_ngn ?? 0));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.amount_ngn || 0), 0), [items]);
  const defaultPct = Number(request.service_types?.default_buddy_payout_pct ?? 60);
  const suggested = Math.round(total * defaultPct / 100);
  const margin = total - (payout || 0);
  const quotable = request.status === "submitted" || request.status === "draft";

  function update(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
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
        {request.urgency === "urgent" && <StatusPill status="Pending" />}
      </div>
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
