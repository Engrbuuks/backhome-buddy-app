import { AdminShell, PageHeader } from "@/components/AdminShell";
import { listServiceTypes } from "@/lib/admin/config-actions";
import { listServiceMilestones } from "@/lib/requests/milestone-actions";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import MilestoneTemplates from "./MilestoneTemplates";

export const dynamic = "force-dynamic";

export default async function MilestonesPage() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const services = await listServiceTypes();
  const withMilestones = await Promise.all(
    services.map(async (s: any) => ({ id: s.id, name: s.name, milestones: await listServiceMilestones(s.id) }))
  );
  return (
    <AdminShell title="Milestone Templates">
      <PageHeader eyebrow="Proof" title="Milestone templates" description="Define the default proof milestones for each service. When a buddy is assigned, these copy onto the task — and you can still tweak them per task." />
      <MilestoneTemplates services={withMilestones} />
    </AdminShell>
  );
}
