"use client";
import React from "react";

const styles: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 ring-gray-200",
  Submitted: "bg-blue-50 text-blue-700 ring-blue-100",
  Quoted: "bg-amber-50 text-amber-700 ring-amber-100",
  "Awaiting Payment": "bg-amber-50 text-amber-700 ring-amber-100",
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Assigned: "bg-purple-50 text-purple-700 ring-purple-100",
  "In Progress": "bg-blue-50 text-blue-700 ring-blue-100",
  "Proof Ready": "bg-teal-50 text-teal-700 ring-teal-100",
  "Proof Approved": "bg-teal-50 text-teal-700 ring-teal-100",
  Completed: "bg-green-50 text-green-700 ring-green-100",
  "Paid Out": "bg-green-50 text-green-700 ring-green-100",
  Cancelled: "bg-gray-100 text-gray-700 ring-gray-200",
  Refunded: "bg-slate-100 text-slate-700 ring-slate-200",
  Disputed: "bg-red-50 text-red-700 ring-red-100",
  Pending: "bg-amber-50 text-amber-700 ring-amber-100",
  Succeeded: "bg-green-50 text-green-700 ring-green-100",
  Failed: "bg-red-50 text-red-700 ring-red-100",
  Held: "bg-blue-50 text-blue-700 ring-blue-100",
  Released: "bg-green-50 text-green-700 ring-green-100",
  Processing: "bg-blue-50 text-blue-700 ring-blue-100",
  Approved: "bg-green-50 text-green-700 ring-green-100",
  Rejected: "bg-red-50 text-red-700 ring-red-100",
  "Under Review": "bg-amber-50 text-amber-700 ring-amber-100",
  "Changes Requested": "bg-amber-50 text-amber-700 ring-amber-100",
  Active: "bg-green-50 text-green-700 ring-green-100",
  Inactive: "bg-gray-100 text-gray-700 ring-gray-200",
};

/** Maps a snake_case DB status to a human display label. */
export function statusLabel(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusPill({ status = "Pending", className = "" }: { status?: string; className?: string }) {
  const label = status.includes("_") ? statusLabel(status) : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[label] || styles.Pending} ${className}`}>
      {label}
    </span>
  );
}
