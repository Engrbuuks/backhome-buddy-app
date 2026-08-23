"use client";
import React, { useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ChatThread } from "@/components/ChatThread";
import { ErrorState } from "@/components/StateBlocks";
import { staffReply, resumeAi, takeOverChat } from "@/lib/support/actions";

function SendButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-11 shrink-0 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Sending..." : "Reply as Team"}</button>;
}

export default function AdminChat({ thread }: { thread: any }) {
  const [state, formAction] = useFormState(staffReply, { error: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean>(thread.ai_enabled !== false);
  const [pending, start] = useTransition();
  const toggle = () => start(async () => {
    if (aiEnabled) { const r = await takeOverChat(thread.id); if (!r.error) setAiEnabled(false); }
    else { const r = await resumeAi(thread.id); if (!r.error) setAiEnabled(true); }
  });

  return (
    <AdminShell title="Support Chat">
      <PageHeader eyebrow="Support" title={thread.user?.full_name ?? thread.user?.email ?? "Website visitor"} description="Your reply posts into the chat as the Backhome Buddy Team and notifies them." />
      {state?.error && <div className="mb-3"><ErrorState title="Could not send" message={state.error} /></div>}
      <div className="max-w-2xl">
        <div className={`mb-3 flex items-center justify-between rounded-xl border p-3 text-sm ${aiEnabled ? "border-bbb-border bg-white" : "border-amber-300 bg-amber-50"}`}>
          <span className="font-semibold">
            {aiEnabled
              ? "🤖 AI is answering this chat automatically."
              : "🙋 You've taken over — the AI is paused for this chat."}
          </span>
          <button onClick={toggle} disabled={pending} className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${aiEnabled ? "bg-amber-600 hover:bg-amber-700" : "bg-bbb-strong hover:bg-bbb-dark"}`}>
            {pending ? "…" : aiEnabled ? "Take over chat" : "Hand back to AI"}
          </button>
        </div>
        <ChatThread messages={thread.messages} viewer="admin" />
        <form ref={formRef} action={async (fd) => { await formAction(fd); formRef.current?.reset(); setAiEnabled(false); }} className="mt-3 flex gap-2">
          <input type="hidden" name="thread_id" value={thread.id} />
          <input name="content" required maxLength={2000} placeholder="Reply to the client..." className="h-11 w-full rounded-xl border border-bbb-border bg-white px-4 text-sm outline-none focus:border-bbb-strong" />
          <SendButton />
        </form>
        <p className="mt-2 text-xs text-bbb-slate">Sending a reply automatically pauses the AI for this chat. Use “Hand back to AI” when you’re done.</p>
      </div>
    </AdminShell>
  );
}
