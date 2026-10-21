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

  // The banner and the pager go INTO BuddyManagement, not beside it. It owns
  // the AdminShell, so a sibling renders outside the sidebar and main column
  // and sits across the top of the screen with the menu pushed beneath it.
  const banner = migrationMissing ? (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-extrabold text-amber-900">Database migration not run yet</p>
      <p className="mt-1 text-sm text-amber-800">
        Trust tiers, buddy clearance, the availability switch and the automated bank account check
        will not work until the outstanding migrations are run in Supabase. Run
        <strong> 0038</strong> through <strong>0044</strong>, in order. All are safe to re-run.
      </p>
    </div>
  ) : null;

  return (
    <>
      <MarkNotificationsRead link="/admin/buddies" />
      <BuddyManagement
        buddies={buddies}
        missing={missing}
        banner={banner}
        pager={<Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/buddies" />}
      />
    </>
  );
}
