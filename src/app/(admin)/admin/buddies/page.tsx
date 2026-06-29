import { listBuddies, listBuddyProfilesMissing } from "@/lib/admin/ops-actions";
import BuddyManagement from "./BuddyManagement";
export default async function BuddiesPage() {
  const [buddies, missing] = await Promise.all([listBuddies(), listBuddyProfilesMissing()]);
  return <BuddyManagement buddies={buddies} missing={missing} />;
}
