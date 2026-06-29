"use client";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { sendVisitorMessage, getVisitorMessages } from "@/lib/support/public-actions";

function visitorKey(): string {
  if (typeof window === "undefined") return "";
  let k = window.localStorage.getItem("bbb_chat_key");
  if (!k) { k = crypto.randomUUID(); window.localStorage.setItem("bbb_chat_key", k); }
  return k;
}

export function PublicChatWidget({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const key = useRef<string>("");

  useEffect(() => { key.current = visitorKey(); }, []);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const load = async () => { const m = await getVisitorMessages(key.current); if (live) setMessages(m); };
    load();
    const iv = setInterval(load, 15000); // pick up team replies
    return () => { live = false; clearInterval(iv); };
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, sender: "user", content: text }]);
    start(async () => {
      setError("");
      const r = await sendVisitorMessage(key.current, text);
      if (r.error) setError(r.error);
      if (r.messages.length) setMessages(r.messages);
    });
  }

  const panel = (
    <div className={embedded ? "flex h-full w-full flex-col bg-white" : "flex h-[460px] w-[340px] flex-col overflow-hidden rounded-3xl border border-bbb-border bg-white shadow-2xl"}>
      <div className="flex items-center justify-between bg-bbb-strong px-4 py-3">
        <div>
          <p className="font-display text-sm font-extrabold text-white">Backhome Buddy</p>
          <p className="text-[11px] text-white/85">Ask us anything — instant answers</p>
        </div>
        {!embedded && <button onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-full text-white hover:bg-white/15"><X className="h-4 w-4" /></button>}
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto bg-bbb-bg p-3">
        {messages.length === 0 && (
          <div className="mr-auto max-w-[88%] rounded-2xl border border-bbb-border bg-white px-3.5 py-2.5 text-[13px] leading-5 text-bbb-charcoal">
            Hi! I can explain how Backhome Buddy works — errands in Nigeria, handled by vetted buddies with proof. What would you like to know?
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 ${m.sender === "user" ? "ml-auto bg-bbb-strong text-white" : m.sender === "staff" ? "mr-auto bg-bbb-charcoal text-white" : "mr-auto border border-bbb-border bg-white text-bbb-charcoal"}`}>
            {m.sender === "staff" && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">Team</p>}
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {pending && <div className="mr-auto rounded-2xl border border-bbb-border bg-white px-3.5 py-2.5 text-[13px] text-bbb-slate">Typing…</div>}
        {error && <p className="text-center text-[11px] font-semibold text-red-600">{error}</p>}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-bbb-border bg-white p-2.5">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={1500} placeholder="Type your question…" className="h-10 w-full rounded-xl border border-bbb-border px-3 text-[13px] outline-none focus:border-bbb-strong" />
        <button onClick={send} disabled={pending || !input.trim()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bbb-strong text-white hover:bg-bbb-dark disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );

  if (embedded) return panel;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && panel}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open chat" className="flex h-14 w-14 items-center justify-center rounded-full bg-bbb-strong text-white shadow-2xl transition hover:bg-bbb-dark">
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
