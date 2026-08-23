import { loadNotifSettings } from "@/lib/admin/notification-settings-actions";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import NotificationSettings from "../notifications-settings/NotificationSettings";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const data = await loadNotifSettings();
  if (!data) redirect("/login");
  return <NotificationSettings initialSettings={data.settings} defs={data.defs} />;
}
