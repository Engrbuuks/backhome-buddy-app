"use client";
import React, { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { exportBackup } from "@/lib/admin/backup-actions";

export default function BackupPanel() {
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      setError(""); setDone("");
      const r = await exportBackup();
      if (r.error || !r.data) { setError(r.error || "Export failed."); return; }
      const blob = new Blob([r.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      a.href = url; a.download = `backhomebuddy-backup-${stamp}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setDone(`Backup downloaded (${(r.data.length / 1024).toFixed(0)} KB). Store it somewhere safe — cloud drive AND a second location.`);
    });
  }

  return (
    <AdminShell title="Backup">
      <PageHeader eyebrow="Safety" title="Export backup" description="Downloads a JSON snapshot of every critical table — requests, money records, ledger, users, settings. On the free Supabase tier this IS your backup: run it at least weekly and before every payout batch." />
      {error && <div className="mb-4"><ErrorState title="Export failed" message={error} /></div>}
      {done && <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{done}</div>}
      <div className="rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <p className="text-sm text-bbb-slate">Includes: profiles, buddies, services, regions, requests, quotes, proofs metadata, payments, payouts, refunds, the full transactions ledger, disputes, timeline, audit log and settings. <strong>Proof photo/video files are not included</strong> — they live in Storage; the metadata here references them.</p>
        <button disabled={pending} onClick={run} className="mt-5 flex h-12 items-center gap-2 rounded-xl bg-bbb-strong px-6 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          <Download className="h-4 w-4" />{pending ? "Exporting..." : "Download backup now"}
        </button>
      </div>
    </AdminShell>
  );
}
