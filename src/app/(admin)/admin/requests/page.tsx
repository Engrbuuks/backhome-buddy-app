import { listAllRequests } from "@/lib/requests/actions";
import RequestsQueue from "./RequestsQueue";
import { Pager } from "@/components/Pager";

const PAGE_SIZE = 20;

export default async function RequestsQueuePage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const { rows, total } = await listAllRequests(page, PAGE_SIZE);
  return (
    <>
      <RequestsQueue initial={rows} />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/requests" />
    </>
  );
}
