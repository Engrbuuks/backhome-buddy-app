"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { bulkReengage } from "@/lib/admin/clients-actions";

type SC = { id: string; full_name: string | null; email: string | null; kind: string; label: string; signedUpAt: string; lastRequestAt: string | null };

const KIND_STYLE: Record<string, string> = {
  never_requested: "bg-blue-100 text-blue-700",
  quote_not_paid: "bg-amber-100 text-amber-700",
  lapsed: "bg-purple-100 text-purple-700",
};

export default function StalledList({ clients }: { clients: SC[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<{ sent: number; failed: number } | null>(null);

  const withEmail = clients.filter((c) => c.email);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = withEmail.length > 0 && withEmail.every((c) => sel.has(c.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(withEmail.map((c) => c.id)));

  const send = () => start(async () => {
    setSummary(null);
    const res = await bulkReengage(Array.from(sel));
    setSummary({ sent: res.sent, failed: res.failed });
    setSel(new Set());
  });

  if (clients.length === 0) {
    return <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No stalled clients right now — everyone who signed up has taken action. 🎉</div>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-bbb-border" />
          Select all with email ({withEmail.length})
        </label>
        <button onClick={send} disabled={pending || sel.size === 0} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-40">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? "Sending…" : `Draft & send to ${sel.size} selected`}
        </button>
      </div>

      {summary && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
          <CheckCircle2 className="h-4 w-4" /> Sent {summary.sent} email{summary.sent === 1 ? "" : "s"}{summary.failed > 0 ? ` · ${summary.failed} failed` : ""}.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-bbb-border bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bbb-border bg-bbb-bg text-left text-xs uppercase tracking-wide text-bbb-slate">
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Why stalled</th>
              <th className="px-4 py-3 font-bold">Joined</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-bbb-border last:border-0 hover:bg-bbb-bg/40">
                <td className="px-4 py-3">
                  <input type="checkbox" disabled={!c.email} checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded border-bbb-border disabled:opacity-30" />
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-bbb-charcoal">{c.full_name || "—"}</p>
                  <p className="text-xs text-bbb-slate">{c.email || "no email on file"}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${KIND_STYLE[c.kind] || "bg-bbb-bg text-bbb-charcoal"}`}>{c.label}</span>
                </td>
                <td className="px-4 py-3 text-bbb-slate">{new Date(c.signedUpAt).toLocaleDateString("en-GB")}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/clients/${c.id}`} className="text-xs font-bold text-bbb-strong hover:underline">Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-bbb-slate">Each selected client gets an individually AI-drafted email suited to their situation. For full control over wording, open a client and draft/edit their email individually.</p>
    </div>
  );
}
