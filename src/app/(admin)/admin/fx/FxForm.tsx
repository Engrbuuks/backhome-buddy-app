"use client";
import React from "react";
import { useFormState } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { setRates, setBankDetails, setAutoReleaseDays, type BankDetail } from "@/lib/money/fx";
import { CURRENCIES, CURRENCY_META, type Currency, type RateMap } from "@/lib/money/currency";

export default function FxForm({ rates, banks, days = 7 }: {
  rates: RateMap; banks: Partial<Record<Currency, BankDetail>>; days?: number;
}) {
  const [rState, rAction] = useFormState(setRates, { error: "" });
  const [bState, bAction] = useFormState(setBankDetails, { error: "" });
  const [dState, dAction] = useFormState(setAutoReleaseDays, { error: "" });
  const foreign = CURRENCIES.filter((c) => c !== "NGN");

  return (
    <AdminShell title="Currency & Banking">
      <PageHeader eyebrow="Settings" title="Currency & banking" description="Exchange rates and the bank account shown on invoices, per currency. New quotes lock the rate at quote time, so a client's price never drifts after quoting." />

      <form action={rAction} className="mb-6 max-w-2xl rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="mb-1 font-display text-base font-extrabold">Exchange rates</p>
        <p className="mb-4 text-xs text-bbb-slate">How many Naira equal 1 unit of each currency. Naira is the base.</p>
        {rState?.error && <div className="mb-3"><ErrorState title="Could not save" message={rState.error} /></div>}
        {(rState as any)?.saved && <div className="mb-3 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Rates updated.</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          {foreign.map((c) => (
            <Field key={c} label={`NGN per 1 ${CURRENCY_META[c].symbol} (${c})`} name={`rate_${c}`} type="number" step="0.01" defaultValue={String(rates[c] ?? "")} />
          ))}
        </div>
        <button className="mt-4 h-11 rounded-xl bg-bbb-strong px-6 text-sm font-bold text-white hover:bg-bbb-dark">Save rates</button>
      </form>

      <form action={bAction} className="mb-6 max-w-2xl rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="mb-1 font-display text-base font-extrabold">Bank details on invoices</p>
        <p className="mb-4 text-xs text-bbb-slate">Fill the account for each currency you collect in. Only currencies with an account number are shown on invoices. Leave blank to skip.</p>
        {bState?.error && <div className="mb-3"><ErrorState title="Could not save" message={bState.error} /></div>}
        {(bState as any)?.saved && <div className="mb-3 rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Bank details saved.</div>}
        <div className="space-y-5">
          {CURRENCIES.map((c) => {
            const b = banks[c] || ({} as BankDetail);
            return (
              <div key={c} className="rounded-2xl border border-bbb-border bg-bbb-bg p-4">
                <p className="mb-3 text-sm font-extrabold">{CURRENCY_META[c].flag} {c} — {CURRENCY_META[c].label}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bank name" name={`bank_${c}_name`} defaultValue={b.bank_name || ""} placeholder={c === "NGN" ? "e.g. Wema Bank" : "Bank name"} />
                  <Field label="Account name" name={`bank_${c}_account_name`} defaultValue={b.account_name || ""} placeholder="Backhome Buddy Ltd" />
                  <Field label="Account number / IBAN" name={`bank_${c}_account_number`} defaultValue={b.account_number || ""} placeholder="Account number" />
                  <Field label="Extra (sort code / SWIFT / routing)" name={`bank_${c}_extra`} defaultValue={b.extra || ""} placeholder="Optional" />
                </div>
              </div>
            );
          })}
        </div>
        <button className="mt-4 h-11 rounded-xl bg-bbb-strong px-6 text-sm font-bold text-white hover:bg-bbb-dark">Save bank details</button>
      </form>

      <form action={dAction} className="max-w-md space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {dState?.error && <ErrorState title="Could not save" message={dState.error} />}
        {(dState as any)?.saved && <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Timer updated.</div>}
        <div>
          <p className="font-display text-base font-extrabold">Auto-release timer</p>
          <p className="mt-1 text-xs text-bbb-slate">After proof approval, the client has this many days to confirm or raise an issue. Silence auto-confirms and makes the payout eligible.</p>
        </div>
        <Field label="Days (1-30)" name="days" type="number" min={1} max={30} defaultValue={String(days)} />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save timer</button>
      </form>
    </AdminShell>
  );
}
