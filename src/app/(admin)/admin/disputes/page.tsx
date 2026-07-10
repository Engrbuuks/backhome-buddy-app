import { listOpenDisputes } from "@/lib/money/edge-actions";
import DisputesQueue from "./DisputesQueue";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export default async function DisputesPage() {
  const rows = await listOpenDisputes();
  return (
    <>
      <MarkNotificationsRead link="/admin/disputes" />
      <DisputesQueue rows={rows} />
    </>
  );
}
