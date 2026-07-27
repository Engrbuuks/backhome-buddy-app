"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES, CURRENCY_META, type Currency } from "@/lib/money/currency";
import { setClientCurrency } from "@/lib/money/fx";

export default function ClientCurrencyPicker({ clientId, current }: { clientId: string; current: Currency }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cur, setCur] = useState<Currency>(current);
  const [msg, setMsg] = useState("");

  const pick = (c: Currency) => start(async () => {
    setCur(c); setMsg("");
    const res = await setClientCurrency(clientId, c);
    if (!res.error) { setMsg("Saved"); router.refresh(); }
  });

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {CURRENCIES.map((c) => (
          <button key={c} onClick={() => pick(c)} disabled={pending}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${cur === c ? "bg-bbb-strong text-white" : "border border-bbb-border text-bbb-slate hover:border-bbb-strong"}`}>
            {CURRENCY_META[c].symbol} {c}
          </button>
        ))}
      </div>
      {msg && <span className="mt-1 inline-block text-[11px] font-semibold text-green-700">{msg}</span>}
    </div>
  );
}
