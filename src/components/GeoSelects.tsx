"use client";
import React, { useMemo, useState } from "react";
import { NIGERIA_STATES, lgasForState, COUNTRIES } from "@/data/nigeria-geo";
import { X, ChevronDown } from "lucide-react";

/** Country select (Nigeria-first). Controlled. */
export function CountrySelect({ value, onChange, name, label = "Country" }: {
  value: string; onChange: (v: string) => void; name?: string; label?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-bbb-charcoal">{label}</span>
      <select name={name} value={value || "Nigeria"} onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );
}

/** State select + dependent LGA select. Selecting a state repopulates LGAs and
 *  clears an LGA that no longer belongs to the chosen state. */
export function StateLgaSelect({
  state, lga, onStateChange, onLgaChange, stateName = "state", lgaName = "lga", required,
}: {
  state: string; lga: string;
  onStateChange: (v: string) => void; onLgaChange: (v: string) => void;
  stateName?: string; lgaName?: string; required?: boolean;
}) {
  const lgas = useMemo(() => lgasForState(state), [state]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-bbb-charcoal">State{required && " *"}</span>
        <select
          name={stateName} value={state}
          onChange={(e) => {
            const s = e.target.value;
            onStateChange(s);
            // clear LGA if it isn't in the new state's list
            if (lga && !lgasForState(s).includes(lga)) onLgaChange("");
          }}
          className="h-12 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
          <option value="">Select state…</option>
          {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-bbb-charcoal">Local Government Area{required && " *"}</span>
        <select
          name={lgaName} value={lga} disabled={!state}
          onChange={(e) => onLgaChange(e.target.value)}
          className="h-12 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong disabled:bg-bbb-bg disabled:text-bbb-slate">
          <option value="">{state ? "Select LGA…" : "Select a state first"}</option>
          {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Multi-select of LGAs for service/coverage areas. Lets the buddy pick LGAs
 *  from any state (they may cover across a border). Values are stored as an
 *  array of "LGA, State" strings, and mirrored into a hidden input as JSON so it
 *  submits with a plain <form>. */
export function LgaMultiSelect({
  value, onChange, name = "coverage_areas", label = "Service areas (select all you cover)",
}: {
  value: string[]; onChange: (v: string[]) => void; name?: string; label?: string;
}) {
  const [pickState, setPickState] = useState("");
  const lgas = useMemo(() => lgasForState(pickState), [pickState]);

  const add = (lga: string) => {
    if (!lga || !pickState) return;
    const tag = `${lga}, ${pickState}`;
    if (!value.includes(tag)) onChange([...value, tag]);
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-bbb-charcoal">{label}</span>
      <p className="mb-2 text-xs text-bbb-slate">Pick a state, then add each LGA you can cover. Add as many as you like, across states.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={pickState} onChange={(e) => setPickState(e.target.value)}
          className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong">
          <option value="">Select state…</option>
          {NIGERIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value="" disabled={!pickState} onChange={(e) => { add(e.target.value); e.currentTarget.value = ""; }}
          className="h-11 w-full rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong disabled:bg-bbb-bg disabled:text-bbb-slate">
          <option value="">{pickState ? "Add an LGA…" : "Select a state first"}</option>
          {lgas.filter((l) => !value.includes(`${l}, ${pickState}`)).map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Selected chips */}
      {value.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-bbb-soft px-3 py-1 text-xs font-semibold text-bbb-dark">
              {tag}
              <button type="button" onClick={() => remove(tag)} className="text-bbb-slate hover:text-red-600"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-bbb-slate">No areas selected yet.</p>
      )}

      {/* Hidden field so it submits with a normal form (JSON array). */}
      <input type="hidden" name={name} value={JSON.stringify(value)} />
    </div>
  );
}
