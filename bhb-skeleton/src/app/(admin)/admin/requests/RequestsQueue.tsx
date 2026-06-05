"use client";
import React, { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import Link from "next/link";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { EmptyState } from "@/components/StateBlocks";
import { formatNGN, formatDate } from "@/components/money";

const STATUSES = ["All", "submitted", "quoted", "awaiting_pay", "paid", "assigned", "in_progress", "proof_ready", "completed", "cancelled", "disputed"];

export default function RequestsQueue({ initial }: { initial: any[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = useMemo(() => {
    return initial.filter((r) => {
      const hay = [r.title, r.profiles?.full_name, r.profiles?.email, r.service_types?.name].join(" ").toLowerCase();
      const matchQ = hay.includes(query.toLowerCase());
      const matchS = status === "All" || r.status === status;
      return matchQ && matchS;
    });
  }, [initial, query, status]);

  return (
    <AdminShell title="Requests Queue">
      <PageHeader eyebrow="Requests" title="All client requests" description="Inspect incoming requests. Quoting comes next in the build." />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search request, client, service..." className="h-11 w-full rounded-xl border border-bbb-border bg-white pl-10 pr-3 text-sm outline-none focus:border-bbb-strong focus:ring-4 focus:ring-bbb-primary/10" />
        </label>
        <label className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-full rounded-xl border border-bbb-border bg-white pl-10 pr-3 text-sm outline-none focus:border-bbb-strong focus:ring-4 focus:ring-bbb-primary/10">
            {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : statusLabel(s)}</option>)}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No requests" description="Nothing matches your filters yet." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} className="grid items-center gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_auto]">
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
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
