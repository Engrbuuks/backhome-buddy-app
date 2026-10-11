import { listBuddies, listBuddyProfilesMissing } from "@/lib/admin/ops-actions";
import BuddyManagement from "./BuddyManagement";
import { Pager } from "@/components/Pager";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

const PAGE_SIZE = 20;

export default async function BuddiesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const [{ rows: buddies, total, migrationMissing }, missing] = await Promise.all([
    listBuddies(page, PAGE_SIZE),
    listBuddyProfilesMissing(),
  ]);
  return (
    <>
      <MarkNotificationsRead link="/admin/buddies" />
      {migrationMissing && (
        <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-extrabold text-amber-900">Database migration not run yet</p>
          <p className="mt-1 text-sm text-amber-800">
            Trust tiers, buddy clearance and the availability switch will not work until
            <strong> supabase/migrations/0038_trust_tiers_and_identity.sql</strong> is run in Supabase.
            Run 0038, then 0039 and 0040, in that order. They are safe to re-run.
          </p>
        </div>
      )}
      <BuddyManagement buddies={buddies} missing={missing} />
      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/buddies" />
    </>
  );
}
