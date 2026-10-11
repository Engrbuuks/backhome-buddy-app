"use client";
import React, { useEffect, useState, useTransition } from "react";
import { acceptOffer, declineOffer } from "@/lib/offers/actions";
import { DECLINE_REASONS, type DeclineReason } from "@/lib/offers/eligibility";
import { formatNGN } from "@/components/money";

/**
 * The live offer a buddy is looking at.
 *
 * Two things earn their place here. The countdown, because an offer with a
 * silent deadline is a trap. And the decline reasons, because a buddy saying
 * "the pay is too low" is the single most useful piece of pricing data the
 * business can collect, and it only exists if declining is one tap rather than
 * a phone call.
 */
export default function OfferCard({ offer }: { offer: any }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [note, setNote] = useState("");
  const [left, setLeft] = useState<number>(() => msLeft(offer?.expires_at));

  function msLeft(ts?: string) {
    return ts ? Math.max(0, new Date(ts).getTime() - Date.now()) : 0;
  }

  useEffect(() => {
    const t = setInterval(() => setLeft(msLeft(offer?.expires_at)), 1000);
    return () => clearInterval(t);
  }, [offer?.expires_at]);

  if (!offer) return null;

  const req = Array.isArray(offer.requests) ? offer.requests[0] : offer.requests;
  const svc = req?.service_types
    ? (Array.isArray(req.service_types) ? req.service_types[0] : req.service_types)
    : null;

  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const expired = left <= 0;
  const urgent = left > 0 && left < 5 * 60_000;

  function run(fn: () => Promise<{ error: string }>) {
    setError("");
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border-2 border-bbb-strong bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-bbb-strong px-5 py-2.5">
        <p className="text-sm font-extrabold uppercase tracking-wide text-white">New task offered to you</p>
        <p
          aria-live="polite"
          className={`rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${
            expired ? "bg-white/20 text-white" : urgent ? "bg-white text-red-600" : "bg-white/20 text-white"
          }`}
        >
          {expired ? "Expired" : `${mins}:${String(secs).padStart(2, "0")} left`}
        </p>
      </div>

      <div className="p-5">
        <p className="font-display text-lg font-extrabold">{req?.title ?? "Task"}</p>
        <p className="mt-0.5 text-sm text-bbb-slate">
          {svc?.name ?? "Task"}
          {req?.recipient_address ? ` · ${req.recipient_address}` : ""}
          {req?.urgency ? ` · ${req.urgency}` : ""}
        </p>
        {req?.buddy_payout_ngn != null && (
          <p className="mt-3 text-sm">
            <span className="text-bbb-slate">Your payout </span>
            <span className="font-extrabold text-bbb-charcoal">{formatNGN(Number(req.buddy_payout_ngn))}</span>
          </p>
        )}

        {expired ? (
          <p className="mt-4 rounded-xl bg-bbb-bg p-3 text-sm text-bbb-slate">
            This offer has closed and moved on to the next buddy. Nothing to do.
          </p>
        ) : !showDecline ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => acceptOffer(offer.id))}
              className="h-11 rounded-xl bg-bbb-strong px-6 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
            >
              Accept this task
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowDecline(true)}
              className="h-11 rounded-xl border border-bbb-border px-5 text-sm font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-bbb-bg p-4">
            <p className="text-sm font-bold text-bbb-charcoal">Why are you turning this down?</p>
            <p className="mt-0.5 text-xs text-bbb-slate">
              This is not held against you. It tells us whether our rates or our coverage are wrong.
            </p>
            <div className="mt-3 space-y-2">
              {DECLINE_REASONS.map((r) => (
                <label key={r.key} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="radio"
                    name="decline_reason"
                    value={r.key}
                    checked={reason === r.key}
                    onChange={() => setReason(r.key)}
                    className="h-4 w-4 accent-[#079516]"
                  />
                  <span className={reason === r.key ? "font-semibold text-bbb-charcoal" : "text-bbb-slate"}>{r.label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Anything else we should know (optional)"
              className="mt-3 w-full rounded-xl border border-bbb-border bg-white p-3 text-sm outline-none focus:border-bbb-strong"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !reason}
                onClick={() => run(() => declineOffer(offer.id, reason as string, note))}
                className="h-11 rounded-xl bg-bbb-charcoal px-5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                Send decline
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => { setShowDecline(false); setReason(""); setNote(""); }}
                className="h-11 rounded-xl border border-bbb-border px-5 text-sm font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
