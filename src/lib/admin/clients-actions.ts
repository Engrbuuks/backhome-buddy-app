"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

export type ClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  requestCount: number;
  totalSpendNgn: number;
  lastRequestAt: string | null;
};

/** Paginated list of client-role users with their signup date and activity.
 *  Efficient: one page of profiles, then one requests query scoped to those ids. */
export async function listClients(page = 1, pageSize = 25): Promise<{ rows: ClientRow[]; total: number }> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { rows: [], total: 0 };
  const db = createAdminClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: profiles, count } = await db
    .from("profiles")
    .select("id, full_name, email, phone, created_at", { count: "exact" })
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows: ClientRow[] = (profiles ?? []).map((c: any) => ({
    id: c.id, full_name: c.full_name, email: c.email, phone: c.phone,
    created_at: c.created_at, requestCount: 0, totalSpendNgn: 0, lastRequestAt: null,
  }));

  // Enrich with activity for just these clients (one scoped query).
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    const { data: reqs } = await db
      .from("requests")
      .select("client_id, client_price_ngn, created_at, status")
      .in("client_id", ids)
      .limit(5000);
    const byClient = new Map<string, ClientRow>(rows.map((r) => [r.id, r]));
    for (const req of reqs ?? []) {
      const row = byClient.get((req as any).client_id);
      if (!row) continue;
      row.requestCount += 1;
      // Count spend only on paid-through statuses.
      if (["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed", "paid_out"].includes((req as any).status)) {
        row.totalSpendNgn += Number((req as any).client_price_ngn) || 0;
      }
      const t = (req as any).created_at as string;
      if (!row.lastRequestAt || t > row.lastRequestAt) row.lastRequestAt = t;
    }
  }

  return { rows, total: count ?? 0 };
}

/** Quick totals for the clients page header. */
export async function getClientTotals() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { total: 0, thisMonth: 0 };
  const db = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ count: total }, { count: thisMonth }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client").gte("created_at", monthStart),
  ]);
  return { total: total ?? 0, thisMonth: thisMonth ?? 0 };
}
