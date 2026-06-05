import { listServiceTypes } from "@/lib/admin/config-actions";
import ServicesEditor from "./ServicesEditor";

export default async function ServicesPage() {
  const services = await listServiceTypes();
  return <ServicesEditor initial={services} />;
}
