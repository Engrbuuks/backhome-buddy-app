"use client";
import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

/** Reusable buddy filtering. Pass the buddy array + a render function for the
 *  filtered results. Used by the Buddy Directory and the assignment picker. */

export interface BuddyFilterValue {
  q: string;
  state: string;
  city: string;
  speciality: string;
  availability: string;
  qualification: string; // matched against occupation/experience text
  vetting: string;
}

const EMPTY: BuddyFilterValue = { q: "", state: "", city: "", speciality: "", availability: "", qualification: "", vetting: "" };

const SPECIALITIES = [
  "Property & site visits", "Document pickup & processing", "Deliveries & errands",
  "Family/elderly welfare visits", "Representation", "Photography/video", "Driving/dispatch",
];

export function applyBuddyFilters<T extends any>(buddies: T[], f: BuddyFilterValue, opts: { showVetting?: boolean } = {}): T[] {
  return buddies.filter((b: any) => {
    if (f.state && (b.state ?? "").toLowerCase() !== f.state.toLowerCase()) return false;
    if (f.city && !(b.city ?? "").toLowerCase().includes(f.city.toLowerCase())) return false;
    if (f.availability && (b.availability ?? "") !== f.availability) return false;
    if (opts.showVetting && f.vetting && (b.vetting ?? "") !== f.vetting) return false;
    if (f.speciality) {
      const skills = (Array.isArray(b.skills) ? b.skills.join(" ") : String(b.skills ?? "")).toLowerCase();
      const cov = (Array.isArray(b.coverage_areas) ? b.coverage_areas.join(" ") : String(b.coverage_areas ?? "")).toLowerCase();
      if (!skills.includes(f.speciality.toLowerCase()) && !cov.includes(f.speciality.toLowerCase())) return false;
    }
    if (f.qualification) {
      const hay = `${b.occupation ?? ""} ${b.experience ?? ""}`.toLowerCase();
      if (!hay.includes(f.qualification.toLowerCase())) return false;
    }
    if (f.q) {
      const hay = [b.profiles?.full_name, b.profiles?.email, b.profiles?.phone, b.city, b.state, b.lga, b.occupation, b.coverage_areas, Array.isArray(b.skills) ? b.skills.join(" ") : b.skills].join(" ").toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

export function BuddyFilterBar({ states, value, onChange, showVetting = false, compact = false }: {
  states: string[]; value: BuddyFilterValue; onChange: (v: BuddyFilterValue) => void; showVetting?: boolean; compact?: boolean;
}) {
  const set = (k: keyof BuddyFilterValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const active = Object.values(value).some(Boolean);
  const sel = "h-10 rounded-xl border border-bbb-border bg-white px-3 text-sm outline-none focus:border-bbb-strong";

  return (
    <div className={`rounded-2xl border border-bbb-border bg-white p-3 shadow-soft ${compact ? "" : "mb-4"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bbb-slate" />
          <input value={value.q} onChange={set("q")} placeholder="Search name, city, occupation, skill…" className={`${sel} w-full pl-9`} />
        </div>
        <select value={value.state} onChange={set("state")} className={sel}>
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={value.city} onChange={set("city")} placeholder="City" className={`${sel} w-28`} />
        <select value={value.speciality} onChange={set("speciality")} className={sel}>
          <option value="">Any speciality</option>
          {SPECIALITIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={value.availability} onChange={set("availability")} className={sel}>
          <option value="">Any availability</option>
          <option value="full_time">Full-time</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekends">Weekends</option>
          <option value="flexible">Flexible</option>
        </select>
        <input value={value.qualification} onChange={set("qualification")} placeholder="Qualification / experience" className={`${sel} w-44`} />
        {showVetting && (
          <select value={value.vetting} onChange={set("vetting")} className={sel}>
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="in_review">In review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
        {active && (
          <button onClick={() => onChange({ ...EMPTY })} className="inline-flex items-center gap-1 rounded-xl border border-bbb-border px-3 py-2 text-xs font-bold text-bbb-slate hover:border-bbb-strong">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

export const EMPTY_BUDDY_FILTER = EMPTY;
