import { listOpenDisputes } from "@/lib/money/edge-actions";
import DisputesQueue from "./DisputesQueue";
export default async function DisputesPage() {
  const rows = await listOpenDisputes();
  return <DisputesQueue rows={rows} />;
}
