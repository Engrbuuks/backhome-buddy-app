"use client";
import React, { useState, useTransition } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { saveRequestMilestones } from "@/lib/requests/milestone-actions";

type M = { id?: string; title: string; hint?: string | null; done?: boolean; note?: string | null; proof?: any };

/** Admin edits the milestone list for THIS task (tweaked from the template) and
 *  sees which are complete vs missing. */
export default function AdminMilestones({ requestId, initial }: { requestId: string; initial: M[] }) {
  const [rows, setRows] = useState<M[]>(initial.length ? initial : [{ title: "", hint: "" }]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const doneCount = rows.filter((r) => r.done).length;
  const total = initial.length;

  const set = (i: number, k: "title" | "hint", v: string) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const add = () => setRows((r) => [...r, { title: "", hint: "" }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = () => start(async () => {
    setErr(""); setMsg("");
    const res = await saveRequestMilestones(requestId, rows.map((r) => ({ id: r.id, title: r.title, hint: r.hint || "" })));
    if (res.error) { setErr(res.error); return; }
    setMsg("Milestones saved.");
  });

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-base font-extrabold">Task milestones</p>
        {total > 0 && <span className={`text-xs font-bold ${doneCount === total ? "text-green-600" : "text-amber-600"}`}>{doneCount}/{total} completed</span>}
      </div>
      <p className="mb-3 text-xs text-bbb-slate">These guide the buddy's proof — each needs a photo/video + note. Edit for this task; the buddy sees the list live.</p>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className={`rounded-xl border p-3 ${r.done ? "border-green-200 bg-green-50" : "border-bbb-border"}`}>
            <div className="flex items-center gap-2">
              {r.id ? (r.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-bbb-slate" />) : <Circle className="h-4 w-4 text-bbb-slate" />}
              <input value={r.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Milestone title (e.g. Front of property)" className="h-9 flex-1 rounded-lg border border-bbb-border px-2 text-sm outline-none focus:border-bbb-strong" />
              <button onClick={() => remove(i)} className="text-bbb-slate hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <input value={r.hint || ""} onChange={(e) => set(i, "hint", e.target.value)} placeholder="Hint — what to capture" className="mt-2 h-8 w-full rounded-lg border border-bbb-border px-2 text-xs outline-none focus:border-bbb-strong" />
            {r.done && r.note && <p className="mt-1 text-xs text-green-700">Buddy note: {r.note}</p>}
            {r.done && (r as any).proof?.signedUrl && (
              <a href={(r as any).proof.signedUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                {(r as any).proof.kind === "video" ? (
                  <video src={(r as any).proof.signedUrl} className="h-32 w-full rounded-lg object-cover" preload="metadata" />
                ) : (
                  <img src={(r as any).proof.signedUrl} alt={`Proof for ${r.title}`} className="h-32 w-full rounded-lg object-cover" />
                )}
                <span className="mt-1 block text-[11px] font-semibold text-bbb-strong">Open full size →</span>
              </a>
            )}
            {r.done && !(r as any).proof?.signedUrl && (
              <p className="mt-1 text-[11px] text-amber-600">Marked done, but no image is attached.</p>
            )}
          </div>
        ))}
      </div>

      <button onClick={add} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-bbb-strong hover:text-bbb-dark"><Plus className="h-4 w-4" /> Add milestone</button>

      <div className="mt-4 flex items-center gap-3">
        <button disabled={pending} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-5 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save milestones
        </button>
        {msg && <span className="text-sm font-semibold text-green-700">{msg}</span>}
        {err && <span className="text-sm font-semibold text-red-600">{err}</span>}
      </div>
    </div>
  );
}
