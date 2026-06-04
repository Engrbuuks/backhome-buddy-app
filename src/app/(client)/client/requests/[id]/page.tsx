import { notFound } from "next/navigation";
import { getRequestById } from "@/lib/requests/actions";
import { signProofUrls } from "@/lib/storage/sign";
import RequestDetails from "./RequestDetails";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await getRequestById(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  return <RequestDetails request={request} />;
}
