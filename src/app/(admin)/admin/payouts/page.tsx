import { listPayoutQueue } from "@/lib/admin/workflow-actions";
import PayoutsQueue from "./PayoutsQueue";
export default async function PayoutsPage() {
  const rows = await listPayoutQueue();
  return <PayoutsQueue rows={rows} />;
}
