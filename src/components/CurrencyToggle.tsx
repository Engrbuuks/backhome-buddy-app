"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, CURRENCY_META, type Currency } from "@/lib/money/currency";
import { setMyCurrency } from "@/lib/money/fx";

/** Small currency switcher for client pages. Persists the choice to the profile
 *  so it sticks across sessions and pages. */
export default function CurrencyToggle({ current }: { current: Currency }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cur, setCur] = useState<Currency>(current);

  const pick = (c: Currency) => start(async () => {
    setCur(c);
    await setMyCurrency(c);
    router.refresh();
  });

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-bbb-border bg-white p-1">
      {CURRENCIES.map((c) => (
        <button key={c} onClick={() => pick(c)} disabled={pending}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${cur === c ? "bg-bbb-strong text-white" : "text-bbb-slate hover:bg-bbb-bg"}`}
          title={CURRENCY_META[c].label}>
          {CURRENCY_META[c].symbol} {c}
        </button>
      ))}
    </div>
  );
}
