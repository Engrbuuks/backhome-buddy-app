import { listRecruits } from "@/lib/admin/recruitment-actions";
import RecruitmentBoard from "./RecruitmentBoard";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const recruits = await listRecruits();
  return (
    <>
      <MarkNotificationsRead link="/admin/recruitment" />
      <RecruitmentBoard initial={recruits} />
    </>
  );
}
