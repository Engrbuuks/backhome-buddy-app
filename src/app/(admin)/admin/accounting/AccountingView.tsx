"use client";
import React, { useState, useTransition } from "react";
import { Loader2, TrendingUp, Wallet, ShoppingBag, Coins } from "lucide-react";
import { getAccounting, type AccountingSummary } from "@/lib/admin/accounting-actions";
import { formatNGN } from "@/components/money";

type Preset = "today" | "week" | "month" | "year" | "all" | "custom";

function rangeFor(preset: Preset): { start?: string; end?: string } {
  const now = new Date();
  const end = now.toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today": return { start: startOfDay.toISOString(), end };
    case "week": { const d = new Date(startOfDay); d.setDate(d.getDate() - 6); return { start: d.toISOString(), end }; }
    case "month": return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end };
    case "year": return { start: new Date(now.getFullYear(), 0, 1).toISOString(), end };
    case "all": return {};
    default: return {};
  }
}

export default function AccountingView({ initial, initialStart, initialEnd }: { initial: AccountingSummary; initialStart: string; initialEnd: string }) {
  const [data, setData] = useState<AccountingSummary>(initial);
  const [preset, setPreset] = useState<Preset>("month");
  const [customStart, setCustomStart] = useState(initialStart.slice(0, 10));
  const [customEnd, setCustomEnd] = useState(initialEnd.slice(0, 10));
  const [pending, start] = useTransition();

  const load = (s?: string, e?: string) => start(async () => { setData(await getAccounting(s, e)); });
  const applyPreset = (p: Preset) => { setPreset(p); if (p !== "custom") { const r = rangeFor(p); load(r.start, r.end); } };
  const applyCustom = () => {
    setPreset("custom");
    const s = customStart ? new Date(customStart).toISOString() : undefined;
    const e = customEnd ? new Date(customEnd + "T23:59:59").toISOString() : undefined;
    load(s, e);
  };

  const presets: Array<[Preset, string]> = [["today", "Today"], ["week", "Last 7 days"], ["month", "This month"], ["year", "This year"], ["all", "All time"]];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {presets.map(([p, label]) => (
            <button key={p} onClick={() => applyPreset(p)} className={`rounded-xl px-4 py-2 text-sm font-bold ${preset === p ? "bg-bbb-strong text-white" : "border border-bbb-border text-bbb-slate hover:border-bbb-strong"}`}>{label}</button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-bbb-border pt-4">
          <div>
            <label className="block text-xs font-bold text-bbb-slate">From</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-1 h-11 rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          </div>
          <div>
            <label className="block text-xs font-bold text-bbb-slate">To</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-1 h-11 rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
          </div>
          <button onClick={applyCustom} className="h-11 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark">Apply range</button>
          {pending && <Loader2 className="h-5 w-5 animate-spin text-bbb-slate" />}
        </div>
      </div>

      {/* Headline: revenue and net profit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card icon={<TrendingUp className="h-5 w-5" />} label="Revenue (service fees earned)" value={data.revenue} accent />
        <Card icon={<Wallet className="h-5 w-5" />} label="Net profit (revenue − payouts)" value={data.net} accent />
      </div>

      {/* Breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<Coins className="h-5 w-5" />} label="Paid out to buddies" value={data.payouts} />
        <Card icon={<Coins className="h-5 w-5" />} label="Payouts still due" value={data.payoutsDue} muted />
        <Card icon={<ShoppingBag className="h-5 w-5" />} label="Purchases (passthrough)" value={data.purchases} muted />
        <Card icon={<Wallet className="h-5 w-5" />} label="Total collected from clients" value={data.grossCollected} muted />
      </div>

      <p className="text-xs text-bbb-slate">
        {data.count} earning task{data.count === 1 ? "" : "s"} in this period. <strong>Revenue</strong> counts only your service fees — money you bought on a client&apos;s behalf (purchases) is excluded. <strong>Net profit</strong> subtracts what you&apos;ve actually paid out to buddies.
      </p>
    </div>
  );
}

function Card({ icon, label, value, accent, muted }: { icon: React.ReactNode; label: string; value: number; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 shadow-soft ${accent ? "border-bbb-strong bg-bbb-soft" : "border-bbb-border bg-white"}`}>
      <div className={`flex items-center gap-2 ${muted ? "text-bbb-slate" : "text-bbb-dark"}`}>{icon}<span className="text-xs font-bold">{label}</span></div>
      <p className={`mt-2 font-display text-2xl font-extrabold ${muted ? "text-bbb-slate" : "text-bbb-charcoal"}`}>{formatNGN(value)}</p>
    </div>
  );
}
