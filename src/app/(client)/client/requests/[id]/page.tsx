import { notFound } from "next/navigation";
import { getRequestById } from "@/lib/requests/actions";
import { signProofUrls } from "@/lib/storage/sign";
import RequestDetails from "./RequestDetails";
import { listCharges } from "@/lib/admin/charge-actions";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { getMyDisplay, getBankDetails } from "@/lib/money/fx";
import { ratesForRequest } from "@/lib/money/currency";
import { getRequestMilestones } from "@/lib/requests/milestone-actions";
import { quoteRefund } from "@/lib/money/refund-actions";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await getRequestById(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const charges = await listCharges(params.id);
  const [{ currency, rates: liveRates }, banks] = await Promise.all([getMyDisplay(), getBankDetails()]);
  // Charge at the rate this client was quoted at, not at today's rate.
  const rates = ratesForRequest((request as any).fx_rates_snapshot, liveRates);
  const bank = banks[currency] || null;
  // Only surface milestones to the client once there's finished proof to show —
  // not while work is still in progress (avoids an anxious half-empty checklist).
  const CLIENT_MILESTONE_STATUSES = ["proof_ready", "proof_approved", "completed", "paid_out"];
  const milestones = CLIENT_MILESTONE_STATUSES.includes(request.status)
    ? await getRequestMilestones(params.id)
    : [];
  // Quoted server side so the client is shown the same figures the server will
  // act on, rather than anything the browser worked out for itself.
  const refundQuote = await quoteRefund(params.id);
  return (
    <>
      <MarkNotificationsRead link={`/client/requests/${params.id}`} />
      <RequestDetails request={request} charges={charges} currency={currency} rates={rates} bank={bank} milestones={milestones} refundQuote={refundQuote} />
    </>
  );
}
