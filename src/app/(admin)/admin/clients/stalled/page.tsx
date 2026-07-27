import { listStalledClients } from "@/lib/admin/clients-actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StalledList from "./StalledList";

export const dynamic = "force-dynamic";

export default async function StalledClientsPage() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const stalled = await listStalledClients();

  return (
    <AdminShell title="Re-engage clients">
      <Link href="/admin/clients" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-bbb-strong hover:underline"><ArrowLeft className="h-4 w-4" /> All clients</Link>
      <PageHeader eyebrow="Re-engagement" title="Clients to win back" description="Clients who signed up or started a request but didn't follow through. Select who to email — each message is AI-drafted for their situation." />
      <StalledList clients={stalled} />
    </AdminShell>
  );
}
