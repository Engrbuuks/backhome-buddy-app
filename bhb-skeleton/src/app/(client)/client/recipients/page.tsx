import { listRecipients } from "@/lib/client/actions";
import RecipientsEditor from "./RecipientsEditor";
export default async function RecipientsPage() {
  const recipients = await listRecipients();
  return <RecipientsEditor initial={recipients} />;
}
