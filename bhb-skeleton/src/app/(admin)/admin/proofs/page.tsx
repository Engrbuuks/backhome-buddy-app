import { listRequestsByStatus } from "@/lib/admin/ops-actions";
import { AdminQueueList } from "@/components/AdminQueueList";
export default async function ProofsPage() {
  const rows = await listRequestsByStatus(["proof_ready"]);
  return <AdminQueueList title="Proof Review" eyebrow="Quality" description="Submitted proof awaiting your review. Open one to approve or request changes." rows={rows} empty="No proof awaiting review." />;
}
