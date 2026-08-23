import { AdminShell, PageHeader } from "@/components/AdminShell";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { getAccounting } from "@/lib/admin/accounting-actions";
import AccountingView from "./AccountingView";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  // Default: current month.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const initial = await getAccounting(monthStart, now.toISOString());
  return (
    <AdminShell title="Accounting">
      <PageHeader eyebrow="Money" title="Accounting" description="Revenue, payouts and profit over any period. Purchases made on clients' behalf are excluded from revenue." />
      <AccountingView initial={initial} initialStart={monthStart} initialEnd={now.toISOString()} />
    </AdminShell>
  );
}
