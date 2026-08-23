import { notFound } from "next/navigation";
import { getRequestById } from "@/lib/requests/actions";
import { signProofUrls } from "@/lib/storage/sign";
import RequestDetails from "./RequestDetails";
import { listCharges } from "@/lib/admin/charge-actions";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { getMyDisplay, getBankDetails } from "@/lib/money/fx";
import { getRequestMilestones } from "@/lib/requests/milestone-actions";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await getRequestById(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const charges = await listCharges(params.id);
  const [{ currency, rates }, banks] = await Promise.all([getMyDisplay(), getBankDetails()]);
  const bank = banks[currency] || null;
  // Only surface milestones to the client once there's finished proof to show —
  // not while work is still in progress (avoids an anxious half-empty checklist).
  const CLIENT_MILESTONE_STATUSES = ["proof_ready", "proof_approved", "completed", "paid_out"];
  const milestones = CLIENT_MILESTONE_STATUSES.includes(request.status)
    ? await getRequestMilestones(params.id)
    : [];
  return (
    <>
      <MarkNotificationsRead link={`/client/requests/${params.id}`} />
      <RequestDetails request={request} charges={charges} currency={currency} rates={rates} bank={bank} milestones={milestones} />
    </>
  );
}
