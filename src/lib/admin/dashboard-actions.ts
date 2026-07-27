"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

/** One efficient pass of dashboard metrics. Uses count-only queries and small
 *  selects — never loads whole tables — so it stays fast as data grows. */
export async function getDashboardStats() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const db = createAdminClient();

  // Helper: head-count with filters, no rows returned.
  const countReq = async (statuses: string[]) => {
    const { count } = await db.from("requests").select("id", { count: "exact", head: true }).in("status", statuses);
    return count ?? 0;
  };
  const countTable = async (table: string, col: string, val: string) => {
    const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(col, val);
    return count ?? 0;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenAgo = new Date(now.getTime() - 6 * 86400000);

  // Run independent queries in parallel.
  const [
    awaitingQuote, awaitingPay, inExecution, proofToReview, disputed, completedAll,
    buddiesApproved, buddiesReview, recruitsNew, recruitsApplied,
    payoutQueueRows, monthRevenueRows, heldRows, recentReqRows, trendRows, openDisputeRows,
  ] = await Promise.all([
    countReq(["submitted"]),
    countReq(["quoted", "awaiting_pay"]),
    countReq(["paid", "assigned", "in_progress"]),
    countReq(["proof_ready"]),
    countReq(["disputed"]),
    countReq(["completed", "paid_out"]),
    countTable("buddy_profiles", "vetting", "approved"),
    countTable("buddy_profiles", "vetting", "under_review"),
    countTable("recruits", "status", "new").catch(() => 0),
    countTable("recruits", "status", "applied").catch(() => 0),
    // payout queue: completed awaiting payout
    db.from("requests").select("buddy_payout_ngn").eq("status", "completed").limit(500),
    // revenue this month (client price on paid+ this month)
    db.from("requests").select("client_price_ngn, created_at").gte("created_at", monthStart).in("status", ["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed", "paid_out"]).limit(1000),
    // funds held (paid but not yet completed/paid_out)
    db.from("requests").select("client_price_ngn").in("status", ["paid", "assigned", "in_progress", "proof_ready", "proof_approved"]).limit(1000),
    // recent requests
    db.from("requests").select("id, title, status, client_price_ngn, created_at, profiles!requests_client_id_fkey(full_name)").order("created_at", { ascending: false }).limit(8),
    // 7-day trend
    db.from("requests").select("created_at").gte("created_at", sevenAgo.toISOString()).limit(2000),
    // open disputes preview
    db.from("requests").select("id, title, created_at").eq("status", "disputed").order("created_at", { ascending: false }).limit(5),
  ]);

  const sum = (rows: any[] | null, f: string) => (rows ?? []).reduce((s, r) => s + (Number(r[f]) || 0), 0);

  // Build a 7-day trend array (counts per day).
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-GB", { weekday: "short" });
    const count = (trendRows.data ?? []).filter((r: any) => (r.created_at || "").slice(0, 10) === key).length;
    days.push({ label, count });
  }

  return {
    kpis: { awaitingQuote, awaitingPay, inExecution, proofToReview, disputed, completedAll },
    supply: { buddiesApproved, buddiesReview, recruitsNew, recruitsApplied },
    money: {
      heldNgn: sum(heldRows.data, "client_price_ngn"),
      monthRevenueNgn: sum(monthRevenueRows.data, "client_price_ngn"),
      payoutDueNgn: sum(payoutQueueRows.data, "buddy_payout_ngn"),
    },
    recent: recentReqRows.data ?? [],
    trend: days,
    disputes: openDisputeRows.data ?? [],
  };
}
