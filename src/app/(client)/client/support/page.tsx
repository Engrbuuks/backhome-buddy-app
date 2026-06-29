import { getMyThread } from "@/lib/support/actions";
import SupportChat from "./SupportChat";
export default async function SupportPage() {
  const thread = await getMyThread();
  return <SupportChat thread={thread} />;
}
