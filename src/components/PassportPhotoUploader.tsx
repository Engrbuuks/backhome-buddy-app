"use client";
import React, { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { recordVettingDoc } from "@/lib/buddy/vetting-actions";

/** Compact passport-photo uploader. Uploads directly to R2 via presigned URL,
 *  then records the path (kind = passport_photo). Used on the dashboard and the
 *  profile page so the "+ add photo" affordance actually triggers an upload. */
export function PassportPhotoUploader({ buddyId, currentUrl, onDone, compact }: { buddyId: string; currentUrl?: string; onDone?: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function compress(file: File): Promise<Blob> {
    if (!file.type.startsWith("image/")) return file;
    try {
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const max = 1000;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      return blob ?? file;
    } catch { return file; }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const payload = await compress(file);
      const { uploadToR2 } = await import("@/lib/storage/upload-client");
      const { key } = await uploadToR2("vetting", payload, { ext: "jpg", contentType: "image/jpeg" });
      const fd = new FormData();
      fd.set("kind", "passport_photo");
      fd.set("path", key);
      const res = await recordVettingDoc(null, fd);
      if ((res as any)?.error) { setErr((res as any).error); setBusy(false); return; }
      setDone(true); setBusy(false);
      onDone?.();
    } catch (e: any) {
      setErr(e?.message || "Upload failed."); setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-bbb-border bg-white p-4"}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} disabled={busy} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={compact
          ? "inline-flex items-center gap-1 text-xs font-bold text-bbb-strong hover:text-bbb-dark disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"}
      >
        <Camera className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {busy ? "Uploading…" : done ? "Photo updated ✓" : currentUrl ? "Change photo" : "Add passport photo"}
      </button>
      {err && <p className="mt-1 text-xs font-semibold text-red-600">{err}</p>}
    </div>
  );
}
