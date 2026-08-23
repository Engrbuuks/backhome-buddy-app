"use client";
import React, { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/** Admin delete button with a two-step confirm. For destructive actions it
 *  requires typing DELETE to proceed. Pass an async `action` returning {error}. */
export function DeleteButton({
  action, label = "Delete", confirmText, requireTyping = false, onDone, size = "sm",
}: {
  action: () => Promise<{ error: string }>;
  label?: string;
  confirmText: string;
  requireTyping?: boolean;
  onDone?: () => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const go = () => start(async () => {
    setErr("");
    const res = await action();
    if (res?.error) { setErr(res.error); return; }
    setOpen(false); setTyped(""); onDone?.();
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-red-200 font-bold text-red-600 hover:bg-red-50 ${size === "md" ? "px-4 py-2 text-sm" : "px-2.5 py-1.5 text-xs"}`}
      >
        <Trash2 className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} /> {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs">
      <p className="font-bold text-red-700">{confirmText}</p>
      <p className="mt-1 text-red-600">This is permanent and removes it from every dashboard and the database.</p>
      {requireTyping && (
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="mt-2 h-9 w-full rounded-lg border border-red-200 px-2 text-xs outline-none focus:border-red-400"
        />
      )}
      {err && <p className="mt-2 font-semibold text-red-700">{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending || (requireTyping && typed.trim().toUpperCase() !== "DELETE")}
          onClick={go}
          className="rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white disabled:opacity-50"
        >{pending ? "Deleting…" : "Yes, delete"}</button>
        <button type="button" onClick={() => { setOpen(false); setTyped(""); setErr(""); }} className="rounded-lg bg-white px-3 py-1.5 font-bold text-bbb-charcoal">Cancel</button>
      </div>
    </div>
  );
}
