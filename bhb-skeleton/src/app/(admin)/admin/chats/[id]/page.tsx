import { notFound } from "next/navigation";
import { getThreadForAdmin } from "@/lib/support/actions";
import AdminChat from "./AdminChat";
export default async function AdminChatPage({ params }: { params: { id: string } }) {
  const thread = await getThreadForAdmin(params.id);
  if (!thread) notFound();
  return <AdminChat thread={thread} />;
}
