import { listMyNotifications } from "@/lib/notifications/actions";
import { NotificationList } from "@/components/NotificationList";
export default async function NotificationsPage() {
  const items = await listMyNotifications();
  return <NotificationList items={items} />;
}
