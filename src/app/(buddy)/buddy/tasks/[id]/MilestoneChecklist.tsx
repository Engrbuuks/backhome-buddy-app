"use client";
import React, { useState, useTransition } from "react";
import { CheckCircle2, Circle, Upload, Loader2 } from "lucide-react";
import { uploadToR2 } from "@/lib/storage/upload-client";
import { completeMilestone } from "@/lib/requests/milestone-actions";

type M = { id: string; title: string; hint?: string | null; done: boolean; note?: string | null };

/** Structured proof: each milestone needs a photo/video + a note before it's
 *  marked done. Partial is allowed — the buddy completes what they can. */
export default function MilestoneChecklist({ requestId, milestones }: { requestId: string; milestones: M[] }) {
  if (!milestones?.length) return null;
  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-base font-extrabold">Task milestones</p>
        <span className="text-xs font-bold text-bbb-slate">{doneCount}/{milestones.length} done</span>
      </div>
      <p className="mb-4 text-xs text-bbb-slate">Capture a photo or video and a short note for each step. You can submit what you have — anything missing is flagged for the team.</p>
      <div className="space-y-3">
        {milestones.map((m) => <MilestoneRow key={m.id} requestId={requestId} m={m} />)}
      </div>
    </div>
  );
}

function MilestoneRow({ requestId, m }: { requestId: string; m: M }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [done, setDone] = useState(m.done);

  const submit = () => start(async () => {
    setErr("");
    if (!note.trim()) { setErr("Add a short note."); return; }
    if (!file) { setErr("Attach a photo or video."); return; }
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const kind = file.type.startsWith("video") ? "video" : "photo";
      const { key } = await uploadToR2("proofs", file, { ext, contentType: file.type || "application/octet-stream", scope: requestId });
      const res = await completeMilestone(requestId, m.id, { note: note.trim(), filePath: key, kind });
      if (res.error) { setErr(res.error); return; }
      setDone(true); setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    }
  });

  return (
    <div className={`rounded-2xl border p-4 ${done ? "border-green-200 bg-green-50" : "border-bbb-border bg-bbb-bg"}`}>
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-bbb-slate" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-bbb-charcoal">{m.title}</p>
          {m.hint && <p className="mt-0.5 text-xs text-bbb-slate">{m.hint}</p>}
          {done && m.note && <p className="mt-1 text-xs text-green-700">Your note: {m.note}</p>}
          {!done && !open && (
            <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark">
              <Upload className="h-3.5 w-3.5" /> Add photo/video + note
            </button>
          )}
          {open && !done && (
            <div className="mt-3 space-y-2">
              <input type="file" accept="image/*,video/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-bbb-strong file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Short note about this step…"
                className="w-full rounded-lg border border-bbb-border p-2 text-sm outline-none focus:border-bbb-strong" />
              {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button disabled={pending} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-bbb-strong px-3 py-1.5 text-xs font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {pending ? "Saving…" : "Mark done"}
                </button>
                <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-bbb-slate">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
