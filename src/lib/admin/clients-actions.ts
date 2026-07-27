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

export type ClientDetail = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  requests: Array<{ id: string; title: string | null; status: string; client_price_ngn: number | null; created_at: string }>;
  stats: { total: number; paid: number; totalSpendNgn: number; lastRequestAt: string | null };
  /** Why this client counts as "stalled", if at all. */
  stalled: null | { kind: "never_requested" | "quote_not_paid" | "lapsed"; label: string };
};

/** Full detail for one client: profile + every request + a stalled diagnosis. */
export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const db = createAdminClient();

  const { data: c } = await db.from("profiles")
    .select("id, full_name, email, phone, created_at, role")
    .eq("id", clientId).maybeSingle();
  if (!c || (c as any).role !== "client") return null;

  const { data: reqs } = await db.from("requests")
    .select("id, title, status, client_price_ngn, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  const requests = (reqs ?? []) as any[];

  const paidStatuses = ["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed", "paid_out"];
  const paid = requests.filter((r) => paidStatuses.includes(r.status));
  const totalSpendNgn = paid.reduce((s, r) => s + (Number(r.client_price_ngn) || 0), 0);
  const lastRequestAt = requests[0]?.created_at ?? null;

  const stalled = diagnoseStalled(requests, (c as any).created_at);

  return {
    id: (c as any).id, full_name: (c as any).full_name, email: (c as any).email,
    phone: (c as any).phone, created_at: (c as any).created_at,
    requests,
    stats: { total: requests.length, paid: paid.length, totalSpendNgn, lastRequestAt },
    stalled,
  };
}

const DAYS = 86400000;
/** Decide whether a client is "stalled" and why. */
function diagnoseStalled(requests: any[], signedUpAt: string): ClientDetail["stalled"] {
  const now = Date.now();
  const paidStatuses = ["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed", "paid_out"];
  const openQuote = requests.find((r) => ["draft", "submitted", "quoted", "awaiting_pay"].includes(r.status));
  const hasPaid = requests.some((r) => paidStatuses.includes(r.status));

  // 1) Started a request but never paid (strongest intent signal).
  if (openQuote && !hasPaid) {
    const age = (now - new Date(openQuote.created_at).getTime()) / DAYS;
    if (age >= 2) return { kind: "quote_not_paid", label: "Started a request but hasn't paid" };
  }
  // 2) Signed up, never made any request.
  if (requests.length === 0) {
    const age = (now - new Date(signedUpAt).getTime()) / DAYS;
    if (age >= 3) return { kind: "never_requested", label: "Signed up but never made a request" };
  }
  // 3) Made requests before, but nothing recent (lapsed).
  if (hasPaid && requests[0]) {
    const age = (now - new Date(requests[0].created_at).getTime()) / DAYS;
    if (age >= 45) return { kind: "lapsed", label: "Was active, but no requests recently" };
  }
  return null;
}

/** List stalled clients for the re-engagement view, grouped by kind. */
export async function listStalledClients(): Promise<Array<{ id: string; full_name: string | null; email: string | null; kind: string; label: string; signedUpAt: string; lastRequestAt: string | null }>> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return [];
  const db = createAdminClient();

  // Pull recent clients + their requests in two scoped queries (cap for safety).
  const { data: clients } = await db.from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "client").order("created_at", { ascending: false }).limit(500);
  const ids = (clients ?? []).map((c: any) => c.id);
  if (!ids.length) return [];
  const { data: reqs } = await db.from("requests")
    .select("client_id, status, created_at").in("client_id", ids).limit(5000);
  const byClient = new Map<string, any[]>();
  for (const r of reqs ?? []) {
    const arr = byClient.get((r as any).client_id) ?? [];
    arr.push(r); byClient.set((r as any).client_id, arr);
  }

  const out: any[] = [];
  for (const c of clients ?? []) {
    const rs = (byClient.get((c as any).id) ?? []).sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    const d = diagnoseStalled(rs, (c as any).created_at);
    if (d) out.push({
      id: (c as any).id, full_name: (c as any).full_name, email: (c as any).email,
      kind: d.kind, label: d.label, signedUpAt: (c as any).created_at,
      lastRequestAt: rs[0]?.created_at ?? null,
    });
  }
  return out;
}

/** AI-draft a warm, non-pushy re-engagement email for one stalled client. */
export async function draftReengagementEmail(clientId: string): Promise<{ subject?: string; body?: string; error?: string }> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const detail = await getClientDetail(clientId);
  if (!detail) return { error: "Client not found." };

  const { aiGenerate } = await import("@/lib/support/ai");
  const context = detail.stalled?.kind === "quote_not_paid"
    ? "This client started a request but never completed payment. Gently offer to help them finish, and ask if anything held them back (price, trust, questions)."
    : detail.stalled?.kind === "lapsed"
    ? "This client used the service before but hasn't in a while. Warmly check in, thank them, and invite them back."
    : "This client signed up but never made a request. Warmly encourage them to try their first task, and offer to help them get started.";

  const system = "You write short, warm, human re-engagement emails for Backhome Buddy, a service that helps Nigerians abroad get tasks done back home (welfare checks on family, property verification, documents, errands) with vetted people and photo/video proof. Tone: caring, respectful, never pushy or salesy. No hype, no emoji. 90–130 words. Return ONLY the email body — no subject line, no preamble.";
  const user = `Client name: ${detail.full_name || "there"}\nSituation: ${context}\nWrite the email body. Open with their first name if available. End warmly, signed "The Backhome Buddy team".`;

  const res = await aiGenerate(system, user);
  if (res.error) return { error: res.error };
  const subject = detail.stalled?.kind === "quote_not_paid"
    ? "Can we help you finish your request?"
    : detail.stalled?.kind === "lapsed"
    ? "We're here whenever you need us back home"
    : "Getting started with Backhome Buddy";
  return { subject, body: (res.text || "").trim() };
}

/** Bulk: draft + send a re-engagement email to many stalled clients at once.
 *  Each email is individually AI-drafted for that client's situation. Returns a
 *  per-client result summary. */
export async function bulkReengage(clientIds: string[]): Promise<{ sent: number; failed: number; results: Array<{ id: string; ok: boolean; note: string }> }> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { sent: 0, failed: 0, results: [] };
  const results: Array<{ id: string; ok: boolean; note: string }> = [];
  let sent = 0, failed = 0;
  // Cap to protect against accidental huge sends.
  for (const id of clientIds.slice(0, 100)) {
    const draft = await draftReengagementEmail(id);
    if (draft.error || !draft.body) { failed++; results.push({ id, ok: false, note: draft.error || "Draft failed" }); continue; }
    const res = await sendReengagementEmail(id, draft.subject || "A note from Backhome Buddy", draft.body);
    if (res.error) { failed++; results.push({ id, ok: false, note: res.error }); }
    else { sent++; results.push({ id, ok: true, note: "Sent" }); }
  }
  return { sent, failed, results };
}
export async function sendReengagementEmail(clientId: string, subject: string, body: string): Promise<{ error: string }> {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  if (!subject.trim() || !body.trim()) return { error: "Subject and message are required." };
  const db = createAdminClient();
  const { data: c } = await db.from("profiles").select("email, full_name").eq("id", clientId).maybeSingle();
  if (!c || !(c as any).email) return { error: "Client has no email on file." };

  const { sendEmailPublic } = await import("@/lib/notifications/notify");
  const r = await sendEmailPublic((c as any).email, subject.trim(), body.trim());
  if (r?.error) return { error: r.error };
  await db.from("audit_log").insert({ actor_id: p.id, action: "reengagement_email_sent", detail: { client_id: clientId, subject } });
  return { error: "" };
}
