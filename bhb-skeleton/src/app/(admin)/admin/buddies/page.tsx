import { listBuddies, listBuddyProfilesMissing } from "@/lib/admin/ops-actions";
import BuddyManagement from "./BuddyManagement";
import { Pager } from "@/components/Pager";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

const PAGE_SIZE = 20;

export default async function BuddiesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const [{ rows: buddies, total }, missing] = await Promise.all([
    listBuddies(page, PAGE_SIZE),
    listBuddyProfilesMissing(),
  ]);
  return (
    <>
      <MarkNotificationsRead link="/admin/buddies" />
      <BuddyManagement buddies={buddies} missing={missing} />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/buddies" />
    </>
  );
}
