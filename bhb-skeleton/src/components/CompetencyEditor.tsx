"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Save } from "lucide-react";
import { saveCompetency, type CompetencyInput } from "@/lib/admin/competency-actions";

const TASK_TYPES = [
  { key: "property", label: "Property & land" },
  { key: "welfare", label: "Welfare & visits" },
  { key: "documents", label: "Documents & offices" },
  { key: "purchases", label: "Purchases & errands" },
];

function Rating({ label, hint, value, onChange }: { label: string; hint?: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-bbb-charcoal">{label}</p>
        {hint && <p className="text-[11px] text-bbb-slate">{hint}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`h-7 w-7 rounded-lg text-xs font-bold ${value && value >= n ? "bg-bbb-strong text-white" : "bg-bbb-bg text-bbb-slate hover:bg-bbb-soft"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompetencyEditor({ buddy }: { buddy: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [f, setF] = useState<CompetencyInput>({
    proof_test_score: buddy.proof_test_score ?? null,
    comp_property: buddy.comp_property ?? null,
    comp_welfare: buddy.comp_welfare ?? null,
    comp_documents: buddy.comp_documents ?? null,
    comp_purchases: buddy.comp_purchases ?? null,
    comp_communication: buddy.comp_communication ?? null,
    comp_reliability: buddy.comp_reliability ?? null,
    competency_specialisms: buddy.competency_specialisms ?? "",
    competency_notes: buddy.competency_notes ?? "",
    approved_task_types: buddy.approved_task_types ?? [],
  });
  const set = (k: keyof CompetencyInput, v: any) => setF((p) => ({ ...p, [k]: v }));
  const toggleApproved = (key: string) => setF((p) => {
    const cur = p.approved_task_types || [];
    return { ...p, approved_task_types: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
  });

  const save = () => start(async () => {
    setErr(""); setMsg("");
    const res = await saveCompetency(buddy.id, f);
    if (res.error) setErr(res.error); else { setMsg("Competency saved."); router.refresh(); }
  });

  const lowProof = f.proof_test_score != null && f.proof_test_score <= 2;

  return (
    <div className="mt-3 rounded-2xl border border-bbb-border bg-white p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-bbb-strong">
        <Star className="h-3.5 w-3.5" /> Competency & task fit
      </p>
      <p className="mb-3 text-xs text-bbb-slate">From the interview scorecard. Drives task-fit matching.</p>

      {/* Proof test — the gate */}
      <div className={`mb-3 rounded-xl p-3 ${lowProof ? "bg-red-50" : "bg-bbb-soft"}`}>
        <Rating label="Live proof-test score" hint="Photo they took live. 2 or below = not field-ready." value={f.proof_test_score} onChange={(n) => set("proof_test_score", n)} />
        {lowProof && <p className="text-[11px] font-semibold text-red-600">⚠ Low proof score — not field-ready yet. Retest or train before assigning tasks.</p>}
      </div>

      {/* Task-type competency */}
      <p className="mb-1 text-xs font-bold text-bbb-slate">Task-type competency</p>
      <div className="divide-y divide-bbb-border">
        <Rating label="Property & land" value={f.comp_property} onChange={(n) => set("comp_property", n)} />
        <Rating label="Welfare & visits" value={f.comp_welfare} onChange={(n) => set("comp_welfare", n)} />
        <Rating label="Documents & offices" value={f.comp_documents} onChange={(n) => set("comp_documents", n)} />
        <Rating label="Purchases & errands" value={f.comp_purchases} onChange={(n) => set("comp_purchases", n)} />
      </div>

      <p className="mb-1 mt-3 text-xs font-bold text-bbb-slate">General</p>
      <div className="divide-y divide-bbb-border">
        <Rating label="Communication clarity" value={f.comp_communication} onChange={(n) => set("comp_communication", n)} />
        <Rating label="Reliability signal" value={f.comp_reliability} onChange={(n) => set("comp_reliability", n)} />
      </div>

      {/* Approved task types */}
      <p className="mb-1.5 mt-3 text-xs font-bold text-bbb-slate">Cleared for these task types</p>
      <div className="flex flex-wrap gap-1.5">
        {TASK_TYPES.map((t) => {
          const on = (f.approved_task_types || []).includes(t.key);
          return (
            <button key={t.key} type="button" onClick={() => toggleApproved(t.key)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-bbb-strong text-white" : "border border-bbb-border text-bbb-slate hover:border-bbb-strong"}`}>
              {on ? "✓ " : ""}{t.label}
            </button>
          );
        })}
      </div>

      {/* Notes */}
      <div className="mt-3 space-y-2">
        <div>
          <label className="text-xs font-bold text-bbb-slate">Specialisms / standout strengths</label>
          <input value={f.competency_specialisms || ""} onChange={(e) => set("competency_specialisms", e.target.value)}
            placeholder="e.g. Excellent with elderly — prioritise for welfare"
            className="mt-1 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
        </div>
        <div>
          <label className="text-xs font-bold text-bbb-slate">Concerns / watch-outs</label>
          <input value={f.competency_notes || ""} onChange={(e) => set("competency_notes", e.target.value)}
            placeholder="e.g. Slower to respond on weekends"
            className="mt-1 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
        </div>
      </div>

      {msg && <p className="mt-2 text-xs font-semibold text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
      <button onClick={save} disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
        <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save competency"}
      </button>
    </div>
  );
}
