"use client";
import React from "react";

export function ProofMedia({ proofs }: { proofs: any[] }) {
  const media = (proofs ?? []).filter((p) => p.signedUrl);
  if (media.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {media.map((p) => (
        <a key={p.id} href={p.signedUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-bbb-border bg-bbb-bg">
          {p.kind === "video" ? (
            <video src={p.signedUrl} controls className="h-36 w-full object-cover" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={p.signedUrl} alt="Proof" className="h-36 w-full object-cover" />
          )}
        </a>
      ))}
    </div>
  );
}
