import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { ClientShell } from "@/components/ClientShell";
import { getUnreadCount } from "@/lib/notifications/actions";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { ok } = await requireRole(["client"]);
  if (!ok) redirect("/login");
  const unread = await getUnreadCount();
  return <ClientShell unreadCount={unread}>{children}</ClientShell>;
}
