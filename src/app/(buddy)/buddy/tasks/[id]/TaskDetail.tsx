"use client";
import React, { useState, useTransition, useRef } from "react";
import { useFormState } from "react-dom";
import { StatusPill } from "@/components/StatusPill";
import { ErrorState } from "@/components/StateBlocks";
import { formatNGN } from "@/components/money";
import { startTask, submitProof } from "@/lib/buddy/task-actions";
import { ProofMedia } from "@/components/ProofMedia";

export default function TaskDetail({ task }: { task: any }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [state, formAction] = useFormState(submitProof, { error: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<{ path: string; kind: string; lat?: number; lng?: number; accuracy?: number; capturedAt?: string; method?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [liveMode, setLiveMode] = useState(true);
  const [geoStatus, setGeoStatus] = useState<string>("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const onFilesPicked = (list: FileList | null, live: boolean) => {
    setLiveMode(live);
    setFiles(Array.from(list ?? []));
  };

  /** Get the device's current location at capture time. Resolves with null if
   *  the buddy denies permission or it's unavailable — capture still proceeds,
   *  just without geo (and is marked as such). */
  function getLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

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
    setUploading(true); setUploadError(""); setGeoStatus("");
    // Capture location once at submit time (all files captured in this session).
    let geo: { lat: number; lng: number; accuracy: number } | null = null;
    if (liveMode) {
      setGeoStatus("Getting your location…");
      geo = await getLocation();
      setGeoStatus(geo ? `Location captured (±${Math.round(geo.accuracy)}m)` : "Location unavailable — proof will be marked without location.");
    }
    const capturedAt = new Date().toISOString();
    const { uploadToR2 } = await import("@/lib/storage/upload-client");
    const done = [...uploaded];
    for (const f of files) {
      const kind = f.type.startsWith("video") ? "video" : "photo";
      const payload = kind === "photo" ? await compressImage(f) : f;
      const ext = kind === "photo" ? "jpg" : (f.name.split(".").pop() || "mp4");
      const contentType = kind === "photo" ? "image/jpeg" : (f.type || "video/mp4");
      try {
        const { key } = await uploadToR2("proofs", payload, { ext, contentType, scope: task.id });
        done.push({
          path: key, kind,
          lat: geo?.lat, lng: geo?.lng, accuracy: geo?.accuracy,
          capturedAt,
          method: liveMode ? "live" : "upload",
        });
      } catch (err: any) {
        setUploadError(`${f.name}: ${err?.message || "upload failed"}`); setUploading(false); return;
      }
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
            <div className="mt-2 flex items-center gap-2 text-xs">
              <button type="button" onClick={() => cameraRef.current?.click()} className="rounded-lg bg-bbb-strong px-3 py-2 font-bold text-white hover:bg-bbb-dark">📷 Take live photo</button>
              <button type="button" onClick={() => galleryRef.current?.click()} className="rounded-lg border border-bbb-border px-3 py-2 font-bold text-bbb-slate hover:border-bbb-strong">Upload existing</button>
            </div>
            {liveMode
              ? <p className="mt-2 text-xs text-bbb-slate">Take the photo/video now, on location. We record the time and place to verify it's genuine. Please allow location access when asked.</p>
              : <p className="mt-2 text-xs text-amber-600">Uploaded files can't be location-verified. Live capture is preferred for trusted proof.</p>}
            {/* Camera input: single file + capture opens the rear camera on mobile. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={(e) => onFilesPicked(e.target.files, true)}
              className="hidden"
            />
            {/* Gallery input: multiple, no capture — opens the file/photo picker. */}
            <input
              ref={galleryRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              onChange={(e) => onFilesPicked(e.target.files, false)}
              className="hidden"
            />
            {files.length > 0 && <p className="mt-2 text-xs font-semibold text-bbb-charcoal">{files.length} file{files.length > 1 ? "s" : ""} ready {liveMode ? "(live capture)" : "(upload)"}</p>}
            {geoStatus && <p className="mt-1 text-xs font-semibold text-bbb-strong">{geoStatus}</p>}
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
