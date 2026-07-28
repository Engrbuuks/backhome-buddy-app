"use client";
import React, { useState, useTransition } from "react";
import { Loader2, Tag } from "lucide-react";
import { reclassifyQuoteItem } from "@/lib/admin/quote-actions";
import { formatNGN } from "@/components/money";

type QItem = { id: string; label: string; amount_ngn: number; item_type?: string };

/** Correct the service/purchase split on a task that's already been quoted or
 *  paid — fixes the revenue figure without touching the client price or status. */
export default function ReclassifyItems({ items }: { items: QItem[] }) {
  const [rows, setRows] = useState<QItem[]>(items || []);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  if (!rows.length) return null;

  const service = rows.filter((r) => (r.item_type || "service") !== "purchase").reduce((s, r) => s + Number(r.amount_ngn || 0), 0);
  const purchases = rows.filter((r) => (r.item_type || "service") === "purchase").reduce((s, r) => s + Number(r.amount_ngn || 0), 0);

  const setType = (id: string, type: "service" | "purchase") => start(async () => {
    setBusy(id); setMsg("");
    const res = await reclassifyQuoteItem(id, type);
    setBusy(null);
    if (res.error) { setMsg(res.error); return; }
    setRows((r) => r.map((it) => it.id === id ? { ...it, item_type: type } : it));
    setMsg("Revenue updated.");
  });

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Tag className="h-4 w-4 text-bbb-strong" />
        <p className="font-display text-base font-extrabold">Revenue classification</p>
      </div>
      <p className="mb-3 text-xs text-bbb-slate">Mark any line you bought <strong>on the client&apos;s behalf</strong> as a purchase — it&apos;s removed from revenue. This corrects the accounting without changing what the client paid.</p>

      <div className="space-y-2">
        {rows.map((it) => {
          const isPurchase = (it.item_type || "service") === "purchase";
          return (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-bbb-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-bbb-charcoal">{it.label}</p>
                <p className="text-xs text-bbb-slate">{formatNGN(Number(it.amount_ngn || 0))}</p>
              </div>
              <div className="flex items-center gap-2">
                {busy === it.id && <Loader2 className="h-4 w-4 animate-spin text-bbb-slate" />}
                <div className="flex overflow-hidden rounded-lg border border-bbb-border text-xs font-bold">
                  <button disabled={pending} onClick={() => setType(it.id, "service")} className={`px-3 py-1.5 ${!isPurchase ? "bg-bbb-strong text-white" : "bg-white text-bbb-slate"}`}>Service</button>
                  <button disabled={pending} onClick={() => setType(it.id, "purchase")} className={`px-3 py-1.5 ${isPurchase ? "bg-amber-500 text-white" : "bg-white text-bbb-slate"}`}>Purchase</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-bbb-border pt-3 text-sm">
        <div><span className="text-bbb-slate">Revenue (service): </span><span className="font-bold text-bbb-dark">{formatNGN(service)}</span></div>
        <div className="text-right"><span className="text-bbb-slate">Purchases: </span><span className="font-bold text-bbb-slate">{formatNGN(purchases)}</span></div>
      </div>
      {msg && <p className="mt-2 text-xs font-semibold text-green-700">{msg}</p>}
    </div>
  );
}
