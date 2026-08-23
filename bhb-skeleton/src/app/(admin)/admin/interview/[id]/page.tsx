import { getInterview } from "@/lib/admin/interview-actions";
import { getCurrentProfile } from "@/lib/auth/roles";
import { redirect, notFound } from "next/navigation";
import InterviewRunner from "./InterviewRunner";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: { id: string } }) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") redirect("/login");
  const interview = await getInterview(params.id);
  if (!interview) notFound();
  return <InterviewRunner initial={interview} />;
}
