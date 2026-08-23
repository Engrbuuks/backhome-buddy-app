"use client";
import React, { useState, useTransition } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { draftReengagementEmail, sendReengagementEmail } from "@/lib/admin/clients-actions";

/** AI-drafts a re-engagement email, lets the admin edit it, then sends. */
export default function ReengagementComposer({ clientId, clientName, hasEmail }: {
  clientId: string; clientName: string | null; hasEmail: boolean;
}) {
  const [drafting, startDraft] = useTransition();
  const [sending, startSend] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const draft = () => startDraft(async () => {
    setErr(""); setMsg("");
    const res = await draftReengagementEmail(clientId);
    if (res.error) { setErr(res.error); return; }
    setSubject(res.subject || ""); setBody(res.body || ""); setOpen(true);
  });

  const send = () => startSend(async () => {
    setErr(""); setMsg("");
    const res = await sendReengagementEmail(clientId, subject, body);
    if (res.error) { setErr(res.error); return; }
    setMsg("Email sent."); setOpen(false); setSubject(""); setBody("");
  });

  if (!hasEmail) return <p className="mt-3 text-sm text-bbb-slate">No email on file for this client.</p>;

  return (
    <div className="mt-3">
      {!open && (
        <button onClick={draft} disabled={drafting} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {drafting ? "Drafting…" : "Draft email with AI"}
        </button>
      )}

      {open && (
        <div className="mt-2 space-y-3 rounded-2xl border border-bbb-border bg-white p-4">
          <div>
            <label className="text-xs font-bold text-bbb-slate">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          </div>
          <div>
            <label className="text-xs font-bold text-bbb-slate">Message <span className="font-normal text-bbb-slate">(edit freely before sending)</span></label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="mt-1 w-full rounded-xl border border-bbb-border px-3 py-2 text-sm outline-none focus:border-bbb-strong" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={send} disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : `Send to ${clientName?.split(" ")[0] || "client"}`}
            </button>
            <button onClick={draft} disabled={drafting} className="inline-flex items-center gap-2 rounded-xl border border-bbb-border px-4 py-2.5 text-sm font-bold text-bbb-slate hover:border-bbb-strong disabled:opacity-50">
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Re-draft
            </button>
            <button onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-bbb-slate hover:text-bbb-charcoal">Cancel</button>
          </div>
        </div>
      )}

      {msg && <p className="mt-2 text-sm font-semibold text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
    </div>
  );
}
