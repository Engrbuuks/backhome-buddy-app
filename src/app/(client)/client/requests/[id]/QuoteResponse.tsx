"use client";
import React, { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ErrorState } from "@/components/StateBlocks";
import { respondToQuote } from "@/lib/requests/actions";

function Btn({ children, secondary = false, danger = false }: { children: React.ReactNode; secondary?: boolean; danger?: boolean }) {
  const { pending } = useFormStatus();
  const cls = secondary
    ? "border border-bbb-border bg-white text-bbb-charcoal hover:border-bbb-strong"
    : danger
    ? "border border-bbb-border bg-white hover:border-red-300 hover:text-red-600"
    : "bg-bbb-strong text-white hover:bg-bbb-dark";
  return <button disabled={pending} className={`h-11 flex-1 rounded-xl text-sm font-bold disabled:opacity-50 ${cls}`}>{pending ? "…" : children}</button>;
}

export default function QuoteResponse({ request }: { request: any }) {
  const [state, formAction] = useFormState(respondToQuote, { error: "" });
  const [mode, setMode] = useState<"" | "changes">("");

  if (request.status !== "quoted") return null;

  if (request.quote_decision === "accepted") {
    return (
      <div className="rounded-3xl border border-bbb-border bg-bbb-soft p-5 shadow-soft">
        <p className="font-display text-base font-extrabold text-bbb-dark">Quote accepted ✓</p>
        <p className="mt-1 text-sm text-bbb-slate">We&apos;ll send your payment instructions shortly. Work begins once payment is confirmed.</p>
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

      {mode === "" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={formAction} className="flex flex-1">
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="decision" value="accepted" />
            <Btn>Accept quote</Btn>
          </form>
          <button onClick={() => setMode("changes")} className="h-11 flex-1 rounded-xl border border-bbb-border bg-white text-sm font-bold hover:border-bbb-strong">Request changes / add a note</button>
        </div>
      ) : (
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
