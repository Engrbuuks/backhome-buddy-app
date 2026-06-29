"use client";
import React, { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { StatusPill } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN } from "@/components/money";
import { startTask, submitProof } from "@/lib/buddy/task-actions";
import { createClient } from "@/lib/supabase/client";
import { ProofMedia } from "@/components/ProofMedia";

export default function TaskDetail({ task }: { task: any }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [state, formAction] = useFormState(submitProof, { error: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<{ path: string; kind: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  /** Compress images in the browser before upload (~max 1600px, JPEG q0.72).
   *  Turns 3-5MB phone photos into ~300-500KB — stretches free storage ~10x. */
  async function compressImage(file: File): Promise<Blob> {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.72));
      return blob && blob.size < file.size ? blob : file;
    } catch { return file; }
  }

  async function uploadSelected() {
    if (files.length === 0) return;
    setUploading(true); setUploadError("");
    const supabase = createClient();
    const done: { path: string; kind: string }[] = [...uploaded];
    for (const f of files) {
      const kind = f.type.startsWith("video") ? "video" : "photo";
      const payload = kind === "photo" ? await compressImage(f) : f;
      const safeName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").replace(/\.(png|webp|jpeg|jpg)$/i, ".jpg");
      const path = `${task.id}/${Date.now()}-${kind === "photo" ? safeName : f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("proofs").upload(path, payload, kind === "photo" ? { contentType: "image/jpeg" } : undefined);
      if (error) { setUploadError(`${f.name}: ${error.message}`); setUploading(false); return; }
      done.push({ path, kind });
    }
    setUploaded(done); setFiles([]); setUploading(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold">{task.title}</h1>
        <p className="mt-1 text-sm text-bbb-slate">{task.service_types?.name ?? "Custom"} · {task.recipient_address || "—"}</p>
        <div className="mt-2 flex items-center gap-3"><StatusPill status={task.status} />{task.buddy_payout_ngn != null && <span className="text-sm font-bold text-bbb-dark">Your payout: {formatNGN(Number(task.buddy_payout_ngn))}</span>}</div>
      </div>
      {task.description && <div className="mb-4 rounded-3xl border border-bbb-border bg-white p-5 text-sm leading-7 text-bbb-slate shadow-soft">{task.description}</div>}
      {task.expectations && (
        <div className="mb-4 rounded-3xl border border-bbb-border bg-bbb-soft p-5 shadow-soft">
          <p className="text-xs font-extrabold uppercase tracking-wide text-bbb-dark">Client&apos;s checklist — cover every item in your proof</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-bbb-charcoal">{task.expectations}</p>
        </div>
      )}
      <div className="mb-4 rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
        <p className="text-sm font-bold">Recipient</p>
        <p className="mt-1 text-sm text-bbb-slate">{task.recipient_name || "—"} · {task.recipient_phone || "—"}</p>
      </div>
      {error && <div className="mb-4"><ErrorState title="Action failed" message={error} /></div>}

      {task.status === "assigned" && (
        <button disabled={pending} onClick={() => start(async () => { setError(""); const r = await startTask(task.id); if (r?.error) setError(r.error); })} className="h-12 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">Start task</button>
      )}

      {task.status === "in_progress" && (
        <form action={formAction} className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg font-extrabold">Submit proof</h2>
          <p className="mt-1 text-xs text-bbb-slate">Write your report: what you did, what you found. Attach photos or a short video below.</p>
          {state?.error && <div className="mt-3"><ErrorState title="Could not submit" message={state.error} /></div>}
          <input type="hidden" name="request_id" value={task.id} />
          <input type="hidden" name="files" value={JSON.stringify(uploaded)} />
          <textarea name="note" required placeholder="Your detailed report..." className="mt-3 min-h-[140px] w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong" />
          <div className="mt-3 rounded-2xl border border-dashed border-bbb-border p-4">
            <p className="text-sm font-bold">Photos / videos</p>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="mt-2 block w-full text-xs text-bbb-slate" />
            {files.length > 0 && (
              <button type="button" disabled={uploading} onClick={uploadSelected} className="mt-2 rounded-xl bg-bbb-charcoal px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{uploading ? "Uploading..." : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}</button>
            )}
            {uploadError && <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p>}
            {uploaded.length > 0 && <p className="mt-2 text-xs font-semibold text-bbb-dark">{uploaded.length} file{uploaded.length > 1 ? "s" : ""} attached ✓</p>}
          </div>
          <button className="mt-3 h-12 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">Submit proof for review</button>
        </form>
      )}

      {["proof_ready", "proof_approved", "completed", "paid_out"].includes(task.status) && (
        <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg font-extrabold">Your proof</h2>
          <div className="mt-3 space-y-2">{(task.proofs ?? []).filter((p: any) => p.note).map((p: any) => <div key={p.id} className="rounded-xl bg-bbb-bg p-3 text-sm">{p.note}</div>)}</div>
          <ProofMedia proofs={task.proofs ?? []} />
          <p className="mt-3 text-xs text-bbb-slate">{task.status === "proof_ready" ? "Under review." : task.status === "proof_approved" ? "Approved — awaiting client confirmation." : "Confirmed by the client."}</p>
        </div>
      )}
    </div>
  );
}
