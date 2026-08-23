"use client";
import React, { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChatThread } from "@/components/ChatThread";
import { ErrorState } from "@/components/StateBlocks";
import { sendChatMessage } from "@/lib/support/actions";

function SendButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-11 shrink-0 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Sending..." : "Send"}</button>;
}

export default function SupportChat({ thread }: { thread: any }) {
  const [state, formAction] = useFormState(sendChatMessage, { error: "" });
  const formRef = useRef<HTMLFormElement>(null);
  if (!thread) return <ErrorState title="Support unavailable" message="Please refresh and try again." />;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-extrabold">Support</h1>
        <p className="mt-1 text-sm text-bbb-slate">Instant answers from our assistant — and our team is notified and can step in right here.</p>
      </div>
      {state?.error && <div className="mb-3"><ErrorState title="Could not send" message={state.error} /></div>}
      <ChatThread messages={thread.messages} viewer="user" />
      <form ref={formRef} action={async (fd) => { await formAction(fd); formRef.current?.reset(); }} className="mt-3 flex gap-2">
        <input type="hidden" name="thread_id" value={thread.id} />
        <input name="content" required maxLength={2000} placeholder="Type your question..." className="h-11 w-full rounded-xl border border-bbb-border bg-white px-4 text-sm outline-none focus:border-bbb-strong" />
        <SendButton />
      </form>
    </div>
  );
}
