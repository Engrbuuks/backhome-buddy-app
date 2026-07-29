"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { formatNGN, formatDate } from "@/components/money";
import { deleteClientsBulk } from "@/lib/admin/proof-actions";

type Row = { id: string; full_name: string | null; email: string | null; phone?: string | null; created_at: string; requestCount: number; totalSpendNgn: number; lastRequestAt: string | null };

export default function ClientsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const doDelete = () => start(async () => {
    setMsg("");
    const res = await deleteClientsBulk(Array.from(sel));
    setMsg(`Deleted ${res.deleted}${res.failed ? `, ${res.failed} failed` : ""}.`);
    setSel(new Set()); setConfirm(false); setSelectMode(false);
    router.refresh();
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => { setSelectMode((v) => !v); setSel(new Set()); setConfirm(false); }}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${selectMode ? "border-bbb-strong bg-bbb-soft text-bbb-dark" : "border-bbb-border text-bbb-slate hover:border-bbb-strong"}`}>
          {selectMode ? <><X className="h-4 w-4" /> Done</> : <><Trash2 className="h-4 w-4" /> Select to delete</>}
        </button>
        {selectMode && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-bbb-slate">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
              Select all on page · {sel.size} selected
            </label>
            {!confirm ? (
              <button disabled={sel.size === 0} onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">
                <Trash2 className="h-4 w-4" /> Delete {sel.size}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-800">Permanently delete {sel.size} client{sel.size === 1 ? "" : "s"} and all their requests?</span>
                <button disabled={pending} onClick={doDelete} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Yes, delete
                </button>
                <button onClick={() => setConfirm(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-bbb-slate">Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>
      {msg && <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{msg}</div>}

      <div className="overflow-hidden rounded-2xl border border-bbb-border bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bbb-border bg-bbb-bg text-left text-xs uppercase tracking-wide text-bbb-slate">
              {selectMode && <th className="px-4 py-3"></th>}
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Joined</th>
              <th className="px-4 py-3 text-center font-bold">Requests</th>
              <th className="px-4 py-3 text-right font-bold">Spend</th>
              <th className="px-4 py-3 font-bold">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={`border-b border-bbb-border last:border-0 ${sel.has(c.id) ? "bg-red-50" : "hover:bg-bbb-bg/50"}`}>
                {selectMode && (
                  <td className="px-4 py-3"><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" /></td>
                )}
                <td className="px-4 py-3">
                  {selectMode ? (
                    <div><p className="font-semibold text-bbb-charcoal">{c.full_name || "—"}</p><p className="text-xs text-bbb-slate">{c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}</p></div>
                  ) : (
                    <Link href={`/admin/clients/${c.id}`} className="block"><p className="font-semibold text-bbb-strong hover:underline">{c.full_name || "—"}</p><p className="text-xs text-bbb-slate">{c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}</p></Link>
                  )}
                </td>
                <td className="px-4 py-3 text-bbb-slate">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3 text-center font-bold">{c.requestCount}</td>
                <td className="px-4 py-3 text-right font-bold">{c.totalSpendNgn > 0 ? formatNGN(c.totalSpendNgn) : "—"}</td>
                <td className="px-4 py-3 text-bbb-slate">{c.lastRequestAt ? formatDate(c.lastRequestAt) : "No requests"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
