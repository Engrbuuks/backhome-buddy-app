import { listServiceTypes, getZoneUpliftPct, getUrgentSurchargePct } from "@/lib/admin/config-actions";
import ServicesEditor from "./ServicesEditor";

export default async function ServicesPage() {
  const [services, upliftPct, urgentPct] = await Promise.all([listServiceTypes(), getZoneUpliftPct(), getUrgentSurchargePct()]);
  return <ServicesEditor initial={services} upliftPct={upliftPct} urgentPct={urgentPct} />;
}
