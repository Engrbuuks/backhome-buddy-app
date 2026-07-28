"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

const EARNED_STATUSES = ["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed", "paid_out"];

export type AccountingSummary = {
  revenue: number;         // service revenue only (money actually earned)
  purchases: number;       // passthrough purchases (client's money spent for them)
  grossCollected: number;  // total client payments (revenue + purchases)
  payouts: number;         // amount paid out to buddies (actually released)
  payoutsDue: number;      // owed to buddies but not yet released
  net: number;             // revenue − payouts (your profit)
  count: number;           // number of earning tasks in the window
};

/** Accounting figures for a date window (by request creation date). */
export async function getAccounting(startISO?: string, endISO?: string): Promise<AccountingSummary> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") {
    return { revenue: 0, purchases: 0, grossCollected: 0, payouts: 0, payoutsDue: 0, net: 0, count: 0 };
  }
  const db = createAdminClient();

  let rq = db.from("requests")
    .select("client_price_ngn, service_revenue_ngn, buddy_payout_ngn, status, created_at")
    .in("status", EARNED_STATUSES);
  if (startISO) rq = rq.gte("created_at", startISO);
  if (endISO) rq = rq.lte("created_at", endISO);
  const { data: reqs } = await rq.limit(5000);
  const rows = reqs ?? [];

  let revenue = 0, gross = 0, purchases = 0, payoutsDue = 0, count = 0;
  for (const r of rows) {
    const client = Number(r.client_price_ngn || 0);
    // service_revenue_ngn is the true earned revenue; fall back to client price
    // for legacy rows that predate the split.
    const svc = r.service_revenue_ngn != null ? Number(r.service_revenue_ngn) : client;
    gross += client;
    revenue += svc;
    purchases += Math.max(0, client - svc);
    if (r.status !== "paid_out") payoutsDue += Number(r.buddy_payout_ngn || 0);
    count++;
  }

  // Actual payouts released in the window (from the payouts ledger).
  let pq = db.from("payouts").select("amount_ngn, created_at, status").eq("status", "paid");
  if (startISO) pq = pq.gte("created_at", startISO);
  if (endISO) pq = pq.lte("created_at", endISO);
  const { data: payoutRows } = await pq.limit(5000);
  const payouts = (payoutRows ?? []).reduce((s, x: any) => s + Number(x.amount_ngn || 0), 0);

  return {
    revenue,
    purchases,
    grossCollected: gross,
    payouts,
    payoutsDue,
    net: revenue - payouts,
    count,
  };
}
