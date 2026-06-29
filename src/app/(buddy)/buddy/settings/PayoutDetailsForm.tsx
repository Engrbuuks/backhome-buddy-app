"use client";
import React from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { savePayoutDetails } from "@/lib/buddy/actions";

export default function PayoutDetailsForm({ initial }: { initial: any }) {
  const [state, formAction] = useFormState(savePayoutDetails, { error: "" });
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold">Payout details</h1>
        <p className="mt-1 text-sm text-bbb-slate">Where we send your earnings. Required before your first payout.</p>
      </div>
      {state?.error && <div className="mb-4"><ErrorState title="Could not save" message={state.error} /></div>}
      {"saved" in (state ?? {}) && (state as any).saved && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">Payout details saved.</div>
      )}
      <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <Field label="Bank name" name="bank_name" required defaultValue={initial?.bank_name ?? ""} placeholder="e.g. GTBank" />
        <Field label="Account number" name="bank_account_number" required defaultValue={initial?.bank_account_number ?? ""} placeholder="10-digit NUBAN" minLength={10} maxLength={10} />
        <Field label="Account name" name="bank_account_name" required defaultValue={initial?.bank_account_name ?? ""} placeholder="Name on the account" />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save details</button>
      </form>
    </div>
  );
}
