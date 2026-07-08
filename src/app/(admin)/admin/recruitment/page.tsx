import { listRecruits } from "@/lib/admin/recruitment-actions";
import RecruitmentBoard from "./RecruitmentBoard";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const recruits = await listRecruits();
  return <RecruitmentBoard initial={recruits} />;
}
