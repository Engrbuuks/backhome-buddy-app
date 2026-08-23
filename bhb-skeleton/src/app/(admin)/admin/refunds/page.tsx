import { listRefundQueue } from "@/lib/money/edge-actions";
import RefundsQueue from "./RefundsQueue";
export default async function RefundsPage() {
  const rows = await listRefundQueue();
  return <RefundsQueue rows={rows} />;
}
