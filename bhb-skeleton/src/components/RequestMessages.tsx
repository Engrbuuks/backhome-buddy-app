"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bold, Italic, List, CornerDownLeft, Paperclip, X, FileText, Loader2 } from "lucide-react";
import { getRequestMessages, sendRequestMessage } from "@/lib/requests/message-actions";
import { uploadToR2 } from "@/lib/storage/upload-client";
import { formatDate } from "@/components/money";

/** Escape HTML, then render a safe subset of markdown: **bold**, *italic*,
 *  `code`, "- " bullet lists, and line breaks. No raw HTML is ever injected. */
function renderMarkdown(raw: string): string {
  const esc = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  let html = ""; let inList = false;
  const inline = (s: string) => s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/10 px-1 text-[0.85em]">$1</code>');
  for (const ln of lines) {
    const m = ln.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      if (!inList) { html += '<ul class="list-disc pl-5 my-1">'; inList = true; }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += ln.trim() === "" ? "<br/>" : `<div>${inline(ln)}</div>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

const AUDIENCES: Array<{ v: "all" | "client" | "buddy"; label: string }> = [
  { v: "all", label: "Everyone" },
  { v: "client", label: "Client only" },
  { v: "buddy", label: "Buddy only" },
];

export function RequestMessages({ requestId, viewer }: { requestId: string; viewer: "client" | "admin" | "buddy" }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState<"all" | "client" | "buddy">("all");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const m = await getRequestMessages(requestId);
    setMessages(m);
  }, [requestId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body && !file) return;
    setSending(true); setError("");
    try {
      let attachment: { url: string; kind: "image" | "video" | "file"; name?: string } | undefined;
      if (file) {
        setUploading(true);
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const kind: "image" | "video" | "file" = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : "file";
        const { key } = await uploadToR2("proofs", file, { ext, contentType: file.type || "application/octet-stream", scope: `chat-${requestId}` });
        attachment = { url: key, kind, name: file.name };
        setUploading(false);
      }
      const res = await sendRequestMessage(requestId, body, viewer === "admin" ? audience : "all", attachment);
      if (res.error) { setError(res.error); setSending(false); return; }
      setText(""); setFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
      setUploading(false);
    }
    setSending(false);
  };

  const wrap = (before: string, after: string = before) => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = text.slice(s, e) || "text";
    const next = text.slice(0, s) + before + sel + after + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const bulletLine = () => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    const next = text.slice(0, lineStart) + "- " + text.slice(lineStart);
    setText(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + 2, s + 2); });
  };

  const mineSender = viewer === "admin" ? "staff" : viewer === "buddy" ? "buddy" : "client";
  const labelFor = (m: any) => {
    if (m.sender === "staff") return "Backhome Buddy Team";
    if (m.sender === "buddy") return m.sender_first_name ? `${m.sender_first_name} (Buddy)` : "Your Buddy";
    return m.sender_first_name ? `${m.sender_first_name} (Client)` : "Client";
  };
  const audienceTag = (m: any) => {
    if (viewer !== "admin" || !m.audience || m.audience === "all") return null;
    return m.audience === "client" ? "\u2192 Client only" : "\u2192 Buddy only";
  };

  const emptyMsg = viewer === "admin"
    ? "No messages yet. Message the client or buddy below."
    : viewer === "buddy"
    ? "No messages yet. Ask a question about this task \u2014 the client and our team will see it."
    : "No messages yet. Send us a message about this request below.";
  const placeholder = viewer === "admin" ? "Message\u2026 (Shift+Enter for a new line)" : viewer === "buddy" ? "Ask about this task\u2026 (Shift+Enter for a new line)" : "Type your message\u2026 (Shift+Enter for a new line)";

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <p className="mb-3 font-display text-base font-extrabold">Messages</p>
      <div className="flex max-h-[50vh] min-h-[160px] flex-col gap-3 overflow-y-auto rounded-2xl bg-bbb-bg p-4">
        {messages.length === 0 && <p className="m-auto text-center text-sm text-bbb-slate">{emptyMsg}</p>}
        {messages.map((m) => {
          const mine = m.sender === mineSender;
          const tag = audienceTag(m);
          return (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-soft ${mine ? "ml-auto bg-bbb-strong text-white" : "mr-auto border border-bbb-border bg-white"}`}>
              <p className={`mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide ${mine ? "opacity-70" : "text-bbb-slate"}`}>
                {labelFor(m)}
                {tag && <span className={`rounded px-1.5 py-0.5 ${mine ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>{tag}</span>}
              </p>
              <div className="leading-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
              {m.attachment_signed && (
                <div className="mt-2">
                  {m.attachment_kind === "image" ? (
                    <a href={m.attachment_signed} target="_blank" rel="noreferrer"><img src={m.attachment_signed} alt="attachment" className="max-h-56 rounded-lg object-cover" /></a>
                  ) : m.attachment_kind === "video" ? (
                    <video src={m.attachment_signed} controls className="max-h-56 rounded-lg" />
                  ) : (
                    <a href={m.attachment_signed} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${mine ? "border-white/30 text-white" : "border-bbb-border text-bbb-strong"}`}>
                      <FileText className="h-4 w-4" /> {m.attachment_name || "Download file"}
                    </a>
                  )}
                </div>
              )}
              <p className={`mt-1 text-[10px] ${mine ? "opacity-60" : "text-bbb-slate"}`}>{formatDate(m.created_at)}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-1 border-b border-bbb-border pb-2">
        <button type="button" onClick={() => wrap("**")} title="Bold" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bbb-bg"><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => wrap("*")} title="Italic" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bbb-bg"><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={bulletLine} title="Bullet list" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bbb-bg"><List className="h-4 w-4" /></button>
        <span className="mx-1 h-4 w-px bg-bbb-border" />
        <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => fileRef.current?.click()} title="Attach a file" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bbb-bg"><Paperclip className="h-4 w-4" /></button>
        <span className="ml-1 flex items-center gap-1 text-[11px] text-bbb-slate"><CornerDownLeft className="h-3 w-3" /> Shift+Enter = new line</span>

        {viewer === "admin" && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-bbb-slate">Send to:</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="h-8 rounded-lg border border-bbb-border bg-white px-2 text-xs font-bold outline-none focus:border-bbb-strong">
              {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-bbb-border bg-bbb-bg px-3 py-2 text-xs">
          {file.type.startsWith("image") ? <img src={URL.createObjectURL(file)} alt="" className="h-8 w-8 rounded object-cover" /> : <FileText className="h-4 w-4 text-bbb-slate" />}
          <span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-bbb-slate" /> : <button onClick={() => setFile(null)} className="text-bbb-slate hover:text-red-600"><X className="h-4 w-4" /></button>}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          maxLength={4000}
          rows={2}
          placeholder={placeholder}
          className="w-full resize-y rounded-xl border border-bbb-border bg-white px-4 py-2.5 text-sm outline-none focus:border-bbb-strong"
        />
        <button disabled={sending || (!text.trim() && !file)} onClick={send} className="h-11 shrink-0 self-end rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          {sending ? (uploading ? "Uploading\u2026" : "Sending\u2026") : "Send"}
        </button>
      </div>
      {viewer === "admin" && audience !== "all" && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600">This message will only be visible to the {audience === "client" ? "client" : "buddy"}.</p>
      )}
    </div>
  );
}
