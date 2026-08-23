"use client";
import React, { useState, useTransition } from "react";
import { Star, Loader2, Camera, Upload } from "lucide-react";
import { DIASPORA_LOCATIONS } from "@/lib/testimonials/locations";
import { submitTestimonial } from "@/lib/testimonials/actions";
import { uploadToR2 } from "@/lib/storage/upload-client";

export default function TestimonialForm({ token, inviteeName }: { token: string; inviteeName: string }) {
  const [name, setName] = useState(inviteeName || "");
  const [location, setLocation] = useState("GB");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);

  const submit = () => start(async () => {
    setErr("");
    if (!name.trim()) { setErr("Please enter your name."); return; }
    if (body.trim().length < 10) { setErr("Please write a little more."); return; }
    try {
      let media_url: string | undefined; let media_kind: "photo" | "video" | undefined;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        media_kind = file.type.startsWith("video") ? "video" : "photo";
        const { key } = await uploadToR2("proofs", file, { ext, contentType: file.type || "application/octet-stream", scope: `testimonial-${token}` });
        media_url = key;
      }
      const res = await submitTestimonial({ token, author_name: name.trim(), location_code: location, rating, body: body.trim(), media_url, media_kind });
      if (res.error) { setErr(res.error); return; }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    }
  });

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-display text-lg font-extrabold text-green-800">Thank you! 🎉</p>
        <p className="mt-1 text-sm text-green-700">Your testimonial has been received and will appear on our site once reviewed.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-bbb-border bg-white p-6 shadow-soft">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-bbb-slate">Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong" />
        </div>

        <div>
          <label className="text-xs font-bold text-bbb-slate">Where are you based?</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-bbb-border px-3 text-sm outline-none focus:border-bbb-strong">
            {DIASPORA_LOCATIONS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-bbb-slate">Your rating</label>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}>
                <Star className={`h-8 w-8 ${(hover || rating) >= n ? "fill-yellow-400 text-yellow-400" : "text-bbb-border"}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-bbb-slate">Your experience</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Tell us how Backhome Buddy helped you…" className="mt-1 w-full rounded-xl border border-bbb-border p-3 text-sm outline-none focus:border-bbb-strong" />
        </div>

        <div>
          <label className="text-xs font-bold text-bbb-slate">Add a photo or video (optional)</label>
          <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-bbb-strong px-3 py-2 text-xs font-bold text-white hover:bg-bbb-dark"><Camera className="h-3.5 w-3.5" /> Take photo/video</button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-bbb-border px-3 py-2 text-xs font-bold text-bbb-slate hover:border-bbb-strong"><Upload className="h-3.5 w-3.5" /> Choose from device</button>
          </div>
          {file && <p className="mt-1 text-xs font-semibold text-green-700">Attached: {file.name}</p>}
        </div>

        {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
        <button disabled={pending} onClick={submit} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {pending ? "Submitting…" : "Submit testimonial"}
        </button>
      </div>
    </div>
  );
}
