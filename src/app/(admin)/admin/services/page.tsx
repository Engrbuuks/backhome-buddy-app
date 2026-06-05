import { listServiceTypes, getZoneUpliftPct } from "@/lib/admin/config-actions";
import ServicesEditor from "./ServicesEditor";

export default async function ServicesPage() {
  const [services, upliftPct] = await Promise.all([listServiceTypes(), getZoneUpliftPct()]);
  return <ServicesEditor initial={services} upliftPct={upliftPct} />;
}
