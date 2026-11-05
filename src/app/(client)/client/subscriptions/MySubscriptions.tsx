"use client";
/**
 * What the client sees of their retainer: what it costs, when the next visit
 * lands, and a way out.
 *
 * The way out is deliberate. A subscription somebody cannot cancel without
 * emailing a person is the kind that gets charged back, and the trust this
 * business sells is worth more than one retained month.
 */
import React, { useState, useTransition } from "react";
import { ErrorState } from "@/components/StateBlocks";
import { formatClientMoneyIn, formatDate } from "@/components/money";
import { setMySubscriptionStatus } from "@/lib/subscriptions/actions";

export default function MySubscriptions({
  rows = [], currency, rates, migrationMissing = false,
}: {
  rows?: any[]; currency?: any; rates?: any; migrationMissing?: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const money = (ngn: number) => formatClientMoneyIn(Number(ngn || 0), currency, rates);

  const change = (id: string, status: "active" | "paused" | "cancelled") => start(async () => {
    setError("");
    const r = await setMySubscriptionStatus(id, status);
    if (r?.error) setError(r.error);
  });

  if (migrationMissing) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-strong">Ongoing</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold">Your monthly arrangements</h1>
        <p className="mt-1 text-sm text-bbb-slate">
          A price agreed once and a visit every month, so there is nothing to ask for and no quote to wait for.
        </p>
      </div>

      {error && <div className="mb-4"><ErrorState title="Could not update" message={error} /></div>}

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-bbb-border bg-white p-8 text-center">
          <p className="font-display text-base font-extrabold">Nothing monthly yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-bbb-slate">
            If you find yourself asking for the same thing every month — someone to look in on your parents, bills
            paid on time, eyes on a property — we can set it up as a standing arrangement at one agreed price. Ask us
            on your next task and we will put it in place.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold">{r.title}</p>
                  <p className="mt-0.5 text-xs text-bbb-slate">
                    {r.service_types?.name ? `${r.service_types.name} · ` : ""}
                    {r.regions?.name ? `${r.regions.name} · ` : ""}
                    every month on day {r.day_of_month}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-extrabold">{money(r.monthly_price_ngn)}</p>
                  <p className="text-[11px] text-bbb-slate">per month</p>
                </div>
              </div>

              {r.description && <p className="mt-3 rounded-xl bg-bbb-bg p-3 text-sm leading-6">{r.description}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                  r.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                }`}>
                  {r.status}
                </span>
                {r.status === "active" && (
                  <span className="text-xs text-bbb-slate">Next visit {formatDate(r.next_run_on)}</span>
                )}
                {r.runs_count > 0 && (
                  <span className="text-xs text-bbb-slate">{r.runs_count} done so far</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === "active" ? (
                  <button
                    disabled={pending}
                    onClick={() => change(r.id, "paused")}
                    className="h-10 rounded-xl border border-bbb-border px-4 text-sm font-bold text-bbb-slate hover:bg-bbb-bg disabled:opacity-50"
                  >
                    Pause for now
                  </button>
                ) : (
                  <button
                    disabled={pending}
                    onClick={() => change(r.id, "active")}
                    className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
                  >
                    Start again
                  </button>
                )}
                <button
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Cancel this arrangement? No further visits will be scheduled.")) change(r.id, "cancelled");
                  }}
                  className="h-10 rounded-xl border border-bbb-border px-4 text-sm font-bold text-bbb-slate hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-5 text-bbb-slate">
                Pausing stops the next visit and keeps the arrangement. Nothing is charged for a month you paused, and
                starting again picks up from the next date rather than billing for the gap.
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
