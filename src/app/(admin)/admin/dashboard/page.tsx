import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { StatusPill } from "@/components/StatusPill";
import { formatNGN, formatDate } from "@/components/money";

export default async function AdminDashboard() {
  const supabase = createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("id, title, status, client_price_ngn, created_at, profiles!requests_client_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  const all = requests ?? [];
  const count = (s: string[]) => all.filter((r) => s.includes(r.status)).length;
  const kpis = [
    { label: "Awaiting quote", value: count(["submitted"]) },
    { label: "Awaiting payment", value: count(["quoted", "awaiting_pay"]) },
    { label: "In execution", value: count(["paid", "assigned", "in_progress", "proof_ready", "proof_approved"]) },
    { label: "Completed", value: count(["completed", "paid_out"]) },
  ];

  return (
    <AdminShell title="Dashboard">
      <PageHeader eyebrow="Operations" title="Dashboard" description="Live overview of every request in the system." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">{k.label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{k.value}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-center font-display text-lg font-extrabold sm:text-left">Recent requests</h2>
      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No requests yet.</div>
      ) : (
        <div className="space-y-3">
          {all.slice(0, 8).map((r: any) => (
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
