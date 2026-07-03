"use client";
import React from "react";
import { MapPin, ShieldCheck, Clock, AlertTriangle } from "lucide-react";

function fmt(ts?: string) {
  if (!ts) return null;
  try { return new Date(ts).toLocaleString(); } catch { return null; }
}

export function ProofMedia({ proofs }: { proofs: any[] }) {
  const media = (proofs ?? []).filter((p) => p.signedUrl);
  if (media.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {media.map((p) => {
        const live = p.capture_method === "live";
        const hasGeo = typeof p.captured_lat === "number" && typeof p.captured_lng === "number";
        const when = fmt(p.captured_at) || fmt(p.server_received_at);
        return (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-bbb-border bg-bbb-bg">
            <a href={p.signedUrl} target="_blank" rel="noreferrer" className="block">
              {p.kind === "video" ? (
                <video src={p.signedUrl} controls className="h-36 w-full object-cover" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.signedUrl} alt="Proof" className="h-36 w-full object-cover" />
              )}
            </a>
            <div className="space-y-1 p-2 text-[11px] leading-4">
              {live ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-bold text-green-700"><ShieldCheck className="h-3 w-3" /> Live capture</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700"><AlertTriangle className="h-3 w-3" /> Uploaded file</span>
              )}
              {when && <p className="flex items-center gap-1 text-bbb-slate"><Clock className="h-3 w-3" /> {when}</p>}
              {hasGeo ? (
                <a href={`https://www.google.com/maps?q=${p.captured_lat},${p.captured_lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-bbb-strong hover:underline">
                  <MapPin className="h-3 w-3" /> View location{p.captured_accuracy ? ` (±${Math.round(p.captured_accuracy)}m)` : ""}
                </a>
              ) : live ? (
                <p className="text-amber-600">No location captured</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
