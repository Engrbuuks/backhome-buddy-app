import { redirect } from "next/navigation";
import { getMyVetting } from "@/lib/buddy/vetting-actions";
import VettingCenter from "./VettingCenter";

export default async function BuddyVettingPage() {
  const v = await getMyVetting();
  if (!v) redirect("/login");
  return <VettingCenter v={v} />;
}
