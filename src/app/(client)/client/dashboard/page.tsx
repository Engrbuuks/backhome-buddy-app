import Link from "next/link";
import { listMyRequests } from "@/lib/requests/actions";
import { StatusPill } from "@/components/StatusPill";
import { formatClientMoney, formatDate } from "@/components/money";

export default async function ClientDashboard() {
  const requests = await listMyRequests();
  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h1 className="font-display text-2xl font-extrabold">My Requests</h1>
          <p className="mt-1 text-sm text-bbb-slate">Track everything you&apos;ve asked us to handle.</p>
        </div>
        <Link href="/client/requests/new" className="h-10 rounded-xl bg-bbb-strong px-4 text-sm font-bold leading-10 text-white hover:bg-bbb-dark">+ New Request</Link>
      </div>

      {requests.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center">
          <h3 className="font-display text-lg font-bold">No requests yet</h3>
          <p className="mt-1 max-w-sm text-sm text-bbb-slate">Submit your first request and we&apos;ll get to work.</p>
          <Link href="/client/requests/new" className="mt-5 rounded-xl bg-bbb-strong px-4 py-2 text-sm font-bold text-white hover:bg-bbb-dark">Create a request</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <Link key={r.id} href={`/client/requests/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bbb-border bg-white p-4 shadow-soft">
              <div className="min-w-0">
                <p className="truncate font-semibold text-bbb-charcoal">{r.title}</p>
                <p className="mt-0.5 text-xs text-bbb-slate">
                  {r.service_types?.name ?? "Custom"} · {formatDate(r.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {r.client_price_ngn != null && <span className="text-sm font-bold">{formatClientMoney(r.client_price_ngn, r.fx_rate)}</span>}
                <StatusPill status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
