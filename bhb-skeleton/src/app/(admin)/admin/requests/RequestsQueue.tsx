"use client";
import React, { useMemo, useState, useTransition } from "react";
import { Filter, Search, Trash2, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { EmptyState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";
import { deleteRequestsBulk } from "@/lib/admin/proof-actions";

const STATUSES = ["All", "submitted", "quoted", "awaiting_pay", "paid", "assigned", "in_progress", "proof_ready", "completed", "cancelled", "disputed"];

export default function RequestsQueue({ initial }: { initial: any[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [selectMode, setSelectMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const active = new Set(["submitted", "quoted", "awaiting_pay", "paid", "assigned", "in_progress", "proof_ready"]);
    return initial
      .filter((r) => {
        const hay = [r.title, r.profiles?.full_name, r.profiles?.email, r.service_types?.name].join(" ").toLowerCase();
        const matchQ = hay.includes(query.toLowerCase());
        const matchS = status === "All" || r.status === status;
        return matchQ && matchS;
      })
      .sort((a, b) => {
        const ua = a.urgency === "urgent" && active.has(a.status) ? 1 : 0;
        const ub = b.urgency === "urgent" && active.has(b.status) ? 1 : 0;
        return ub - ua;
      });
  }, [initial, query, status]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = filtered.length > 0 && filtered.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allShownSelected ? new Set() : new Set(filtered.map((r) => r.id)));

  const doDelete = () => start(async () => {
    setMsg("");
    const res = await deleteRequestsBulk(Array.from(sel));
    setMsg(`Deleted ${res.deleted}${res.failed ? `, ${res.failed} failed` : ""}.`);
    setSel(new Set()); setConfirm(false); setSelectMode(false);
    router.refresh();
  });

  return (
    <AdminShell title="Requests Queue">
      <PageHeader eyebrow="Requests" title="All client requests" description="Inspect requests, quote, assign — or clear out test tasks." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search request, client, service..." className="h-11 w-full rounded-xl border border-bbb-border bg-white pl-10 pr-3 text-sm outline-none focus:border-bbb-strong" />
          </label>
          <label className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-full rounded-xl border border-bbb-border bg-white pl-10 pr-3 text-sm outline-none focus:border-bbb-strong">
              {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : statusLabel(s)}</option>)}
            </select>
          </label>
        </div>
        <button
          onClick={() => { setSelectMode((v) => !v); setSel(new Set()); setConfirm(false); }}
          className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${selectMode ? "border-bbb-strong bg-bbb-soft text-bbb-dark" : "border-bbb-border text-bbb-slate hover:border-bbb-strong"}`}>
          {selectMode ? <><X className="h-4 w-4" /> Done</> : <><Trash2 className="h-4 w-4" /> Select to delete</>}
        </button>
      </div>

      {selectMode && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="h-4 w-4" />
            Select all shown ({filtered.length}) · {sel.size} selected
          </label>
          {!confirm ? (
            <button disabled={sel.size === 0} onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">
              <Trash2 className="h-4 w-4" /> Delete {sel.size} selected
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-red-800">Permanently delete {sel.size}? This can&apos;t be undone.</span>
              <button disabled={pending} onClick={doDelete} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Yes, delete
              </button>
              <button onClick={() => setConfirm(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-bbb-slate">Cancel</button>
            </div>
          )}
        </div>
      )}
      {msg && <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{msg}</div>}

      {filtered.length === 0 ? (
        <EmptyState title="No requests" description="Nothing matches your filters yet." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const inner = (
              <>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-xs text-bbb-slate">{r.service_types?.name ?? "Custom"}</p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate">{r.profiles?.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-bbb-slate">{r.profiles?.email}</p>
                </div>
                <span className="text-sm font-bold">{r.client_price_ngn != null ? formatNGN(r.client_price_ngn) : "—"}</span>
                <span className="text-xs text-bbb-slate">{formatDate(r.created_at)}</span>
                <StatusPill status={r.status} />
                {r.urgency === "urgent" && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">Urgent</span>}
              </>
            );
            if (selectMode) {
              return (
                <label key={r.id} className={`grid cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 shadow-soft md:grid-cols-[auto_1.4fr_1fr_0.8fr_0.7fr_auto] ${sel.has(r.id) ? "border-red-300 ring-2 ring-red-200" : "border-bbb-border"}`}>
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4" />
                  {inner}
                </label>
              );
            }
            return (
              <Link key={r.id} href={`/admin/requests/${r.id}`} className="grid items-center gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_auto]">
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
