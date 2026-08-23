import { getCurrentProfile } from "@/lib/auth/roles";
import { getMyBuddyProfile } from "@/lib/buddy/actions";
import { getMyProfileSummary } from "@/lib/buddy/vetting-actions";
import BuddyProfileForm from "./BuddyProfileForm";

export default async function BuddyProfilePage() {
  const [profile, buddy, summary] = await Promise.all([getCurrentProfile(), getMyBuddyProfile(), getMyProfileSummary()]);
  return <BuddyProfileForm profile={profile} buddy={buddy} photoUrl={(summary as any)?.photoUrl} />;
}
