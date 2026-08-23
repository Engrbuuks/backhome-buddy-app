"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteClient } from "@/lib/admin/proof-actions";

export default function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const run = () => start(async () => {
    setErr("");
    const res = await deleteClient(clientId);
    if (res.error) { setErr(res.error); return; }
    router.push("/admin/clients");
  });

  return (
    <div className="mt-4 border-t border-bbb-border pt-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-red-600">Danger zone</p>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:border-red-300">
          <Trash2 className="h-4 w-4" /> Delete this client
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-red-700">This permanently deletes <strong>{name || "this client"}</strong> and all their requests, proof and messages. This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button disabled={pending} onClick={run} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Yes, delete permanently
            </button>
            <button onClick={() => setConfirm(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-bbb-slate">Cancel</button>
          </div>
          {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
