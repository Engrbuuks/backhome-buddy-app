import Link from "next/link";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";

export function AdminQueueList({ title, eyebrow, description, rows, empty }: {
  title: string; eyebrow: string; description: string; rows: any[]; empty: string;
}) {
  return (
    <AdminShell title={title}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">{empty}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft hover:border-bbb-strong">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-bbb-slate">{r.profiles?.full_name ?? "—"} · {formatDate(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-4">
                {r.client_price_ngn != null && <span className="text-sm font-bold">{formatNGN(Number(r.client_price_ngn))}</span>}
                <StatusPill status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export function ComingSoon({ title }: { title: string; step?: string }) {
  return (
    <AdminShell title={title}>
      <PageHeader eyebrow="Admin" title={title} description="This section isn't available yet." />
      <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-10 text-center text-sm text-bbb-slate">Nothing to show here yet.</div>
    </AdminShell>
  );
}
