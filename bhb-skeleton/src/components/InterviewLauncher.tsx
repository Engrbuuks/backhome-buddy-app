"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { startOrGetInterview, listInterviews } from "@/lib/admin/interview-actions";

/** Button to start or continue an in-app interview for a recruit or buddy. */
export default function InterviewLauncher({ recruitId, buddyId, name, email, compact }: {
  recruitId?: string; buddyId?: string; name?: string; email?: string; compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [past, setPast] = useState<any[] | null>(null);

  const go = () => start(async () => {
    const res = await startOrGetInterview({ recruitId, buddyId, name, email });
    if (res.interview) router.push(`/admin/interview/${res.interview.id}`);
  });
  const showPast = () => start(async () => {
    const list = await listInterviews({ recruitId, buddyId });
    setPast(list);
  });

  return (
    <div className={compact ? "inline-flex flex-col gap-1" : "mt-3 rounded-2xl border border-bbb-border bg-white p-4"}>
      {!compact && <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-bbb-strong"><ClipboardList className="h-3.5 w-3.5" /> Interview</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={go} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark disabled:opacity-50">
          <ClipboardList className="h-4 w-4" /> {pending ? "Opening…" : "Start / continue interview"}
        </button>
        <button onClick={showPast} disabled={pending} className="text-xs font-bold text-bbb-slate hover:text-bbb-strong hover:underline">View past interviews</button>
      </div>
      {past && past.length > 0 && (
        <div className="mt-2 space-y-1">
          {past.map((iv) => (
            <a key={iv.id} href={`/admin/interview/${iv.id}`} className="flex items-center justify-between rounded-lg border border-bbb-border px-3 py-1.5 text-xs hover:border-bbb-strong">
              <span>{new Date(iv.created_at).toLocaleDateString()} · {iv.status}{iv.decision ? ` · ${iv.decision}` : ""}</span>
              {iv.overall_score != null && <span className="font-bold">{iv.overall_score}/100</span>}
            </a>
          ))}
        </div>
      )}
      {past && past.length === 0 && <p className="mt-1 text-xs text-bbb-slate">No past interviews.</p>}
    </div>
  );
}
