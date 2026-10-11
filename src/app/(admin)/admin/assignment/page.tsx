import { listRequestsByStatus } from "@/lib/admin/ops-actions";
import { listOfferActivity } from "@/lib/offers/actions";
import { AdminQueueList } from "@/components/AdminQueueList";
import { Pager } from "@/components/Pager";
import OfferControls from "./OfferControls";

const PAGE_SIZE = 20;

export default async function AssignmentPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const [{ rows, total }, offers] = await Promise.all([
    listRequestsByStatus(["paid"], page, PAGE_SIZE),
    listOfferActivity(),
  ]);
  return (
    <>
      {/* The offer layer's operational home: mode, what is out now, and why
          buddies are saying no. The manual queue stays below it, unchanged. */}
      <OfferControls data={offers} />
      <AdminQueueList
        title="Assign by hand"
        eyebrow="Execution"
        description="Paid requests waiting for a buddy. Open one to assign directly — this always works and overrides any live offer."
        rows={rows}
        empty="No paid requests awaiting assignment."
      />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/assignment" />
    </>
  );
}
