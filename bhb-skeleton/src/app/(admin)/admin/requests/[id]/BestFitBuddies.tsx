"use client";
import React, { useState, useTransition } from "react";
import { Sparkles, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";
import { matchBuddiesForTask, type BuddyMatch } from "@/lib/admin/competency-actions";

/** Shows a ranked list of best-fit buddies for this task, by competency +
 *  location. Clicking one calls onPick so the assignment dropdown is filled. */
export default function BestFitBuddies({ requestId, onPick }: { requestId: string; onPick?: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [matches, setMatches] = useState<BuddyMatch[] | null>(null);
  const [err, setErr] = useState("");

  const find = () => start(async () => {
    setErr("");
    const res = await matchBuddiesForTask(requestId);
    if (res.error) { setErr(res.error); return; }
    setMatches(res.matches);
  });

  return (
    <div className="mb-3 rounded-2xl border border-bbb-border bg-bbb-bg p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-bbb-charcoal">
          <Sparkles className="h-4 w-4 text-bbb-strong" /> Best-fit buddies
        </p>
        <button onClick={find} disabled={pending} className="rounded-lg border border-bbb-border bg-white px-3 py-1.5 text-xs font-bold text-bbb-strong hover:border-bbb-strong disabled:opacity-50">
          {pending ? "Finding…" : matches ? "Refresh" : "Find best fit"}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-bbb-slate">Ranks approved buddies by task-type competency and location coverage.</p>

      {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}

      {matches && matches.length === 0 && (
        <p className="mt-3 text-xs text-bbb-slate">No approved buddies found. Approve and assess buddies first.</p>
      )}

      {matches && matches.length > 0 && (
        <div className="mt-3 space-y-2">
          {matches.slice(0, 6).map((m, i) => (
            <div key={m.id} className={`rounded-xl border bg-white p-3 ${i === 0 ? "border-bbb-strong" : "border-bbb-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {i === 0 && <span className="rounded bg-bbb-strong px-1.5 py-0.5 text-[10px] font-bold text-white">TOP MATCH</span>}
                    <p className="font-bold">{m.name}</p>
                    {m.approved && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-bbb-slate">
                    <MapPin className="h-3 w-3" />{[m.city, m.lga, m.state].filter(Boolean).join(", ") || "location —"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.reasons.map((r, ri) => (
                      <span key={ri} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.startsWith("⚠") ? "bg-amber-100 text-amber-700" : "bg-bbb-soft text-bbb-dark"}`}>{r}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-bbb-charcoal px-2 py-0.5 text-xs font-bold text-white">{Math.round(m.score)}</span>
                  {onPick && <button onClick={() => onPick(m.id)} className="rounded-lg bg-bbb-strong px-2.5 py-1 text-xs font-bold text-white hover:bg-bbb-dark">Select</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
