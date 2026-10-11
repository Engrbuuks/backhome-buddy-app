"use client";
import React from "react";

/**
 * Did the message actually leave?
 *
 * The question that cost a day earlier in this project was "the client says he
 * never got the email" with no way to tell whether it was ever sent. This is
 * that answer, in one glance.
 *
 * `accepted` means the provider took it, not that it reached the handset. A
 * run of accepted sends nobody received points at DNS or spam filtering. A run
 * of rejected ones points at configuration.
 */
export default function DeliveryLog({ data }: { data: { ready: boolean; rows: any[] } }) {
  if (!data?.ready) {
    return (
      <section className="mt-6 rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="font-display text-base font-extrabold text-amber-900">Delivery log not installed yet</h2>
        <p className="mt-1 text-sm text-amber-800">
          Run <strong>supabase/migrations/0040_push_and_offer_mode.sql</strong> in Supabase to start recording
          whether each alert actually left the system.
        </p>
      </section>
    );
  }

  const rows = data.rows;
  const failed = rows.filter((r) => !r.accepted).length;

  return (
    <section className="mt-6 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-extrabold">Did alerts actually go out?</h2>
        {rows.length > 0 && (
          <span className={`text-xs font-bold ${failed ? "text-amber-700" : "text-green-700"}`}>
            {failed ? `${failed} of the last ${rows.length} did not send` : `last ${rows.length} all sent`}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-bbb-slate">
        Sent means the provider accepted it. If something was sent but never arrived, the problem is
        downstream — email authentication on your domain, or spam filtering — not this app.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl bg-bbb-bg p-3 text-sm text-bbb-slate">
          Nothing recorded yet. Entries appear as alerts go out.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-bbb-bg p-2.5 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                r.accepted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {r.accepted ? "sent" : "not sent"}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-bbb-slate">{r.channel}</span>
              <span className="font-semibold text-bbb-charcoal">{r.type_key ?? "—"}</span>
              <span className="text-xs text-bbb-slate">{new Date(r.created_at).toLocaleString()}</span>
              {r.reason && <span className="w-full text-xs text-bbb-slate">{r.reason}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
