import { getMyBuddyProfile } from "@/lib/buddy/actions";
import PayoutDetailsForm from "./PayoutDetailsForm";

export default async function BuddySettingsPage() {
  const profile = await getMyBuddyProfile();
  return <PayoutDetailsForm initial={profile} />;
}
