import Link from "next/link";
import { listClients, getClientTotals } from "@/lib/admin/clients-actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { Pager } from "@/components/Pager";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { formatNGN, formatDate } from "@/components/money";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { Users, UserPlus } from "lucide-react";
import ClientsTable from "./ClientsTable";

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
        <ClientsTable rows={rows} />
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/clients" />
    </AdminShell>
  );
}
