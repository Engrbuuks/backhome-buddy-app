"use client";
import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

type M = { id: string; title: string; hint?: string | null; done: boolean; note?: string | null; proof?: any };

/** Read-only milestone view for the client — shows each step of the task with
 *  the buddy's photo/video, so proof is structured rather than a loose gallery. */
export default function ClientMilestones({ milestones }: { milestones: M[] }) {
  if (!milestones?.length) return null;
  const done = milestones.filter((m) => m.done).length;

  return (
    <div className="rounded-3xl border border-bbb-border bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">Task checklist</h2>
        <span className="text-xs font-bold text-bbb-slate">{done}/{milestones.length} completed</span>
      </div>
      <p className="mb-4 text-xs text-bbb-slate">Each step your buddy completed, with the proof they captured.</p>
      <div className="space-y-3">
        {milestones.map((m) => (
          <div key={m.id} className={`rounded-2xl border p-4 ${m.done ? "border-green-200 bg-green-50" : "border-bbb-border bg-bbb-bg"}`}>
            <div className="flex items-start gap-3">
              {m.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-bbb-slate" />}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-bbb-charcoal">{m.title}</p>
                {m.hint && <p className="mt-0.5 text-xs text-bbb-slate">{m.hint}</p>}
                {m.done && m.note && <p className="mt-1 text-xs text-green-700">Buddy&apos;s note: {m.note}</p>}
                {m.done && m.proof?.signedUrl && (
                  <a href={m.proof.signedUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                    {m.proof.kind === "video"
                      ? <video src={m.proof.signedUrl} className="h-40 w-full rounded-lg object-cover" preload="metadata" controls />
                      : <img src={m.proof.signedUrl} alt={m.title} className="h-40 w-full rounded-lg object-cover" />}
                  </a>
                )}
                {!m.done && <p className="mt-1 text-xs text-bbb-slate">Not yet completed.</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
