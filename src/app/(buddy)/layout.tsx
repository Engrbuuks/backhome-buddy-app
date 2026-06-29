import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { BuddyShell } from "@/components/BuddyShell";
import { getUnreadCount } from "@/lib/notifications/actions";

export default async function BuddyLayout({ children }: { children: React.ReactNode }) {
  const { ok } = await requireRole(["buddy"]);
  if (!ok) redirect("/login");
  const unread = await getUnreadCount();
  return <BuddyShell unreadCount={unread}>{children}</BuddyShell>;
}
