import { listRequestsByStatus } from "@/lib/admin/ops-actions";
import { AdminQueueList } from "@/components/AdminQueueList";
import { Pager } from "@/components/Pager";
const PAGE_SIZE = 20;
export default async function AssignmentPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const { rows, total } = await listRequestsByStatus(["paid"], page, PAGE_SIZE);
  return (
    <>
      <AdminQueueList title="Assignment" eyebrow="Execution" description="Paid requests waiting for a buddy. Open one to assign." rows={rows} empty="No paid requests awaiting assignment." />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/assignment" />
    </>
  );
}
