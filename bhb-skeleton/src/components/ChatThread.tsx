"use client";
import React, { useEffect, useRef } from "react";
import { formatDate } from "@/components/money";

const STYLE: Record<string, string> = {
  user: "ml-auto bg-bbb-strong text-white",
  assistant: "mr-auto bg-white border border-bbb-border",
  staff: "mr-auto bg-bbb-charcoal text-white",
};
const LABEL: Record<string, string> = { user: "You", assistant: "Assistant", staff: "Backhome Buddy Team" };

export function ChatThread({ messages, viewer = "user" }: { messages: any[]; viewer?: "user" | "admin" }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  return (
    <div className="flex max-h-[55vh] min-h-[240px] flex-col gap-3 overflow-y-auto rounded-3xl border border-bbb-border bg-bbb-bg p-4">
      {messages.length === 0 && <p className="m-auto text-sm text-bbb-slate">Ask anything about your requests, payments or how Backhome Buddy works.</p>}
      {messages.map((m) => {
        const mine = viewer === "admin" ? m.sender !== "user" : m.sender === "user";
        return (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-soft ${viewer === "admin" && m.sender === "user" ? "mr-auto bg-white border border-bbb-border" : STYLE[m.sender]} ${viewer === "admin" && m.sender !== "user" ? "ml-auto" : ""}`}>
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${mine && m.sender !== "assistant" ? "opacity-70" : "text-bbb-slate"}`}>{LABEL[m.sender]}</p>
            <p className="whitespace-pre-wrap leading-6">{m.content}</p>
            <p className={`mt-1 text-[10px] ${m.sender === "user" || m.sender === "staff" ? "opacity-60" : "text-bbb-slate"}`}>{formatDate(m.created_at)}</p>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
