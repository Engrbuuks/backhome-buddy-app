"use client";
import React, { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ChatThread } from "@/components/ChatThread";
import { ErrorState } from "@/components/StateBlocks";
import { staffReply } from "@/lib/support/actions";

function SendButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-11 shrink-0 rounded-xl bg-bbb-strong px-5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">{pending ? "Sending..." : "Reply as Team"}</button>;
}

export default function AdminChat({ thread }: { thread: any }) {
  const [state, formAction] = useFormState(staffReply, { error: "" });
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <AdminShell title="Support Chat">
      <PageHeader eyebrow="Support" title={thread.user?.full_name ?? thread.user?.email ?? "Website visitor"} description="Your reply posts into the client's chat as the Backhome Buddy Team and notifies them." />
      {state?.error && <div className="mb-3"><ErrorState title="Could not send" message={state.error} /></div>}
      <div className="max-w-2xl">
        <ChatThread messages={thread.messages} viewer="admin" />
        <form ref={formRef} action={async (fd) => { await formAction(fd); formRef.current?.reset(); }} className="mt-3 flex gap-2">
          <input type="hidden" name="thread_id" value={thread.id} />
          <input name="content" required maxLength={2000} placeholder="Reply to the client..." className="h-11 w-full rounded-xl border border-bbb-border bg-white px-4 text-sm outline-none focus:border-bbb-strong" />
          <SendButton />
        </form>
      </div>
    </AdminShell>
  );
}
