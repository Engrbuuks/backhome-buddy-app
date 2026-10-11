"use client";
import React, { useState, useTransition } from "react";
import { setOfferMode } from "@/lib/admin/config-actions";
import { declineLabel } from "@/lib/offers/eligibility";

/**
 * The operational home of the offer layer.
 *
 * Three things an admin actually needs here: which mode the system is in, what
 * offers are live right now, and what buddies are saying when they decline.
 * That last one is the pricing signal and it has nowhere else to surface.
 */

const MODES = [
  {
    key: "off" as const,
    label: "Off",
    blurb: "No offers are raised. You assign every task by hand, exactly as before.",
  },
  {
    key: "advisory" as const,
    label: "Advisory",
    blurb: "The system picks the best buddy and notifies them, then stops. Nothing expires, nothing cascades, you still press Assign. Safe default.",
  },
  {
    key: "automatic" as const,
    label: "Automatic",
    blurb: "Paid tasks are offered with a time window and cascade down the shortlist on decline or timeout. Only switch to this once you can see that alerts are reaching buddies.",
  },
];

export default function OfferControls({ data }: { data: any }) {
  const [mode, setMode] = useState<string>(data?.mode ?? "advisory");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!data?.ready) {
    return (
      <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-extrabold text-amber-900">Offer layer not installed yet</p>
        <p className="mt-1 text-sm text-amber-800">
          Run <strong>supabase/migrations/0039_task_offers.sql</strong> in Supabase (after 0038) to turn
          this on. Assignment below works normally in the meantime.
        </p>
      </div>
    );
  }

  function choose(next: string) {
    setError(""); setSaved(false);
    const previous = mode;
    setMode(next);                           // optimistic
    start(async () => {
      try { await setOfferMode(next as any); setSaved(true); }
      catch (e) { setMode(previous); setError(e instanceof Error ? e.message : "Could not change the mode."); }
    });
  }

  const fmt = (ts?: string) => (ts ? new Date(ts).toLocaleString() : "—");

  return (
    <div className="mb-6 space-y-4">
      {/* ── Mode ─────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <h2 className="font-display text-base font-extrabold">How tasks reach buddies</h2>
        <p className="mt-1 text-sm text-bbb-slate">
          Applies the moment a payment is recorded. Manual assignment always works and overrides whatever is live.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={pending}
              onClick={() => choose(m.key)}
              className={`rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                mode === m.key ? "border-bbb-strong bg-bbb-bg" : "border-bbb-border bg-white hover:border-bbb-strong"
              }`}
            >
              <span className={`block text-sm font-extrabold ${mode === m.key ? "text-bbb-strong" : "text-bbb-charcoal"}`}>
                {m.label}{mode === m.key ? " · current" : ""}
              </span>
              <span className="mt-1 block text-xs leading-5 text-bbb-slate">{m.blurb}</span>
            </button>
          ))}
        </div>
        {saved && <p className="mt-2 text-xs font-semibold text-green-700">Saved.</p>}
        {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      </section>

      {/* ── Live offers ──────────────────────────────────────── */}
      <section className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <h2 className="font-display text-base font-extrabold">
          Offers out now {data.live.length > 0 && <span className="text-bbb-strong">({data.live.length})</span>}
        </h2>
        {data.live.length === 0 ? (
          <p className="mt-1 text-sm text-bbb-slate">Nothing is awaiting a buddy's answer.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.live.map((o: any) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bbb-bg p-3 text-sm">
                <div className="min-w-0">
                  <a href={`/admin/requests/${o.request_id}`} className="font-semibold text-bbb-charcoal hover:underline">{o.title}</a>
                  <span className="ml-2 text-xs text-bbb-slate">offered to {o.buddy_name} · round {o.round}</span>
                </div>
                <span className="text-xs font-semibold text-bbb-slate">closes {fmt(o.expires_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Why buddies decline: the pricing signal ──────────── */}
      {data.declineCounts.length > 0 && (
        <section className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <h2 className="font-display text-base font-extrabold">Why buddies are declining</h2>
          <p className="mt-1 text-sm text-bbb-slate">
            Repeated declines on payout mean the rate card is wrong somewhere. Nothing else tells you this.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.declineCounts.map((d: any) => (
              <span key={d.key} className="rounded-full bg-bbb-bg px-3 py-1.5 text-xs font-bold text-bbb-charcoal">
                {d.label} <span className="text-bbb-strong">{d.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent history ───────────────────────────────────── */}
      {data.recent.length > 0 && (
        <section className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <h2 className="font-display text-base font-extrabold">Recent offers</h2>
          <div className="mt-3 space-y-1.5">
            {data.recent.slice(0, 20).map((o: any) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-bbb-bg p-2.5 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  o.status === "accepted" ? "bg-green-100 text-green-700"
                  : o.status === "declined" ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
                }`}>{o.status}</span>
                <a href={`/admin/requests/${o.request_id}`} className="font-semibold text-bbb-charcoal hover:underline">{o.title}</a>
                <span className="text-xs text-bbb-slate">{o.buddy_name} · {fmt(o.responded_at || o.offered_at)}</span>
                {o.decline_label && <span className="text-xs font-semibold text-amber-700">{o.decline_label}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
