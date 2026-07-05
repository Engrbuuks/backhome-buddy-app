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
  const [geoDiag, setGeoDiag] = useState<string>("");

  // Standalone location test — reports exactly what the browser does, so a
  // blocked/timeout/unsupported state is visible rather than guessed.
  const testLocation = async () => {
    setGeoDiag("Testing…");
    const parts: string[] = [];
    parts.push(`secure(HTTPS): ${typeof window !== "undefined" && window.isSecureContext ? "yes" : "NO"}`);
    parts.push(`geolocation API: ${"geolocation" in navigator ? "present" : "MISSING"}`);
    try {
      const st = await (navigator as any).permissions?.query?.({ name: "geolocation" });
      parts.push(`permission: ${st?.state ?? "unknown"}`);
    } catch { parts.push("permission: query-unsupported"); }
    await new Promise<void>((resolve) => {
      if (!("geolocation" in navigator)) { parts.push("result: no API"); resolve(); return; }
      const t0 = Date.now();
      navigator.geolocation.getCurrentPosition(
        (pos) => { parts.push(`result: OK ±${Math.round(pos.coords.accuracy)}m in ${Date.now() - t0}ms`); resolve(); },
        (err) => { parts.push(`result: ERROR code ${err.code} (${err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "timeout"}) — ${err.message}`); resolve(); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
    setGeoDiag(parts.join(" | "));
  };
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const prefetchedGeoRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locBlocked, setLocBlocked] = useState(false);
  const onFilesPicked = (list: FileList | null, live: boolean) => {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    setLiveMode(live);
    setFiles(picked);
    // Auto-upload right away so nothing is lost if the buddy forgets to tap Upload.
    void uploadFiles(picked, live);
  };

  // Tapping "Take live photo" grabs location FIRST (on the clean tap gesture, so
  // the permission prompt reliably appears), then opens the camera.
  const startLiveCapture = async () => {
    setLocBlocked(false);
    setGeoStatus("Getting your location…");
    const geo = await getLocation();
    prefetchedGeoRef.current = geo;
    if (geo) {
      setGeoStatus(`Location ready (±${Math.round(geo.accuracy)}m) — opening camera…`);
      cameraRef.current?.click();
    } else {
      // Couldn't get location. If it's blocked, show guidance and let them
      // choose to continue without location or fix the setting.
      let blocked = false;
      try {
        const status = await (navigator as any).permissions?.query?.({ name: "geolocation" });
        blocked = status?.state === "denied";
      } catch {}
      if (blocked) { setLocBlocked(true); return; } // show the help panel, don't open camera yet
      // Not explicitly blocked (timeout/unavailable) — let them proceed anyway.
      cameraRef.current?.click();
    }
  };

  const captureWithoutLocation = () => { setLocBlocked(false); prefetchedGeoRef.current = null; cameraRef.current?.click(); };

  // Same location-first flow, but opens the video recorder.
  const startLiveVideo = async () => {
    setLocBlocked(false);
    setGeoStatus("Getting your location…");
    const geo = await getLocation();
    prefetchedGeoRef.current = geo;
    if (geo) setGeoStatus(`Location ready (±${Math.round(geo.accuracy)}m) — opening camera…`);
    videoRef.current?.click();
  };

  /** Get the device's current location at capture time. Resolves with null if
   *  the buddy denies permission or it's unavailable — capture still proceeds,
   *  just without geo (and is marked as such). */
  function getLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        setGeoStatus("This device/browser doesn't support location.");
        resolve(null); return;
      }
      const onOk = (pos: GeolocationPosition) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      const onErr = (err: GeolocationPositionError) => {
        // 1 = permission denied, 2 = position unavailable, 3 = timeout
        if (err.code === 1) setGeoStatus("⚠ Location permission was blocked. Enable location for this site in your browser settings, then retake the photo.");
        else if (err.code === 3) setGeoStatus("⚠ Getting GPS took too long. Make sure location is ON, step outside if indoors, and retake the photo.");
        else setGeoStatus("⚠ Couldn't get your location. Make sure location is ON and retake the photo.");
        resolve(null);
      };
      // First try a quick high-accuracy fix; if it times out, fall back to a
      // longer, lower-accuracy attempt (indoors GPS can be slow).
      navigator.geolocation.getCurrentPosition(
        onOk,
        () => navigator.geolocation.getCurrentPosition(onOk, onErr, { enableHighAccuracy: false, timeout: 25000, maximumAge: 60000 }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  /** Compress images in the browser (~max 1600px, JPEG q0.72) AND burn a
   *  verification stamp onto the photo: date/time, GPS coordinates, and brand.
   *  This makes the proof self-evidently timestamped and location-tagged even if
   *  the file is later downloaded or forwarded. */
  async function compressImage(file: File, stamp?: { at: string; lat?: number; lng?: number; accuracy?: number }): Promise<Blob> {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

      if (stamp) {
        const W = canvas.width, H = canvas.height;
        const pad = Math.round(W * 0.025);
        const fs = Math.max(14, Math.round(W * 0.028)); // font size scales with image
        const lineH = Math.round(fs * 1.35);
        const when = new Date(stamp.at);
        const dateStr = when.toLocaleString();
        const geoStr = (typeof stamp.lat === "number" && typeof stamp.lng === "number")
          ? `${stamp.lat.toFixed(5)}, ${stamp.lng.toFixed(5)}${stamp.accuracy ? ` (±${Math.round(stamp.accuracy)}m)` : ""}`
          : "Location not captured";
        const lines = [
          "🛡 Backhome Buddy — Verified capture",
          `🕒 ${dateStr}`,
          `📍 ${geoStr}`,
        ];
        // Semi-transparent banner across the bottom
        const bannerH = lineH * lines.length + pad * 1.4;
        ctx.fillStyle = "rgba(15,15,15,0.62)";
        ctx.fillRect(0, H - bannerH, W, bannerH);
        // Green accent bar
        ctx.fillStyle = "#079516";
        ctx.fillRect(0, H - bannerH, Math.round(W * 0.012), bannerH);
        // Text
        ctx.textBaseline = "top";
        ctx.font = `600 ${fs}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        let y = H - bannerH + pad * 0.7;
        for (const ln of lines) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillText(ln, pad + 2, y + 1); // shadow for legibility
          ctx.fillStyle = "#ffffff";
          ctx.fillText(ln, pad, y);
          y += lineH;
        }
      }

      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.72));
      return blob && blob.size < file.size ? blob : file;
    } catch { return file; }
  }

  async function uploadFiles(toUpload: File[], live: boolean) {
    if (toUpload.length === 0) return;
    setUploading(true); setUploadError(""); setGeoStatus("");
    let geo: { lat: number; lng: number; accuracy: number } | null = null;
    if (live) {
      // Prefer the location grabbed when they tapped the camera button.
      geo = prefetchedGeoRef.current;
      if (!geo) {
        setGeoStatus("Getting your location…");
        geo = await getLocation();
      }
      setGeoStatus(geo ? `Location captured (±${Math.round(geo.accuracy)}m)` : (geoStatus || "Location unavailable — proof will be marked without location."));
      prefetchedGeoRef.current = null;
    }
    const capturedAt = new Date().toISOString();
    const { uploadToR2 } = await import("@/lib/storage/upload-client");
    const done = [...uploaded];
    for (const f of toUpload) {
      const kind = f.type.startsWith("video") ? "video" : "photo";
      const stamp = live ? { at: capturedAt, lat: geo?.lat, lng: geo?.lng, accuracy: geo?.accuracy } : undefined;
      const payload = kind === "photo" ? await compressImage(f, stamp) : f;
      const ext = kind === "photo" ? "jpg" : (f.name.split(".").pop() || "mp4");
      const contentType = kind === "photo" ? "image/jpeg" : (f.type || "video/mp4");
      try {
        const { key } = await uploadToR2("proofs", payload, { ext, contentType, scope: task.id });
        done.push({
          path: key, kind,
          lat: geo?.lat, lng: geo?.lng, accuracy: geo?.accuracy,
          capturedAt,
          method: live ? "live" : "upload",
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
        <>
          {/* File inputs live OUTSIDE the form so the camera capture attribute
              and the server-action form don't interfere with each other. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onFilesPicked(e.target.files, true)}
            className="hidden"
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={(e) => onFilesPicked(e.target.files, true)}
            className="hidden"
          />
          <input
            ref={galleryRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            onChange={(e) => onFilesPicked(e.target.files, false)}
            className="hidden"
          />
        <form action={formAction} className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
          <h2 className="font-display text-lg font-extrabold">Submit proof</h2>
          <p className="mt-1 text-xs text-bbb-slate">Write your report: what you did, what you found. Attach as many photos and videos as you need below.</p>
          {state?.error && <div className="mt-3"><ErrorState title="Could not submit" message={state.error} /></div>}
          <input type="hidden" name="request_id" value={task.id} />
          <input type="hidden" name="files" value={JSON.stringify(uploaded)} />
          <textarea name="note" required placeholder="Your detailed report..." className="mt-3 min-h-[140px] w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong" />
          <div className="mt-3 rounded-2xl border border-dashed border-bbb-border p-4">
            <p className="text-sm font-bold">Photos / videos</p>
            <p className="mt-0.5 text-xs text-bbb-slate">Add as many as you like — take several photos and videos, one after another.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <button type="button" onClick={startLiveCapture} className="rounded-lg bg-bbb-strong px-3 py-2 font-bold text-white hover:bg-bbb-dark">📷 {uploaded.length ? "Add another photo" : "Take live photo"}</button>
              <button type="button" onClick={startLiveVideo} className="rounded-lg bg-bbb-strong px-3 py-2 font-bold text-white hover:bg-bbb-dark">🎥 Record video</button>
              <button type="button" onClick={() => galleryRef.current?.click()} className="rounded-lg border border-bbb-border px-3 py-2 font-bold text-bbb-slate hover:border-bbb-strong">Upload existing</button>
              <button type="button" onClick={testLocation} className="rounded-lg border border-bbb-border px-3 py-2 font-bold text-bbb-slate hover:border-bbb-strong">🧭 Test my location</button>
            </div>
            {geoDiag && <p className="mt-2 break-words rounded-lg bg-bbb-bg p-2 text-[11px] font-mono text-bbb-charcoal">{geoDiag}</p>}

            {locBlocked && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-bold">📍 Location is blocked for this site</p>
                <p className="mt-1">Your proof is much stronger with location. To enable it: open your browser menu → <strong>Site settings</strong> → <strong>Location</strong> → set this site to <strong>Allow</strong>, then tap “Take live photo” again.</p>
                <button type="button" onClick={captureWithoutLocation} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white">Continue without location</button>
              </div>
            )}

            {liveMode
              ? <p className="mt-2 text-xs text-bbb-slate">Capture now, on location. We record the time and place to verify it's genuine. Please allow location access when asked.</p>
              : <p className="mt-2 text-xs text-amber-600">Uploaded files can't be location-verified. Live capture is preferred for trusted proof.</p>}
            {uploading && <p className="mt-2 text-xs font-semibold text-bbb-strong">Uploading…</p>}
            {geoStatus && <p className="mt-1 text-xs font-semibold text-bbb-strong">{geoStatus}</p>}
            {uploadError && <p className="mt-2 text-xs font-semibold text-red-600">{uploadError} — please try again.</p>}
            {uploaded.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-green-700">{uploaded.length} item{uploaded.length > 1 ? "s" : ""} attached ✓</p>
                <ul className="mt-1.5 space-y-1">
                  {uploaded.map((u, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-bbb-bg px-2.5 py-1.5 text-xs">
                      <span className="text-bbb-charcoal">{u.kind === "video" ? "🎥 Video" : "📷 Photo"} {i + 1}{u.method === "live" ? " · live" : ""}</span>
                      <button type="button" onClick={() => setUploaded((prev) => prev.filter((_, j) => j !== i))} className="font-bold text-red-600">Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button disabled={uploading} className="mt-3 h-12 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
            {uploading ? "Wait — finishing upload…" : uploaded.length === 0 ? "Submit report (no photo attached)" : "Submit proof for review"}
          </button>
        </form>
        </>
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
