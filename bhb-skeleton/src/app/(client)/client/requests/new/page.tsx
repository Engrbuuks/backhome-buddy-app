import { getRequestFormOptions } from "@/lib/requests/actions";
import { listRecipients } from "@/lib/client/actions";
import NewRequestForm from "./NewRequestForm";

export default async function NewRequestPage() {
  const [{ services, regions }, recipients] = await Promise.all([getRequestFormOptions(), listRecipients()]);
  return <NewRequestForm services={services} regions={regions} recipients={recipients} />;
}
