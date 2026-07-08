"use client";
import React, { useState, useRef } from "react";
import { FileText, Check } from "lucide-react";
import { recordVettingDoc } from "@/lib/buddy/vetting-actions";

/** CV upload. Sends the file to the R2 vetting bucket and records it, which
 *  auto-ticks the "CV received" vetting check. Accepts PDF/DOC/DOCX. */
export function CvUploader({ currentPath, compact }: { currentPath?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(Boolean(currentPath));
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErr("File too large (max 10MB)."); return; }
    setBusy(true); setErr("");
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const { uploadToR2 } = await import("@/lib/storage/upload-client");
      const { key } = await uploadToR2("vetting", file, { ext, contentType: file.type || "application/octet-stream" });
      const fd = new FormData();
      fd.set("kind", "cv");
      fd.set("path", key);
      const res = await recordVettingDoc(null, fd);
      if ((res as any)?.error) { setErr((res as any).error); setBusy(false); return; }
      setDone(true); setBusy(false);
    } catch (e: any) {
      setErr(e?.message || "Upload failed."); setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-bbb-border bg-white p-4"}>
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={onPick} disabled={busy} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 ${done ? "border border-bbb-border text-bbb-slate hover:border-bbb-strong" : "bg-bbb-strong text-white hover:bg-bbb-dark"}`}
      >
        {done ? <Check className="h-4 w-4 text-green-600" /> : <FileText className="h-4 w-4" />}
        {busy ? "Uploading…" : done ? "CV uploaded — replace" : "Upload your CV"}
      </button>
      {err && <p className="mt-1 text-xs font-semibold text-red-600">{err}</p>}
    </div>
  );
}
