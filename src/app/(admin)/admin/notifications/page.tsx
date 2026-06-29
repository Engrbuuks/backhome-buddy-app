import { listMyNotifications } from "@/lib/notifications/actions";
import { AdminShell, PageHeader } from "@/components/AdminShell";
import { NotificationList } from "@/components/NotificationList";
export default async function AdminNotificationsPage() {
  const items = await listMyNotifications();
  return (
    <AdminShell title="Notifications">
      <PageHeader eyebrow="Inbox" title="Notifications" description="Proof submissions, disputes, cancellations and payout-eligible tasks land here." />
      <NotificationList items={items} />
    </AdminShell>
  );
}
