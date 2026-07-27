import { notFound } from "next/navigation";
import { getRequestById } from "@/lib/requests/actions";
import { signProofUrls } from "@/lib/storage/sign";
import RequestDetails from "./RequestDetails";
import { listCharges } from "@/lib/admin/charge-actions";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { getMyDisplay, getBankDetails } from "@/lib/money/fx";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await getRequestById(params.id);
  if (!request) notFound();
  request.proofs = await signProofUrls(request.proofs ?? []);
  const charges = await listCharges(params.id);
  const [{ currency, rates }, banks] = await Promise.all([getMyDisplay(), getBankDetails()]);
  const bank = banks[currency] || null;
  return (
    <>
      <MarkNotificationsRead link={`/client/requests/${params.id}`} />
      <RequestDetails request={request} charges={charges} currency={currency} rates={rates} bank={bank} />
    </>
  );
}
