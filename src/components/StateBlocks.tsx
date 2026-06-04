"use client";
import React from "react";
import { AlertTriangle, FileX2, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading data..." }: { label?: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-bbb-border bg-white p-8 text-center shadow-soft">
      <Loader2 className="h-8 w-8 animate-spin text-bbb-strong" />
      <p className="mt-4 text-sm font-semibold text-bbb-slate">{label}</p>
    </div>
  );
}
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl border border-bbb-border bg-white p-4">
          <div className="h-3 w-1/3 rounded-full bg-gray-100" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({ title = "Nothing here yet", description = "When there is activity, it will appear here.", actionLabel, onAction }: { title?: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center">
      <FileX2 className="h-10 w-10 text-bbb-slate" />
      <h3 className="mt-4 font-display text-lg font-bold text-bbb-charcoal">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-bbb-slate">{description}</p>
      {actionLabel && <button onClick={onAction} className="mt-5 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark">{actionLabel}</button>}
    </div>
  );
}
export function ErrorState({ title = "Something went wrong", message = "Please try again." }: { title?: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <AlertTriangle className="h-7 w-7 text-red-600" />
      <h3 className="mt-3 font-display text-base font-bold text-red-700">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-red-600">{message}</p>
    </div>
  );
}
