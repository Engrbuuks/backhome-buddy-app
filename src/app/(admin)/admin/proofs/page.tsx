import { listRequestsByStatus } from "@/lib/admin/ops-actions";
import { AdminQueueList } from "@/components/AdminQueueList";
import { Pager } from "@/components/Pager";
const PAGE_SIZE = 20;
export default async function ProofsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const { rows, total } = await listRequestsByStatus(["proof_ready"], page, PAGE_SIZE);
  return (
    <>
      <AdminQueueList title="Proof Review" eyebrow="Quality" description="Submitted proof awaiting your review. Open one to approve or request changes." rows={rows} empty="No proof awaiting review." />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/proofs" />
    </>
  );
}
