import { loadNotifSettings, listRecentDeliveries } from "@/lib/admin/notification-settings-actions";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import NotificationSettings from "./NotificationSettings";
import DeliveryLog from "./DeliveryLog";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const [data, deliveries] = await Promise.all([loadNotifSettings(), listRecentDeliveries()]);
  if (!data) redirect("/login");
  return (
    <>
      <NotificationSettings initialSettings={data.settings} defs={data.defs} />
      <div className="mx-auto max-w-5xl px-4 pb-10">
        <DeliveryLog data={deliveries} />
      </div>
    </>
  );
}
