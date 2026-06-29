import { notFound } from "next/navigation";
import { getRequestById } from "@/lib/requests/actions";
import { signProofUrls } from "@/lib/storage/sign";
import RequestDetails from "./RequestDetails";
import { listCharges } from "@/lib/admin/charge-actions";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await getRequestById(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const charges = await listCharges(params.id);
  return <RequestDetails request={request} charges={charges} />;
}
