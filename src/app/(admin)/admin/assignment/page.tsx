import { listRequestsByStatus } from "@/lib/admin/ops-actions";
import { AdminQueueList } from "@/components/AdminQueueList";
export default async function AssignmentPage() {
  const rows = await listRequestsByStatus(["paid"]);
  return <AdminQueueList title="Assignment" eyebrow="Execution" description="Paid requests waiting for a buddy. Open one to assign." rows={rows} empty="No paid requests awaiting assignment." />;
}
