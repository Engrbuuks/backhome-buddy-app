"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteRequest } from "@/lib/admin/proof-actions";

export function DeleteTaskPanel({ requestId, title }: { requestId: string; title: string }) {
  const router = useRouter();
  return (
    <div className="rounded-3xl border border-red-200 bg-white p-5 shadow-soft">
      <p className="font-display text-base font-extrabold text-red-700">Danger zone</p>
      <p className="mt-1 mb-3 text-xs text-bbb-slate">Permanently delete this task and everything attached to it — proof, messages, payments, ledger links. This cannot be undone.</p>
      <DeleteButton
        label="Delete this task"
        confirmText={`Delete "${title}" permanently?`}
        requireTyping
        size="md"
        action={() => deleteRequest(requestId)}
        onDone={() => router.push("/admin/requests")}
      />
    </div>
  );
}
