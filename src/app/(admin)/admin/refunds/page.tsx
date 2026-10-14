import { listRefundQueue } from "@/lib/money/edge-actions";
import { listRefundRequests, getRefundPolicy, listHeldFunds } from "@/lib/money/refund-actions";
import { DEFAULT_REFUND_POLICY } from "@/lib/money/refund-policy";
import RefundsQueue from "./RefundsQueue";

export default async function RefundsPage() {
  const [legacy, open, approved, policy, held] = await Promise.all([
    listRefundQueue(),
    listRefundRequests("open"),
    listRefundRequests("approved"),
    getRefundPolicy(),
    listHeldFunds(),
  ]);

  // Approved but the money has not actually left yet. Approving is a decision;
  // transferring is a separate act, and this is the list of the gap between.
  const awaitingTransfer = (approved.rows ?? []).filter(
    (r: any) => r.requests?.status !== "refunded",
  );

  return (
    <RefundsQueue
      legacy={legacy}
      requests={open.rows ?? []}
      awaitingTransfer={awaitingTransfer}
      held={held}
      migrationMissing={open.migrationMissing}
      policy={policy ?? DEFAULT_REFUND_POLICY}
    />
  );
}
