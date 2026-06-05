import { getCurrentProfile } from "@/lib/auth/roles";
import { getMyBuddyProfile } from "@/lib/buddy/actions";
import BuddyProfileForm from "./BuddyProfileForm";

export default async function BuddyProfilePage() {
  const [profile, buddy] = await Promise.all([getCurrentProfile(), getMyBuddyProfile()]);
  return <BuddyProfileForm profile={profile} buddy={buddy} />;
}
