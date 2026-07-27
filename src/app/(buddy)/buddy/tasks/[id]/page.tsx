import { notFound } from "next/navigation";
import { getMyTask } from "@/lib/buddy/task-actions";
import { signProofUrls } from "@/lib/storage/sign";
import TaskDetail from "./TaskDetail";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";
import { getRequestMilestones } from "@/lib/requests/milestone-actions";

export default async function BuddyTaskPage({ params }: { params: { id: string } }) {
  const task = await getMyTask(params.id);
  if (!task) notFound();
  task.proofs = await signProofUrls(task.proofs ?? []);
  const milestones = await getRequestMilestones(params.id);
  return (
    <>
      <MarkNotificationsRead link={`/buddy/tasks/${params.id}`} />
      <TaskDetail task={task} milestones={milestones} />
    </>
  );
}
