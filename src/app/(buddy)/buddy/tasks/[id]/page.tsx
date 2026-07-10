import { notFound } from "next/navigation";
import { getMyTask } from "@/lib/buddy/task-actions";
import { signProofUrls } from "@/lib/storage/sign";
import TaskDetail from "./TaskDetail";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export default async function BuddyTaskPage({ params }: { params: { id: string } }) {
  const task = await getMyTask(params.id);
  if (!task) notFound();
  task.proofs = await signProofUrls(task.proofs ?? []);
  return (
    <>
      <MarkNotificationsRead link={`/buddy/tasks/${params.id}`} />
      <TaskDetail task={task} />
    </>
  );
}
