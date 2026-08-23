"use client";
import React, { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ErrorState } from "@/components/StateBlocks";
import { respondToQuote } from "@/lib/requests/actions";
import { CURRENCY_META } from "@/lib/money/currency";

function Btn({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  const { pending } = useFormStatus();
  const cls = secondary
    ? "border border-bbb-border bg-white text-bbb-charcoal hover:border-bbb-strong"
    : "bg-bbb-strong text-white hover:bg-bbb-dark";
  return <button disabled={pending} className={`h-11 flex-1 rounded-xl text-sm font-bold disabled:opacity-50 ${cls}`}>{pending ? "…" : children}</button>;
}

export default function QuoteResponse({ request, currency = "USD", rates }: { request: any; currency?: string; rates?: any }) {
  const [state, formAction] = useFormState(respondToQuote, { error: "" });
  const [mode, setMode] = useState<"" | "changes" | "counter">("");

  if (request.status !== "quoted") return null;

  const sym = CURRENCY_META[currency as keyof typeof CURRENCY_META]?.symbol || "$";
  const MAX_ROUNDS = 3;
  const rounds = Number(request.negotiation_rounds || 0);
  const roundsLeft = MAX_ROUNDS - rounds;

  if (request.quote_decision === "accepted") {
    return (
      <div className="rounded-3xl border border-bbb-border bg-bbb-soft p-5 shadow-soft">
        <p className="font-display text-base font-extrabold text-bbb-dark">Quote accepted ✓</p>
        <p className="mt-1 text-sm text-bbb-slate">We&apos;ll send your payment instructions shortly. Work begins once payment is confirmed.</p>
      </div>
    );
  }
  if (request.quote_decision === "countered") {
    return (
      <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <p className="font-display text-base font-extrabold">Counter-offer sent 💬</p>
        <p className="mt-1 text-sm text-bbb-slate">
          You proposed a different price{request.quote_decision_note ? `: "${request.quote_decision_note}"` : ""}. The team is reviewing and will respond with an updated quote or accept your offer.
        </p>
        <p className="mt-2 text-xs text-bbb-slate">{roundsLeft > 0 ? `${roundsLeft} counter-offer${roundsLeft === 1 ? "" : "s"} remaining if needed.` : "This was your final counter-offer."}</p>
      </div>
    );
  }
  if (request.quote_decision === "changes_requested") {
    return (
      <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <p className="font-display text-base font-extrabold">Changes requested</p>
        <p className="mt-1 text-sm text-bbb-slate">You asked: &quot;{request.quote_decision_note}&quot;. The team is reviewing and will send an updated quote.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-bbb-strong/30 bg-white p-5 shadow-soft">
      <p className="font-display text-base font-extrabold">Your response to this quote</p>
      <p className="mt-1 text-xs text-bbb-slate">Quotes are free and nothing is charged until you accept and pay.</p>
      {state?.error && <div className="mt-3"><ErrorState title="Could not send" message={state.error} /></div>}

      {mode === "" && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <form action={formAction} className="flex flex-1">
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="decision" value="accepted" />
              <Btn>Accept quote</Btn>
            </form>
            <button onClick={() => setMode("counter")} className="h-11 flex-1 rounded-xl border border-bbb-border bg-white text-sm font-bold hover:border-bbb-strong disabled:opacity-50" disabled={roundsLeft <= 0}>
              Make a counter-offer
            </button>
          </div>
          <button onClick={() => setMode("changes")} className="h-11 w-full rounded-xl border border-bbb-border bg-white text-sm font-bold hover:border-bbb-strong">Request changes / ask a question</button>
          {roundsLeft <= 0 && <p className="text-xs text-amber-600">You&apos;ve used all your counter-offers. You can still accept or ask a question.</p>}
        </div>
      )}

      {mode === "counter" && (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="decision" value="countered" />
          <input type="hidden" name="offer_currency" value={currency} />
          <div>
            <label className="text-xs font-bold text-bbb-slate">Your proposed price ({currency})</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold text-bbb-slate">{sym}</span>
              <input name="offer_amount" type="number" step="0.01" min="0" required placeholder="Amount you'd like to pay" className="h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
            </div>
            <p className="mt-1 text-[11px] text-bbb-slate">Should be lower than the current quote. Our team can accept it or send a revised price.</p>
          </div>
          <textarea name="note" rows={2} placeholder="Optional: explain your offer (budget, scope, etc.)" className="w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong" />
          <div className="flex gap-3">
            <Btn>Send counter-offer</Btn>
            <button type="button" onClick={() => setMode("")} className="h-11 rounded-xl border border-bbb-border px-4 text-sm font-bold">Back</button>
          </div>
        </form>
      )}

      {mode === "changes" && (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="decision" value="changes_requested" />
          <textarea name="note" rows={3} required placeholder="What would you like adjusted? (scope, items, anything unclear)" className="w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong" />
          <div className="flex gap-3">
            <Btn>Send to the team</Btn>
            <button type="button" onClick={() => setMode("")} className="h-11 rounded-xl border border-bbb-border px-4 text-sm font-bold">Back</button>
          </div>
        </form>
      )}
    </div>
  );
}
