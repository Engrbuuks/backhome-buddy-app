"use client";
/**
 * The client's way of asking for their money back.
 *
 * The important thing this component does is show the arithmetic BEFORE the
 * client commits, in their own currency, with the reason for any non
 * refundable amount written out in a sentence. A client who is told up front
 * that ten percent is retained because a buddy has already been assigned
 * argues with the policy. A client who finds out afterwards argues with you.
 *
 * Every figure here comes from the server. Nothing is computed in the browser,
 * so what is displayed is exactly what the server will act on.
 */
import React, { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { requestRefund, withdrawRefundRequest } from "@/lib/money/refund-actions";
import type { RefundQuote } from "@/lib/money/refund-policy";
import { formatClientMoneyIn, formatDate } from "@/components/money";
import { ErrorState } from "@/components/StateBlocks";

export default function RefundPanel({
  requestId, quote, currency, rates,
}: {
  requestId: string;
  quote: RefundQuote | null;
  currency: any;
  rates: any;
}) {
  const [open, setOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [state, action] = useFormState(requestRefund, { error: "" } as any);
  const [withdrawing, startWithdraw] = useTransition();
  const [withdrawError, setWithdrawError] = useState("");

  if (!quote || !quote.enabled) return null;

  const money = (ngn: number) => formatClientMoneyIn(Number(ngn || 0), currency, rates);

  /* ---------- a decision has come back ---------- */
  if (quote.lastDecision && !quote.openRequest && !quote.available) {
    const d = quote.lastDecision;
    const approved = d.status === "approved";
    return (
      <div className={`rounded-3xl border p-5 shadow-soft ${approved ? "border-green-200 bg-green-50" : "border-bbb-border bg-white"}`}>
        <h2 className="font-display text-lg font-extrabold">
          {approved ? "Refund approved" : "Refund request declined"}
        </h2>
        {approved && d.refunded_ngn != null && (
          <p className="mt-2 text-sm text-bbb-charcoal">
            <strong>{money(d.refunded_ngn)}</strong> is being returned to you.
            {Number(d.retained_ngn || 0) > 0 && <> {money(d.retained_ngn!)} was non refundable at the stage the task had reached.</>}
          </p>
        )}
        {d.decision_note && <p className="mt-2 text-sm text-bbb-slate">{d.decision_note}</p>}
        {d.decided_at && <p className="mt-2 text-xs text-bbb-slate">{formatDate(d.decided_at)}</p>}
      </div>
    );
  }

  /* ---------- a request is already in ---------- */
  if (quote.openRequest) {
    return (
      <div className="rounded-3xl border-2 border-amber-200 bg-amber-50 p-5 shadow-soft">
        <h2 className="font-display text-lg font-extrabold text-amber-900">Refund request received</h2>
        <p className="mt-2 text-sm text-amber-800">
          We are reviewing it. You will get an email as soon as there is a decision, usually within one working day.
        </p>
        <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-bbb-charcoal">
          &ldquo;{quote.openRequest.reason}&rdquo;
          <span className="mt-1 block text-xs text-bbb-slate">Sent {formatDate(quote.openRequest.created_at)}</span>
        </p>
        {withdrawError && <div className="mt-3"><ErrorState title="Could not withdraw" message={withdrawError} /></div>}
        <button
          disabled={withdrawing}
          onClick={() => {
            if (!window.confirm("Withdraw this refund request and carry on with the task?")) return;
            startWithdraw(async () => {
              setWithdrawError("");
              const r = await withdrawRefundRequest(quote.openRequest!.id);
              if (r?.error) setWithdrawError(r.error);
            });
          }}
          className="mt-3 h-10 rounded-xl border border-amber-300 px-4 text-sm font-bold text-amber-800 hover:bg-white disabled:opacity-50"
        >
          Withdraw the request
        </button>
      </div>
    );
  }

  /* ---------- cannot ask right now ---------- */
  if (!quote.available) {
    if (!quote.reason) return null;
    return (
      <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-extrabold">Refunds</h2>
        <p className="mt-2 text-sm text-bbb-slate">{quote.reason}</p>
      </div>
    );
  }

  /* ---------- the form ---------- */
  const nothingBack = quote.refundable_ngn <= 0;

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <h2 className="font-display text-lg font-extrabold">Request a refund</h2>
      <p className="mt-1 text-sm text-bbb-slate">
        Changed your mind, or something gone wrong? Ask here and a person will look at it.
      </p>

      {/* The arithmetic, up front, before any commitment. */}
      <dl className="mt-4 space-y-1.5 rounded-2xl bg-bbb-bg p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-bbb-slate">You paid</dt>
          <dd className="font-semibold">{money(quote.paid_ngn)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-bbb-slate">Refundable at this stage</dt>
          <dd className={`font-display font-extrabold ${nothingBack ? "text-bbb-slate" : "text-green-700"}`}>
            {money(quote.refundable_ngn)}
          </dd>
        </div>
        {quote.retained_ngn > 0 && (
          <div className="flex justify-between">
            <dt className="text-bbb-slate">Non refundable</dt>
            <dd className="font-semibold text-amber-700">{money(quote.retained_ngn)}</dd>
          </div>
        )}
      </dl>

      {quote.basis && <p className="mt-2 text-xs leading-5 text-bbb-slate">{quote.basis}</p>}

      {quote.retained_ngn > 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          If the task failed because of us or the buddy, you get <strong>everything</strong> back. Say so below and we
          will waive the non refundable amount.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowRules((v) => !v)}
        className="mt-3 text-xs font-bold text-bbb-strong underline underline-offset-2"
      >
        {showRules ? "Hide the refund rules" : "Read the refund rules"}
      </button>
      {showRules && (
        <ul className="mt-2 space-y-1.5 rounded-2xl border border-bbb-border p-3 text-xs leading-5 text-bbb-slate">
          {quote.rules.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      )}

      {state?.error && <div className="mt-3"><ErrorState title="Could not send the request" message={state.error} /></div>}
      {(state as any)?.saved && (
        <div className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-800">
          {(state as any).autoApproved
            ? "Approved. No buddy had been assigned, so the full amount is coming back to you. We will email you once the transfer is out."
            : "Refund request sent. We will come back to you, usually within one working day."}
        </div>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 h-11 w-full rounded-xl border border-bbb-border text-sm font-bold text-bbb-slate hover:border-red-300 hover:text-red-600"
        >
          Request a refund
        </button>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          <input type="hidden" name="request_id" value={requestId} />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Why?</span>
            <select
              name="reason_code"
              required
              defaultValue=""
              className="mt-1 h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong"
            >
              <option value="" disabled>Pick the closest reason</option>
              {quote.reasons.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <textarea
            name="reason"
            required
            minLength={5}
            placeholder="Tell us a little more. The detail is what lets us waive the non refundable amount where the fault is ours."
            className="min-h-[100px] w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong"
          />
          <div className="flex gap-2">
            <button className="h-11 flex-1 rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">
              Send refund request
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-xl border border-bbb-border px-4 text-sm font-bold text-bbb-slate">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
