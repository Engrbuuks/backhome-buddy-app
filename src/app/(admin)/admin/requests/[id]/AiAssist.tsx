"use client";
import React, { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { ErrorState } from "@/components/StateBlocks";
import { aiDraftReport, aiTriageRequest, aiCheckProofs, saveReport, sendMessageToClient } from "@/lib/ai/assist-actions";

/** AI assists on the admin request page. AI drafts — the admin approves.
 *  Nothing is sent to the client without an explicit human action. */
export default function AiAssist({ request }: { request: any }) {
  const [error, setError] = useState("");
  const [triage, setTriage] = useState("");
  const [triageSent, setTriageSent] = useState(false);
  const [proofCheck, setProofCheck] = useState("");
  const [report, setReport] = useState(request.report ?? "");
  const [reportSaved, setReportSaved] = useState(false);
  const [busy, setBusy] = useState("");
  const [pending, start] = useTransition();

  const hasProofs = (request.proofs ?? []).length > 0;
  const showTriage = ["submitted", "quoted"].includes(request.status);
  const showProofTools = hasProofs || ["proof_ready", "proof_approved", "completed"].includes(request.status);
  if (!showTriage && !showProofTools) return null;

  function runAi(kind: string, fn: () => Promise<{ text?: string; error?: string }>, set: (t: string) => void) {
    setBusy(kind); setError("");
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else set(r.text ?? "");
      setBusy("");
    });
  }

  return (
    <div className="mb-5 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><Sparkles className="h-4 w-4 text-bbb-strong" /> AI assist</h2>
      <p className="mt-1 text-xs text-bbb-slate">Drafts only — review and edit everything before it reaches a client.</p>
      {error && <div className="mt-3"><ErrorState title="AI assist failed" message={error} /></div>}

      <div className="mt-3 flex flex-wrap gap-2">
        {showTriage && (
          <button disabled={pending} onClick={() => runAi("triage", () => aiTriageRequest(request.id), setTriage)} className="rounded-xl border border-bbb-border px-4 py-2 text-sm font-bold hover:border-bbb-strong disabled:opacity-50">
            {busy === "triage" ? "Analyzing…" : "Triage & draft questions"}
          </button>
        )}
        {showProofTools && (
          <>
            <button disabled={pending} onClick={() => runAi("check", () => aiCheckProofs(request.id), setProofCheck)} className="rounded-xl border border-bbb-border px-4 py-2 text-sm font-bold hover:border-bbb-strong disabled:opacity-50">
              {busy === "check" ? "Reviewing photos…" : "Check proof completeness"}
            </button>
            <button disabled={pending} onClick={() => runAi("report", () => aiDraftReport(request.id), (t) => { setReport(t); setReportSaved(false); })} className="rounded-xl border border-bbb-border px-4 py-2 text-sm font-bold hover:border-bbb-strong disabled:opacity-50">
              {busy === "report" ? "Drafting…" : request.report ? "Re-draft client report" : "Draft client report"}
            </button>
          </>
        )}
      </div>

      {triage && (
        <div className="mt-4 rounded-2xl bg-bbb-bg p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Message to client (edit, then send)</p>
            <button onClick={() => navigator.clipboard?.writeText(triage)} className="text-xs font-bold text-bbb-strong">Copy</button>
          </div>
          <textarea
            value={triage}
            onChange={(e) => { setTriage(e.target.value); setTriageSent(false); }}
            rows={8}
            className="mt-2 w-full rounded-xl border border-bbb-border bg-white p-3 text-sm leading-6 outline-none focus:border-bbb-strong"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              disabled={pending || !triage.trim()}
              onClick={() => start(async () => { setError(""); const r = await sendMessageToClient(request.id, triage); if (r?.error) setError(r.error); else setTriageSent(true); })}
              className="rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
            >{pending ? "Sending…" : "Send to client"}</button>
            {triageSent && <span className="text-sm font-semibold text-green-700">Sent — the client is notified by app &amp; email ✓</span>}
          </div>
        </div>
      )}

      {proofCheck && (
        <div className="mt-4 rounded-2xl bg-bbb-bg p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Proof completeness</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6">{proofCheck}</p>
        </div>
      )}

      {(report || showProofTools) && report !== "" && (
        <div className="mt-4 rounded-2xl bg-bbb-bg p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-slate">Client report (edit, then save — the client sees the saved version)</p>
          <textarea value={report} onChange={(e) => { setReport(e.target.value); setReportSaved(false); }} rows={12} className="mt-2 w-full rounded-xl border border-bbb-border bg-white p-3 font-mono text-xs leading-relaxed outline-none focus:border-bbb-strong" />
          <div className="mt-2 flex items-center gap-3">
            <button disabled={pending || !report.trim()} onClick={() => start(async () => { setError(""); const r = await saveReport(request.id, report); if (r?.error) setError(r.error); else setReportSaved(true); })} className="rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Save report for client</button>
            {reportSaved && <span className="text-sm font-semibold text-green-700">Saved — visible on the client&apos;s request ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}
