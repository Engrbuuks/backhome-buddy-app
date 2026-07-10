import { listPayoutQueue } from "@/lib/admin/workflow-actions";
import PayoutsQueue from "./PayoutsQueue";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export default async function PayoutsPage() {
  const rows = await listPayoutQueue();
  return (
    <>
      <MarkNotificationsRead link="/admin/payouts" />
      <PayoutsQueue rows={rows} />
    </>
  );
}
