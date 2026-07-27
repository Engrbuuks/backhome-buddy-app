"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { getRequestMessages, sendRequestMessage } from "@/lib/requests/message-actions";
import { formatDate } from "@/components/money";

/** Message thread on a request. Three-way: client, staff (admin), and the
 *  assigned buddy. `viewer` controls bubble alignment/labels. Identities are
 *  shown as first names only. */
export function RequestMessages({ requestId, viewer }: { requestId: string; viewer: "client" | "admin" | "buddy" }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const m = await getRequestMessages(requestId);
    setMessages(m);
  }, [requestId]);

  useEffect(() => { load(); }, [load]);
  // Light polling so replies appear without a manual refresh.
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true); setError("");
    const res = await sendRequestMessage(requestId, body);
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setText("");
    await load();
  };

  const mineSender = viewer === "admin" ? "staff" : viewer === "buddy" ? "buddy" : "client";

  // Label a message by role, using the first name where we have one.
  const labelFor = (m: any) => {
    if (m.sender === "staff") return "Backhome Buddy Team";
    if (m.sender === "buddy") return m.sender_first_name ? `${m.sender_first_name} (Buddy)` : "Your Buddy";
    return m.sender_first_name ? `${m.sender_first_name} (Client)` : "Client";
  };

  const emptyMsg = viewer === "admin"
    ? "No messages yet. Message the client or buddy below."
    : viewer === "buddy"
    ? "No messages yet. Ask a question about this task — the client and our team will see it."
    : "No messages yet. Send us a message about this request below.";
  const placeholder = viewer === "admin" ? "Message the client or buddy…" : viewer === "buddy" ? "Ask about this task…" : "Type your message…";

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <p className="mb-3 font-display text-base font-extrabold">Messages</p>
      <div className="flex max-h-[50vh] min-h-[160px] flex-col gap-3 overflow-y-auto rounded-2xl bg-bbb-bg p-4">
        {messages.length === 0 && (
          <p className="m-auto text-center text-sm text-bbb-slate">{emptyMsg}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender === mineSender;
          return (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-soft ${mine ? "ml-auto bg-bbb-strong text-white" : "mr-auto border border-bbb-border bg-white"}`}>
              <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${mine ? "opacity-70" : "text-bbb-slate"}`}>
                {labelFor(m)}
              </p>
              <p className="whitespace-pre-wrap leading-6">{m.content}</p>
              <p className={`mt-1 text-[10px] ${mine ? "opacity-60" : "text-bbb-slate"}`}>{formatDate(m.created_at)}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          maxLength={4000}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-bbb-border bg-white px-4 text-sm outline-none focus:border-bbb-strong"
        />
        <button disabled={sending || !text.trim()} onClick={send} className="h-11 shrink-0 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
