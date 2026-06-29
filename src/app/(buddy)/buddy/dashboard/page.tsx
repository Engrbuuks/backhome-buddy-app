import Link from "next/link";
import { listMyTasks } from "@/lib/buddy/actions";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";

export default async function BuddyDashboard() {
  const tasks = await listMyTasks();
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold">My Tasks</h1>
        <p className="mt-1 text-sm text-bbb-slate">Tasks assigned to you. You only ever see your own.</p>
      </div>
      {tasks.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center">
          <h3 className="font-display text-lg font-bold">No tasks yet</h3>
          <p className="mt-1 max-w-sm text-sm text-bbb-slate">When the team assigns you a task, it appears here with your payout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t: any) => (
            <Link key={t.id} href={`/buddy/tasks/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs text-bbb-slate">{t.service_types?.name ?? "Custom"} · {t.recipient_address || "—"} · {formatDate(t.created_at)}</p>
              </div>
              <div className="flex items-center gap-4">
                {t.buddy_payout_ngn != null && <span className="text-sm font-bold text-bbb-dark">{formatNGN(t.buddy_payout_ngn)}</span>}
                <StatusPill status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
