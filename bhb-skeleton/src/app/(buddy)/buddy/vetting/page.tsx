import { redirect } from "next/navigation";
import { getMyVetting } from "@/lib/buddy/vetting-actions";
import VettingCenter from "./VettingCenter";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export default async function BuddyVettingPage() {
  const v = await getMyVetting();
  if (!v) redirect("/login");
  return (
    <>
      <MarkNotificationsRead link="/buddy/vetting" />
      <VettingCenter v={v} />
    </>
  );
}
