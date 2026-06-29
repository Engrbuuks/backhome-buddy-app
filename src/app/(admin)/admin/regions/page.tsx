import { listRegions } from "@/lib/admin/config-actions";
import RegionsEditor from "./RegionsEditor";

export default async function RegionsPage() {
  const regions = await listRegions();
  return <RegionsEditor initial={regions} />;
}
