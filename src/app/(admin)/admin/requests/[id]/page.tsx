import { notFound } from "next/navigation";
import { getRequestForAdmin } from "@/lib/admin/quote-actions";
import { listApprovedBuddies } from "@/lib/admin/workflow-actions";
import { signProofUrls } from "@/lib/storage/sign";
import QuoteBuilder from "./QuoteBuilder";
import WorkflowPanel from "./WorkflowPanel";
import ChargesPanel from "./ChargesPanel";
import AiAssist from "./AiAssist";
import { RequestMessages } from "@/components/RequestMessages";
import { DeleteTaskPanel } from "./DeleteTaskPanel";
import { listCharges } from "@/lib/admin/charge-actions";
import { getUrgentSurchargePct } from "@/lib/admin/config-actions";

export default async function AdminRequestPage({ params }: { params: { id: string } }) {
  const request = await getRequestForAdmin(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const buddies = request.status === "paid" ? await listApprovedBuddies() : [];
  const charges = await listCharges(params.id);
  const urgentPct = await getUrgentSurchargePct();
  return (
    <QuoteBuilder
      request={request}
      expectations={request.expectations}
      urgentSurchargePct={urgentPct}
      actionSlot={<><WorkflowPanel request={request} buddies={buddies} />{(charges.length > 0 || ["paid", "assigned", "in_progress", "proof_submitted"].includes(request.status)) && <ChargesPanel request={request} charges={charges} />}<AiAssist request={request} /><RequestMessages requestId={request.id} viewer="admin" /><DeleteTaskPanel requestId={request.id} title={request.title} /></>}
    />
  );
}
