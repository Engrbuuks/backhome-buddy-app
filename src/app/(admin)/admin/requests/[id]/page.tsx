import { notFound } from "next/navigation";
import { getRequestForAdmin } from "@/lib/admin/quote-actions";
import { listApprovedBuddies } from "@/lib/admin/workflow-actions";
import { signProofUrls } from "@/lib/storage/sign";
import QuoteBuilder from "./QuoteBuilder";
import WorkflowPanel from "./WorkflowPanel";
import ChargesPanel from "./ChargesPanel";
import { listCharges } from "@/lib/admin/charge-actions";

export default async function AdminRequestPage({ params }: { params: { id: string } }) {
  const request = await getRequestForAdmin(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const buddies = request.status === "paid" ? await listApprovedBuddies() : [];
  const charges = await listCharges(params.id);
  return (
    <QuoteBuilder
      request={request}
      expectations={request.expectations}
      actionSlot={<><WorkflowPanel request={request} buddies={buddies} />{(charges.length > 0 || ["paid", "assigned", "in_progress", "proof_submitted"].includes(request.status)) && <ChargesPanel request={request} charges={charges} />}</>}
    />
  );
}
