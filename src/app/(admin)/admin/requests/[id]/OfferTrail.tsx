"use client";
import React, { useEffect, useState, useTransition } from "react";
import { listOffersForRequest, startOffering } from "@/lib/offers/actions";

/**
 * Who this task was offered to, in what order, and what they said.
 *
 * This is the answer to "why has nobody picked this up?", and it is also where
 * the pricing signal surfaces: a column of "Payout is too low" against one area
 * is the rate card telling you it is wrong.
 */
export default function OfferTrail({ requestId, status }: { requestId: string; status: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function load() {
    try { setRows(await listOffersForRequest(requestId)); }
    catch { /* a missing trail is not worth an error banner */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [requestId]);

  const live = rows.find((r) => r.status === "pending");
  const canOffer = status === "paid" && !live;

  if (loading) return null;
  if (rows.length === 0 && !canOffer) return null;

  const badge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-bbb-strong text-white",
      accepted: "bg-green-100 text-green-700",
      declined: "bg-amber-100 text-amber-700",
      expired: "bg-gray-100 text-gray-600",
      superseded: "bg-gray-100 text-gray-500",
    };
    return map[s] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="mt-4 rounded-2xl bg-bbb-bg p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Offer trail</p>
        {canOffer && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await startOffering(requestId);
              setError(r.error);
              await load();
            })}
            className="rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
          >
            {rows.length ? "Offer to next buddy" : "Start offering"}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-bbb-slate">
          Nobody has been offered this task yet. Offering starts automatically when payment is recorded; use the button to raise one by hand.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <div key={o.id} className="rounded-xl bg-white p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${badge(o.status)}`}>{o.status}</span>
                <span className="font-semibold text-bbb-charcoal">{o.buddy_name}</span>
                <span className="text-xs text-bbb-slate">
                  round {o.round}
                  {o.score != null ? ` · score ${o.score}` : ""}
                  {" · "}{new Date(o.offered_at).toLocaleString()}
                </span>
              </div>
              {o.decline_label && (
                <p className="mt-1 text-xs text-amber-700">
                  <strong>{o.decline_label}</strong>
                  {o.decline_note ? ` — ${o.decline_note}` : ""}
                </p>
              )}
              {o.status === "pending" && (
                <p className="mt-1 text-xs text-bbb-slate">Window closes {new Date(o.expires_at).toLocaleTimeString()}.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
