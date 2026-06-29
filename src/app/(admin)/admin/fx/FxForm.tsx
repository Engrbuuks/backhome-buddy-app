"use client";
import React from "react";
import { useFormState } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { setUsdRate, setAutoReleaseDays } from "@/lib/money/fx";

export default function FxForm({ rate, days = 7 }: { rate: number; days?: number }) {
  const [state, formAction] = useFormState(setUsdRate, { error: "" });
  const [dState, dAction] = useFormState(setAutoReleaseDays, { error: "" });
  return (
    <AdminShell title="FX Rate">
      <PageHeader eyebrow="Settings" title="USD exchange rate" description="Your operational ₦/$ rate. New quotes lock the rate at quote time, so a client's dollar price never drifts after quoting." />
      <form action={formAction} className="max-w-md space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {state?.error && <ErrorState title="Could not save" message={state.error} />}
        {(state as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Rate updated.</div>}
        <Field label="₦ per $1" name="rate" type="number" step="0.01" defaultValue={String(rate)} />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save rate</button>
      </form>
      <form action={dAction} className="mt-5 max-w-md space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {dState?.error && <ErrorState title="Could not save" message={dState.error} />}
        {(dState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Timer updated.</div>}
        <div>
          <p className="font-display text-base font-extrabold">Auto-release timer</p>
          <p className="mt-1 text-xs text-bbb-slate">After proof approval, the client has this many days to confirm or raise an issue. Silence auto-confirms and makes the payout eligible.</p>
        </div>
        <Field label="Days (1–30)" name="days" type="number" min={1} max={30} defaultValue={String(days)} />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save timer</button>
      </form>
    </AdminShell>
  );
}
