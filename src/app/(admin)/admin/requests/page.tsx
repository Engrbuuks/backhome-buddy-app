import { listAllRequests } from "@/lib/requests/actions";
import RequestsQueue from "./RequestsQueue";

export default async function RequestsQueuePage() {
  const requests = await listAllRequests();
  return <RequestsQueue initial={requests} />;
}
