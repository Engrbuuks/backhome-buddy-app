"use client";
import React, { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, AlertTriangle, ChevronRight, Save, Flag } from "lucide-react";
import { INTERVIEW } from "@/lib/admin/interview-catalog";
import { saveInterview, completeInterview, summarize, type AnswerMap, type InterviewData } from "@/lib/admin/interview-actions";

const TASK_TYPES = [
  { key: "property", label: "Property & land" },
  { key: "welfare", label: "Welfare & visits" },
  { key: "documents", label: "Documents & offices" },
  { key: "purchases", label: "Purchases & errands" },
];

function Stars({ value, onChange, size = "md" }: { value?: number | null; onChange: (n: number) => void; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-xs";
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`${dim} rounded-lg font-bold ${value && value >= n ? "bg-bbb-strong text-white" : "bg-bbb-bg text-bbb-slate hover:bg-bbb-soft"}`}>{n}</button>
      ))}
    </div>
  );
}

export default function InterviewRunner({ initial }: { initial: InterviewData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [iv, setIv] = useState<InterviewData>(initial);
  const [answers, setAnswers] = useState<AnswerMap>(initial.answers || {});
  const [savedAt, setSavedAt] = useState<string>("");
  const [done, setDone] = useState(initial.status === "completed");
  const dirty = useRef(false);

  const readonly = done;

  // Autosave (debounced) when things change.
  useEffect(() => {
    if (!dirty.current || readonly) return;
    const t = setTimeout(() => {
      start(async () => {
        await saveInterview(iv.id, { answers, ...pluck(iv) });
        setSavedAt(new Date().toLocaleTimeString());
        dirty.current = false;
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, iv]); // eslint-disable-line

  function pluck(x: InterviewData) {
    return {
      proof_test_score: x.proof_test_score, proof_test_note: x.proof_test_note,
      comp_property: x.comp_property, comp_welfare: x.comp_welfare, comp_documents: x.comp_documents,
      comp_purchases: x.comp_purchases, comp_communication: x.comp_communication, comp_reliability: x.comp_reliability,
      coverage_note: x.coverage_note, specialisms: x.specialisms, concerns: x.concerns,
      approved_task_types: x.approved_task_types,
    };
  }
  const setAns = (k: string, patch: { score?: number; note?: string }) => {
    dirty.current = true;
    setAnswers((p) => ({ ...p, [k]: { ...p[k], ...patch } }));
  };
  const setField = (k: keyof InterviewData, v: any) => { dirty.current = true; setIv((p) => ({ ...p, [k]: v })); };
  const toggleTaskType = (key: string) => {
    dirty.current = true;
    setIv((p) => {
      const cur = p.approved_task_types || [];
      return { ...p, approved_task_types: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
    });
  };

  const sum = useMemo(() => summarize(answers, iv.proof_test_score), [answers, iv.proof_test_score]);

  const saveNow = () => start(async () => {
    await saveInterview(iv.id, { answers, ...pluck(iv) });
    setSavedAt(new Date().toLocaleTimeString());
    dirty.current = false;
  });

  const complete = () => start(async () => {
    await saveInterview(iv.id, { answers, ...pluck(iv), overall_score: sum.overall, decision: iv.decision || sum.decision });
    const res = await completeInterview(iv.id);
    if (!res.error) { setDone(true); router.refresh(); }
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* Header */}
      <div className="mb-6">
        <a href={iv.buddy_id ? "/admin/buddies" : "/admin/recruitment"} className="text-sm font-bold text-bbb-strong hover:underline">← Back</a>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Interview{iv.candidate_name ? ` — ${iv.candidate_name}` : ""}</h1>
        <p className="text-sm text-bbb-slate">{iv.candidate_email || ""} · 30-minute screening · scores and notes save automatically.</p>
        {done && <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">Completed — decision: {iv.decision || sum.decision}</span>}
      </div>

      {/* Live proof test — the gate */}
      <div className={`mb-5 rounded-2xl border p-5 ${iv.proof_test_score && iv.proof_test_score <= 2 ? "border-red-300 bg-red-50" : "border-bbb-border bg-white"}`}>
        <p className="flex items-center gap-1.5 text-sm font-extrabold"><Star className="h-4 w-4 text-bbb-strong" /> Live proof test</p>
        <p className="mt-1 text-xs text-bbb-slate">Ask them now: “Take a clear, well-lit photo of something near you with location on, and send it on WhatsApp.” Score what they send. 2 or below = not field-ready.</p>
        <div className="mt-3 flex items-center gap-3">
          <Stars value={iv.proof_test_score} onChange={(n) => setField("proof_test_score", n)} />
          {iv.proof_test_score != null && iv.proof_test_score <= 2 && <span className="text-xs font-bold text-red-600">⚠ Not field-ready</span>}
        </div>
        <input disabled={readonly} value={iv.proof_test_note || ""} onChange={(e) => setField("proof_test_note", e.target.value)}
          placeholder="Note on the photo they sent (clarity, location, speed)…"
          className="mt-2 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
      </div>

      {/* Question sections */}
      {INTERVIEW.map((sec) => (
        <div key={sec.key} className="mb-5 rounded-2xl border border-bbb-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-base font-extrabold">{sec.title}</p>
            <span className="text-xs text-bbb-slate">~{sec.minutes} min</span>
          </div>
          {sec.intro && <p className="mb-3 text-xs italic text-bbb-slate">{sec.intro}</p>}
          <div className="space-y-5">
            {sec.questions.map((qq) => {
              const a = answers[qq.key] || {};
              const flag = qq.honesty && (a.score || 0) > 0 && (a.score || 0) <= 2;
              return (
                <div key={qq.key} className={`rounded-xl border p-3 ${flag ? "border-red-300 bg-red-50" : "border-bbb-border"}`}>
                  <p className="flex items-start gap-2 text-sm font-bold text-bbb-charcoal">
                    {qq.honesty && <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                    {qq.q}
                  </p>
                  {qq.why && <p className="mt-1 text-[11px] italic text-bbb-slate">Why: {qq.why}</p>}
                  {qq.followup && <p className="mt-0.5 text-[11px] text-bbb-slate">Follow-up: {qq.followup}</p>}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-bbb-soft/50 p-2">
                      <p className="mb-1 text-[10px] font-bold uppercase text-green-700">Good answers show</p>
                      <ul className="space-y-0.5">{qq.goods.map((g, i) => <li key={i} className="text-[11px] text-bbb-charcoal">✓ {g}</li>)}</ul>
                    </div>
                    <div className="rounded-lg bg-red-50/60 p-2">
                      <p className="mb-1 text-[10px] font-bold uppercase text-red-600">Red flags</p>
                      <ul className="space-y-0.5">{qq.reds.map((r, i) => <li key={i} className="text-[11px] text-bbb-charcoal">✕ {r}</li>)}</ul>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Stars size="sm" value={a.score} onChange={(n) => setAns(qq.key, { score: n })} />
                    {flag && <span className="text-[11px] font-bold text-red-600">⚠ Honesty red flag</span>}
                  </div>
                  <input disabled={readonly} value={a.note || ""} onChange={(e) => setAns(qq.key, { note: e.target.value })}
                    placeholder="Notes on their answer…"
                    className="mt-2 w-full rounded-lg border border-bbb-border px-3 py-1.5 text-sm outline-none focus:border-bbb-strong" />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Task-type competency */}
      <div className="mb-5 rounded-2xl border border-bbb-border bg-white p-5">
        <p className="mb-3 font-display text-base font-extrabold">Task-type competency</p>
        {[["comp_property", "Property & land"], ["comp_welfare", "Welfare & visits"], ["comp_documents", "Documents & offices"], ["comp_purchases", "Purchases & errands"], ["comp_communication", "Communication clarity"], ["comp_reliability", "Reliability signal"]].map(([k, label]) => (
          <div key={k} className="flex items-center justify-between border-b border-bbb-border py-2 last:border-0">
            <span className="text-sm font-semibold">{label}</span>
            <Stars size="sm" value={(iv as any)[k]} onChange={(n) => setField(k as any, n)} />
          </div>
        ))}
        <p className="mb-1.5 mt-3 text-xs font-bold text-bbb-slate">Cleared for these task types</p>
        <div className="flex flex-wrap gap-1.5">
          {TASK_TYPES.map((t) => {
            const on = (iv.approved_task_types || []).includes(t.key);
            return <button key={t.key} type="button" onClick={() => toggleTaskType(t.key)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-bbb-strong text-white" : "border border-bbb-border text-bbb-slate hover:border-bbb-strong"}`}>{on ? "✓ " : ""}{t.label}</button>;
          })}
        </div>
        <div className="mt-3 space-y-2">
          <input disabled={readonly} value={iv.coverage_note || ""} onChange={(e) => setField("coverage_note", e.target.value)} placeholder="Coverage: specific areas/LGAs they can reach, transport…" className="w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          <input disabled={readonly} value={iv.specialisms || ""} onChange={(e) => setField("specialisms", e.target.value)} placeholder="Specialisms / standout strengths…" className="w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          <input disabled={readonly} value={iv.concerns || ""} onChange={(e) => setField("concerns", e.target.value)} placeholder="Concerns / watch-outs…" className="w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
        </div>
      </div>

      {/* Summary + decision */}
      <div className="sticky bottom-4 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="font-bold">Score: {sum.overall}/100</span>
            <span className="ml-3 text-bbb-slate">{sum.answered} answered</span>
            {sum.honestyFlag && <span className="ml-3 font-bold text-red-600">⚠ Honesty flag</span>}
            {sum.proofFail && <span className="ml-3 font-bold text-red-600">⚠ Proof fail</span>}
          </div>
          <span className="text-xs text-bbb-slate">{savedAt ? `Saved ${savedAt}` : dirty.current ? "Unsaved…" : ""}</span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {[["advance", "Advance", "bg-green-600"], ["trial", "Trial task", "bg-amber-500"], ["decline", "Decline", "bg-red-600"]].map(([k, lbl, cls]) => (
            <button key={k} disabled={readonly} onClick={() => setField("decision", k)}
              className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${iv.decision === k ? cls : "bg-gray-300"}`}>{lbl}</button>
          ))}
          <span className="self-center text-xs text-bbb-slate">Suggested: <b>{sum.decision}</b></span>
        </div>
        {!done ? (
          <div className="flex gap-2">
            <button onClick={saveNow} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-bbb-border px-4 py-2.5 text-sm font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50"><Save className="h-4 w-4" /> Save</button>
            <button onClick={complete} disabled={pending} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-bbb-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"><Check className="h-4 w-4" /> Complete interview{iv.buddy_id ? " & sync competency" : ""}</button>
          </div>
        ) : (
          <p className="text-center text-sm font-semibold text-green-700">Interview completed{iv.buddy_id ? " — competency synced to buddy profile." : "."}</p>
        )}
      </div>
    </div>
  );
}
