"use client";
import React, { useState, useTransition } from "react";
import { MapPin, ShieldCheck, Clock, AlertTriangle, Trash2, Play } from "lucide-react";
import { deleteProof } from "@/lib/admin/proof-actions";

function fmt(ts?: string) {
  if (!ts) return null;
  try { return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return null; }
}

export function ProofMedia({ proofs, canDelete = false }: { proofs: any[]; canDelete?: boolean }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Only show media that actually loaded. Broken/deleted files are hidden
  // entirely so nothing lingers on the dashboard.
  const media = (proofs ?? []).filter((p) => p.signedUrl && !removed.includes(p.id));
  if (media.length === 0) return null;

  const remove = (id: string) => start(async () => {
    const res = await deleteProof(id);
    if (!res.error) setRemoved((r) => [...r, id]);
    setConfirming(null);
  });

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {media.map((p) => {
        const live = p.capture_method === "live";
        const hasGeo = typeof p.captured_lat === "number" && typeof p.captured_lng === "number";
        const when = fmt(p.captured_at) || fmt(p.server_received_at);
        return (
          <figure key={p.id} className="group overflow-hidden rounded-2xl border border-bbb-border bg-white shadow-soft">
            {/* Media */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-bbb-bg">
              <a href={p.signedUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
                {p.kind === "video" ? (
                  <div className="relative h-full w-full">
                    <video src={p.signedUrl} className="h-full w-full object-cover" preload="metadata" />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white"><Play className="h-5 w-5" /></span>
                    </span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.signedUrl} alt="Proof" onError={() => setRemoved((r) => r.includes(p.id) ? r : [...r, p.id])} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                )}
              </a>
              {/* Verification chip, top-left over the image */}
              <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold backdrop-blur ${live ? "bg-green-600/90 text-white" : "bg-amber-500/90 text-white"}`}>
                {live ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {live ? "Verified live" : "Uploaded"}
              </span>
              {canDelete && (
                confirming === p.id ? (
                  <span className="absolute right-2 top-2 flex items-center gap-1">
                    <button onClick={() => remove(p.id)} disabled={pending} className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50">{pending ? "…" : "Delete"}</button>
                    <button onClick={() => setConfirming(null)} className="rounded-lg bg-white/90 px-2 py-1 text-[11px] font-bold text-bbb-charcoal">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirming(p.id)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/45 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600" aria-label="Delete proof">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
            {/* Meta */}
            <figcaption className="space-y-1.5 p-3 text-xs">
              {when && <p className="flex items-center gap-1.5 text-bbb-slate"><Clock className="h-3.5 w-3.5 shrink-0" /> {when}</p>}
              {hasGeo ? (
                <a href={`https://www.google.com/maps?q=${p.captured_lat},${p.captured_lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-bbb-strong hover:underline">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> View location{p.captured_accuracy ? ` (±${Math.round(p.captured_accuracy)}m)` : ""}
                </a>
              ) : live ? (
                <p className="inline-flex items-center gap-1.5 text-amber-600"><MapPin className="h-3.5 w-3.5 shrink-0" /> No location captured</p>
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
