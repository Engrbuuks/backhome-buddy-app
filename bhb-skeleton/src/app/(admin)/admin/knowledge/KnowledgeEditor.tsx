"use client";
import React, { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { ErrorState } from "@/components/StateBlocks";
import { RefreshCw } from "lucide-react";
import { saveKnowledge, resetKnowledge, refreshKnowledgeFromWebsite } from "@/lib/admin/knowledge-actions";

export default function KnowledgeEditor({ text, isDefault }: { text: string; isDefault: boolean }) {
  const [state, formAction] = useFormState(saveKnowledge, { error: "" });
  const [rState, rAction] = useFormState(resetKnowledge, { error: "" });
  // Local editable copy so the "Refresh from website" draft can populate it.
  const [value, setValue] = useState(text);
  const [pending, start] = useTransition();
  const [refreshMsg, setRefreshMsg] = useState("");
  const [refreshErr, setRefreshErr] = useState("");
  const [draftReady, setDraftReady] = useState(false);

  const doRefresh = () => start(async () => {
    setRefreshMsg(""); setRefreshErr(""); setDraftReady(false);
    const res = await refreshKnowledgeFromWebsite();
    if (res.error) { setRefreshErr(res.error); return; }
    setValue(res.draft || "");
    setDraftReady(true);
    setRefreshMsg(`Read ${res.pagesRead} page(s) from the website and rebuilt a draft below. Review it, then click Save to apply.`);
  });

  return (
    <AdminShell title="Knowledge Base">
      <PageHeader
        eyebrow="AI Assistant"
        title="Knowledge base"
        description="Everything the AI chat assistant is allowed to say. It answers ONLY from this text — anything not covered gets routed to the team. Updates apply to the very next chat message, no redeploy needed."
      />

      {/* Refresh from website */}
      <div className="mb-5 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-extrabold">Refresh from website</p>
            <p className="mt-1 max-w-2xl text-xs text-bbb-slate">
              Reads your live website (services, how it works, about, FAQ, pricing, contact) and rebuilds a fresh knowledge base draft using AI. It appears in the editor below for you to review — nothing changes for the assistant until you click Save.
            </p>
          </div>
          <button
            type="button"
            onClick={doRefresh}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2.5 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Reading website…" : "Refresh from website"}
          </button>
        </div>
        {refreshMsg && <p className="mt-3 rounded-xl bg-green-50 p-3 text-xs font-semibold text-green-700">{refreshMsg}</p>}
        {refreshErr && <div className="mt-3"><ErrorState title="Couldn't refresh" message={refreshErr} /></div>}
      </div>

      {/* Editor + Save */}
      <form action={formAction} className="space-y-4 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {state?.error && <ErrorState title="Could not save" message={state.error} />}
        {(state as any)?.saved && (
          <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">
            Knowledge base saved. The assistant uses it from the next message.
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-bbb-slate">
            {draftReady ? "Reviewing a fresh draft from the website — Save to apply it." : isDefault ? "Currently using the built-in default (compiled from backhomebuddy.ng)." : "Currently using your edited version."}
          </p>
          <p className="text-xs text-bbb-slate">{value.length.toLocaleString()} / 20,000</p>
        </div>
        <textarea
          name="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={28}
          maxLength={20000}
          spellCheck={false}
          className="w-full rounded-2xl border border-bbb-border bg-bbb-bg p-4 font-mono text-xs leading-relaxed text-bbb-charcoal outline-none focus:border-bbb-strong"
        />
        <div className="rounded-2xl bg-bbb-soft p-3 text-xs text-bbb-dark">
          Tips: keep facts only (services, process, coverage, contact). Never put fixed prices here — quotes must come from the team. Plain text with simple headings works best.
        </div>
        <button className="h-11 w-full rounded-xl bg-bbb-strong text-sm font-bold text-white hover:bg-bbb-dark">
          Save knowledge base
        </button>
      </form>

      {/* Reset */}
      <form action={rAction} className="mt-5 space-y-3 rounded-3xl border border-bbb-border bg-white p-6 shadow-soft">
        {rState?.error && <ErrorState title="Could not reset" message={rState.error} />}
        {(rState as any)?.saved && (
          <div className="rounded-2xl bg-green-50 p-3 text-sm font-semibold text-green-700">Restored the built-in default.</div>
        )}
        <div>
          <p className="font-display text-base font-extrabold">Reset to default</p>
          <p className="mt-1 text-xs text-bbb-slate">
            Discards your saved edits and restores the built-in version. Your edited copy is not recoverable after reset.
          </p>
        </div>
        <button className="h-11 w-full rounded-xl border border-bbb-border bg-white text-sm font-bold text-bbb-charcoal hover:bg-bbb-bg">
          Reset to default
        </button>
      </form>
    </AdminShell>
  );
}
