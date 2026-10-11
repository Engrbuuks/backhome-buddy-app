"use client";
import React, { useState, useTransition, useEffect } from "react";
import { useFormState } from "react-dom";
import { Field } from "@/components/FormControls";
import { ErrorState } from "@/components/StateBlocks";
import { savePayoutDetails, setAcceptingWork } from "@/lib/buddy/actions";
import { getBankList } from "@/lib/verification/actions";

export default function PayoutDetailsForm({ initial }: { initial: any }) {
  const [state, formAction] = useFormState(savePayoutDetails, { error: "" });

  // The bank code is what makes the lookup possible; a free-text bank name
  // cannot be resolved. Loaded from Paystack and cached server side.
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState<string>(initial?.bank_code ?? "");
  useEffect(() => { getBankList().then(setBanks).catch(() => {}); }, []);

  // The buddy's own availability switch. Defaults to on for anyone whose row
  // predates the column.
  const [accepting, setAccepting] = useState<boolean>(initial?.accepting_work ?? true);
  const [availPending, startAvail] = useTransition();
  const [availError, setAvailError] = useState("");
  function toggleAccepting() {
    const next = !accepting;
    setAccepting(next);                       // optimistic
    startAvail(async () => {
      const r = await setAcceptingWork(next);
      if (r.error) { setAccepting(!next); setAvailError(r.error); }
      else setAvailError("");
    });
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm text-bbb-slate">Your availability and where we send your earnings.</p>
      </div>

      <section className="mb-6 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-bbb-slate">Availability</h2>
            <p className="mt-1.5 text-sm font-semibold text-bbb-charcoal">
              {accepting ? "You are accepting new tasks" : "You are not accepting new tasks"}
            </p>
            <p className="mt-1 text-xs text-bbb-slate">
              Turn this off when you are travelling, unwell or already busy. Nothing new will be offered to you until you turn it back on. Work already assigned to you is not affected.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={accepting}
            aria-label="Accepting new tasks"
            disabled={availPending}
            onClick={toggleAccepting}
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${accepting ? "bg-bbb-strong" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${accepting ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        {availError && <p className="mt-3 text-xs font-semibold text-red-600">{availError}</p>}
      </section>

      <div className="mb-4">
        <h2 className="font-display text-lg font-extrabold">Payout details</h2>
        <p className="mt-1 text-sm text-bbb-slate">Where we send your earnings. Required before your first payout.</p>
      </div>
      {state?.error && <div className="mb-4"><ErrorState title="Could not save" message={state.error} /></div>}
      {"saved" in (state ?? {}) && (state as any).saved && (() => {
        const c = (state as any).check;
        if (!c?.ran) {
          return (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold">Payout details saved.</p>
              {c?.reason && <p className="mt-1 text-xs">Account check not completed: {c.reason}</p>}
            </div>
          );
        }
        if (c.outcome === "pass") {
          return (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold">Saved and verified.</p>
              <p className="mt-1 text-xs">Your bank confirms this account belongs to {c.bankName}.</p>
            </div>
          );
        }
        return (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Saved, but the name does not match</p>
            <p className="mt-1 text-xs">
              Your bank has this account as <strong>{c.bankName}</strong>. If that is not you, check the account
              number and bank. If it is you under a different spelling, we will confirm it by hand.
            </p>
          </div>
        );
      })()}
      <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {banks.length > 0 ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-bbb-charcoal">Bank</span>
            <select
              name="bank_code"
              required
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong"
            >
              <option value="">Select your bank…</option>
              {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            {/* Carried alongside the code so the readable name is stored too. */}
            <input type="hidden" name="bank_name" value={banks.find((b) => b.code === bankCode)?.name ?? (initial?.bank_name ?? "")} />
          </label>
        ) : (
          <Field label="Bank name" name="bank_name" required defaultValue={initial?.bank_name ?? ""} placeholder="e.g. GTBank" />
        )}
        <Field label="Account number" name="bank_account_number" required defaultValue={initial?.bank_account_number ?? ""} placeholder="10-digit NUBAN" minLength={10} maxLength={10} />
        <Field label="Account name" name="bank_account_name" required defaultValue={initial?.bank_account_name ?? ""} placeholder="Name on the account" />
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Save and verify</button>
        <p className="text-xs text-bbb-slate">
          We check the name on this account against your profile automatically. Nothing is shared with anyone;
          it simply confirms the account is yours.
        </p>
      </form>
    </div>
  );
}
