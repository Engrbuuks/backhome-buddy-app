"use client";
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, ClipboardPaste, Check, X, CalendarClock, Send, Trash2, RefreshCw, FileText } from "lucide-react";
import {
  importRecruits, setRecruitStatus, sendApplyInvite, sendAllApplyInvites,
  syncApplied, sendInterviewInvite, sendAllInterviewInvites, deleteRecruit, type RecruitInput,
} from "@/lib/admin/recruitment-actions";

const STATUS_LABEL: Record<string, string> = {
  new: "New", invited_to_apply: "Invited to apply", applied: "Applied",
  qualified: "Qualifies for interview", invited_to_interview: "Interview invited", rejected: "Rejected",
};
const STATUS_STYLE: Record<string, string> = {
  new: "bg-bbb-bg text-bbb-slate",
  invited_to_apply: "bg-amber-100 text-amber-700",
  applied: "bg-blue-100 text-blue-700",
  qualified: "bg-green-100 text-green-700",
  invited_to_interview: "bg-bbb-soft text-bbb-dark",
  rejected: "bg-red-100 text-red-700",
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') inQ = false; else field += c; }
    else { if (c === '"') inQ = true; else if (c === ",") { row.push(field); field = ""; } else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; } else if (c === "\r") {} else field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
function mapHeader(h: string): keyof RecruitInput | null {
  const s = h.toLowerCase();
  if (s.includes("name")) return "full_name";
  if (s.includes("email")) return "email";
  if (s.includes("phone") || s.includes("whatsapp")) return "phone";
  if (s.includes("state")) return "state";
  if (s.includes("city") || s.includes("town")) return "city";
  if (s.includes("occupation")) return "occupation";
  if (s.includes("avail")) return "availability";
  if (s.includes("cover")) return "coverage";
  if (s.includes("strength")) return "strengths";
  if (s === "tier") return "tier";
  return null;
}
function rowsToRecruits(rows: string[][]): RecruitInput[] {
  if (rows.length < 2) return [];
  const header = rows[0].map(mapHeader);
  const out: RecruitInput[] = [];
  for (const r of rows.slice(1)) {
    const rec: any = {};
    header.forEach((key, i) => { if (key) rec[key] = (r[i] || "").trim(); });
    if (rec.full_name) out.push(rec);
  }
  return out;
}

export default function RecruitmentBoard({ initial }: { initial: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const recruits = initial;
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: recruits.length };
    for (const r of recruits) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [recruits]);
  const shown = filter === "all" ? recruits : recruits.filter((r) => r.status === filter);
  const newCount = counts["new"] || 0;
  const qualifiedCount = counts["qualified"] || 0;

  const doImport = (recs: RecruitInput[]) => start(async () => {
    setErr(""); setMsg("");
    if (recs.length === 0) { setErr("Couldn't find any rows with a name column."); return; }
    const res = await importRecruits(recs);
    if (res.error) { setErr(res.error); return; }
    setMsg(`Imported ${res.added}${res.skipped ? `, skipped ${res.skipped} (duplicates/no name)` : ""}.`);
    setShowPaste(false); setPasteText(""); router.refresh();
  });
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => doImport(rowsToRecruits(parseCSV(String(reader.result || ""))));
    reader.readAsText(file); e.target.value = "";
  };
  const onPaste = () => {
    const text = pasteText.trim(); if (!text) { setErr("Nothing pasted."); return; }
    const looksTab = text.split("\n")[0].includes("\t");
    const rows = looksTab ? text.split("\n").map((l) => l.split("\t")) : parseCSV(text);
    doImport(rowsToRecruits(rows));
  };
  const act = (fn: () => Promise<{ error: string }>) => start(async () => {
    setErr(""); setMsg("");
    const res = await fn();
    if ((res as any).error) setErr((res as any).error); else router.refresh();
  });
  const syncNow = () => start(async () => {
    setErr(""); setMsg("");
    const res = await syncApplied();
    if (res.error) setErr(res.error);
    else { setMsg(res.matched ? `${res.matched} recruit(s) have applied on the app.` : "No new applications matched yet."); router.refresh(); }
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-bbb-strong">Recruitment</p>
        <h1 className="font-display text-2xl font-extrabold">Buddy Pipeline</h1>
        <p className="mt-1 text-sm text-bbb-slate">Invite shortlisted people to apply on the app. Once they apply and meet the criteria, invite them to a screening interview.</p>
      </div>

      <div className="mb-4 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <p className="font-display text-base font-extrabold">Add recruits</p>
        <p className="mt-1 text-xs text-bbb-slate">Upload the tiered CSV, or paste rows from a spreadsheet. Duplicates skipped automatically.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark">
            <UploadCloud className="h-4 w-4" /> Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={pending} />
          </label>
          <button onClick={() => setShowPaste((s) => !s)} className="inline-flex items-center gap-2 rounded-xl border border-bbb-border px-4 py-2 text-sm font-bold text-bbb-slate hover:border-bbb-strong">
            <ClipboardPaste className="h-4 w-4" /> Paste rows
          </button>
        </div>
        {showPaste && (
          <div className="mt-3">
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
              placeholder="Paste rows here. First row = headers (Name, Email, Phone, State, City, Occupation, Availability, Coverage, Tier)."
              className="w-full rounded-xl border border-bbb-border p-3 text-xs outline-none focus:border-bbb-strong" />
            <button onClick={onPaste} disabled={pending} className="mt-2 rounded-xl bg-bbb-charcoal px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Import pasted rows</button>
          </div>
        )}
        {msg && <p className="mt-2 text-xs font-semibold text-green-700">{msg}</p>}
        {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {newCount > 0 && (
          <button onClick={() => act(sendAllApplyInvites)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
            <FileText className="h-3.5 w-3.5" /> Invite all {newCount} new to apply
          </button>
        )}
        <button onClick={syncNow} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-bbb-border px-4 py-2 text-xs font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50">
          <RefreshCw className="h-3.5 w-3.5" /> Sync who has applied
        </button>
        {qualifiedCount > 0 && (
          <button onClick={() => act(sendAllInterviewInvites)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> Invite all {qualifiedCount} to interview
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", "new", "invited_to_apply", "applied", "qualified", "invited_to_interview", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${filter === s ? "bg-bbb-strong text-white" : "bg-white text-bbb-slate border border-bbb-border"}`}>
            {s === "all" ? "All" : STATUS_LABEL[s]} {counts[s] ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No recruits here yet.</div>}
        {shown.map((r) => (
          <div key={r.id} className="rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{r.full_name}</p>
                  {r.tier && <span className="rounded bg-bbb-bg px-1.5 py-0.5 text-[10px] font-bold text-bbb-slate">Tier {r.tier}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status] || "bg-bbb-bg"}`}>{STATUS_LABEL[r.status] || r.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-bbb-slate">{[r.email, r.phone, r.state && `${r.city || ""}${r.city ? ", " : ""}${r.state}`].filter(Boolean).join(" · ")}</p>
                {r.coverage && <p className="mt-0.5 text-xs text-bbb-slate">Covers: {r.coverage}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.status === "new" && (
                  <button onClick={() => act(() => sendApplyInvite(r.id))} disabled={pending}
                    className="inline-flex items-center gap-1 rounded-lg bg-bbb-strong px-2.5 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50"><FileText className="h-3.5 w-3.5" /> Invite to apply</button>
                )}
                {r.status === "invited_to_apply" && (
                  <button onClick={() => act(() => sendApplyInvite(r.id))} disabled={pending}
                    className="rounded-lg border border-bbb-border px-2.5 py-1.5 text-xs font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50">Resend apply invite</button>
                )}
                {r.status === "applied" && (
                  <>
                    <button onClick={() => act(() => setRecruitStatus(r.id, "qualified"))} disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Qualifies for interview</button>
                    <button onClick={() => act(() => setRecruitStatus(r.id, "rejected"))} disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button>
                  </>
                )}
                {r.status === "qualified" && (
                  <>
                    <button onClick={() => act(() => sendInterviewInvite(r.id))} disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg bg-bbb-strong px-2.5 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50"><CalendarClock className="h-3.5 w-3.5" /> Send interview invite</button>
                    <button onClick={() => act(() => setRecruitStatus(r.id, "applied"))} disabled={pending}
                      className="rounded-lg border border-bbb-border px-2.5 py-1.5 text-xs font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50">Undo qualify</button>
                  </>
                )}
                {r.status === "invited_to_interview" && (
                  <button disabled className="rounded-lg bg-bbb-bg px-2.5 py-1.5 text-xs font-bold text-bbb-slate">Interview invited ✓</button>
                )}
                {(r.status === "new" || r.status === "invited_to_apply") && (
                  <button onClick={() => act(() => setRecruitStatus(r.id, "applied"))} disabled={pending}
                    className="rounded-lg border border-bbb-border px-2.5 py-1.5 text-xs font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50">Mark applied</button>
                )}
                <button onClick={() => act(() => deleteRecruit(r.id))} disabled={pending}
                  className="grid h-7 w-7 place-items-center rounded-lg text-bbb-slate hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label="Delete recruit"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
