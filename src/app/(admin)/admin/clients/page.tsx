import Link from "next/link";
import { listClients, getClientTotals } from "@/lib/admin/clients-actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Pager } from "@/components/Pager";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { formatNGN, formatDate } from "@/components/money";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { Users, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function ClientsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const [{ rows, total }, totals] = await Promise.all([
    listClients(page, PAGE_SIZE),
    getClientTotals(),
  ]);

  return (
    <AdminShell title="Clients">
      <MarkNotificationsRead link="/admin/clients" />
      <PageHeader eyebrow="People" title="Clients" description="Everyone who has signed up as a client, and what they've requested." />
      <div className="mb-4">
        <Link href="/admin/clients/stalled" className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:border-amber-400">
          Re-engage stalled clients →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
          <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">Total clients</p><Users className="h-4 w-4 text-bbb-slate" /></div>
          <p className="font-display text-3xl font-extrabold">{totals.total}</p>
        </div>
        <div className="rounded-2xl border border-bbb-border bg-white p-5 shadow-soft">
          <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-bbb-slate">New this month</p><UserPlus className="h-4 w-4 text-green-600" /></div>
          <p className="font-display text-3xl font-extrabold">{totals.thisMonth}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bbb-border bg-white p-8 text-center text-sm text-bbb-slate">No clients yet.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-bbb-border bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bbb-border bg-bbb-bg text-left text-xs uppercase tracking-wide text-bbb-slate">
                <th className="px-4 py-3 font-bold">Client</th>
                <th className="px-4 py-3 font-bold">Joined</th>
                <th className="px-4 py-3 text-center font-bold">Requests</th>
                <th className="px-4 py-3 text-right font-bold">Spend</th>
                <th className="px-4 py-3 font-bold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b border-bbb-border last:border-0 hover:bg-bbb-bg/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="block">
                      <p className="font-semibold text-bbb-strong hover:underline">{c.full_name || "—"}</p>
                      <p className="text-xs text-bbb-slate">{c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-bbb-slate"><Link href={`/admin/clients/${c.id}`} className="block">{formatDate(c.created_at)}</Link></td>
                  <td className="px-4 py-3 text-center font-bold"><Link href={`/admin/clients/${c.id}`} className="block">{c.requestCount}</Link></td>
                  <td className="px-4 py-3 text-right font-bold"><Link href={`/admin/clients/${c.id}`} className="block">{c.totalSpendNgn > 0 ? formatNGN(c.totalSpendNgn) : "—"}</Link></td>
                  <td className="px-4 py-3 text-bbb-slate"><Link href={`/admin/clients/${c.id}`} className="block">{c.lastRequestAt ? formatDate(c.lastRequestAt) : "No requests"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/clients" />
    </AdminShell>
  );
}
