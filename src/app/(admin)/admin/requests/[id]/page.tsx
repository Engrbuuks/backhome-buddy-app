import { notFound } from "next/navigation";
import { getRequestForAdmin } from "@/lib/admin/quote-actions";
import { listApprovedBuddies } from "@/lib/admin/workflow-actions";
import { signProofUrls } from "@/lib/storage/sign";
import QuoteBuilder from "./QuoteBuilder";
import WorkflowPanel from "./WorkflowPanel";

export default async function AdminRequestPage({ params }: { params: { id: string } }) {
  const request = await getRequestForAdmin(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const buddies = request.status === "paid" ? await listApprovedBuddies() : [];
  return (
    <>
      <QuoteBuilder request={request} />
      <div className="mx-auto max-w-[1280px] px-4 lg:pl-[270px] -mt-2 pb-8">
        <WorkflowPanel request={request} buddies={buddies} />
      </div>
    </>
  );
}
