"use client";
import React from "react";
import { useFormState } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { saveKnowledge, resetKnowledge } from "@/lib/admin/knowledge-actions";

export default function KnowledgeEditor({ text, isDefault }: { text: string; isDefault: boolean }) {
  const [state, formAction] = useFormState(saveKnowledge, { error: "" });
  const [rState, rAction] = useFormState(resetKnowledge, { error: "" });
  const [chars, setChars] = React.useState(text.length);

  return (
    <AdminShell title="Knowledge Base">
      <PageHeader
        eyebrow="AI Assistant"
        title="Knowledge base"
        description="Everything the AI chat assistant is allowed to say. It answers visitors and clients ONLY from this text — anything not covered here gets routed to the team. Edit it whenever the website or your policies change; updates apply to the very next chat message, no redeploy needed."
      />

      <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {state?.error && <ErrorState title="Could not save" message={state.error} />}
        {(state as any)?.saved && (
          <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">
            Knowledge base saved. The assistant uses it from the next message.
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-bbb-slate">
            {isDefault ? "Currently using the built-in default (compiled from backhomebuddy.ng)." : "Currently using your edited version."}
          </p>
          <p className="text-xs text-bbb-slate">{chars.toLocaleString()} / 20,000</p>
        </div>
        <textarea
          name="text"
          defaultValue={text}
          onChange={(e) => setChars(e.target.value.length)}
          rows={28}
          maxLength={20000}
          spellCheck={false}
          className="w-full rounded-2xl border border-bbb-border bg-bbb-bg p-4 font-mono text-xs leading-relaxed text-bbb-charcoal outline-none focus:border-bbb-strong"
        />
        <div className="rounded-2xl bg-bbb-soft p-3 text-xs text-bbb-dark">
          Tips: keep facts only (services, process, coverage, contact). Never put prices here — quotes must come from
          the team. Plain text with simple headings works best.
        </div>
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">
          Save knowledge base
        </button>
      </form>

      <form action={rAction} className="mt-5 space-y-3 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {rState?.error && <ErrorState title="Could not reset" message={rState.error} />}
        {(rState as any)?.saved && (
          <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Restored the built-in default.</div>
        )}
        <div>
          <p className="font-display text-base font-extrabold">Reset to default</p>
          <p className="mt-1 text-xs text-bbb-slate">
            Discards your edits and restores the built-in version compiled from the website. Your edited copy is not recoverable after reset.
          </p>
        </div>
        <button className="h-11 w-full rounded-xl border border-bbb-border bg-white text-sm font-bold text-bbb-charcoal hover:bg-bbb-bg">
          Reset to default
        </button>
      </form>
    </AdminShell>
  );
}
