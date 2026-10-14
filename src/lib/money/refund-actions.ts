"use server";
/**
 * Client initiated refunds.
 *
 * SECURITY: every export in this file is a callable HTTP endpoint. Each one
 * establishes who is calling before it touches anything, and the client facing
 * actions never accept an amount — the money is always computed server side
 * from the stored policy and the stored payment. A client can say why they
 * want a refund; they can never say how much.
 *
 * The flow, end to end:
 *
 *   client presses Request a refund
 *     -> requestRefund() writes a refund_requests row with the computed figures
 *     -> if no buddy was ever assigned and auto approve is on, it is approved
 *        on the spot for the full amount
 *     -> otherwise an admin decides, attributing fault, which can waive the
 *        non refundable amount entirely
 *   approval parks the request awaiting the bank transfer
 *     -> an admin transfers the money and presses Record refund sent
 *     -> recordManualRefund() in ./edge-actions.ts closes it out
 *
 * Nothing in here moves money. Approving a refund is a decision; sending it is
 * a separate, deliberate act by a human. The client is never told "refund sent"
 * until somebody has actually sent it.
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { notify, notifyAdmins, notifyInApp } from "@/lib/notifications/notify";
import {
  computeRetention, parseRefundPolicy, policySummary, canRequestRefund,
  REFUND_REASONS, DEFAULT_REFUND_POLICY,
  type Fault, type RefundPolicy, type RefundQuote,
} from "@/lib/money/refund-policy";

const POLICY_KEY = "refund_policy";

/* ------------------------------------------------------------------ *
 * Private helpers. Not exported, so not endpoints.
 * ------------------------------------------------------------------ */

async function loadPolicy(db: any): Promise<RefundPolicy> {
  try {
    const { data } = await db.from("app_settings").select("value").eq("key", POLICY_KEY).maybeSingle();
    return parseRefundPolicy(data?.value);
  } catch {
    // A database that has not had 0042 run yet must still be able to quote.
    return DEFAULT_REFUND_POLICY;
  }
}

/** The succeeded, still held payment behind a request, or null. */
async function heldPayment(db: any, requestId: string) {
  const { data } = await db
    .from("payments")
    .select("id, amount_ngn, funds_held, status")
    .eq("request_id", requestId)
    .eq("status", "succeeded")
    .maybeSingle();
  return data ?? null;
}

/** Detects a database that has not had migration 0042 applied. */
function missingTable(error: any): boolean {
  const m = String(error?.message ?? error ?? "");
  return /refund_requests/i.test(m) && /(does not exist|not find|schema cache)/i.test(m);
}

/* ------------------------------------------------------------------ *
 * Client surface
 * ------------------------------------------------------------------ */

/**
 * What would happen if this client asked for a refund right now.
 *
 * Quoted WITHOUT a fault, which means it shows the worst case the client could
 * face. That is the honest number to put in front of somebody before they press
 * a button: a human review can only improve it, never worsen it.
 */
export async function quoteRefund(requestId: string): Promise<RefundQuote> {
  const empty = (reason: string, enabled = true): RefundQuote => ({
    enabled, available: false, reason, paid_ngn: 0, refundable_ngn: 0, retained_ngn: 0,
    basis: "", rules: [], reasons: REFUND_REASONS, openRequest: null, lastDecision: null,
  });

  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return empty("Not authorized.", false);

  const db = createAdminClient();
  const { data: req } = await db
    .from("requests").select("id, status, client_id").eq("id", requestId).maybeSingle();
  if (!req || req.client_id !== p.id) return empty("Request not found.", false);

  const policy = await loadPolicy(db);
  if (!policy.enabled) return empty("Refund requests are not available at the moment.", false);

  // If the table is not there, say so rather than offering a button that will
  // fail. The page then falls back to the older cancel route.
  try {
    const { error: probe } = await db.from("refund_requests").select("id").limit(1);
    if (probe && missingTable(probe)) return empty("Refund requests are not switched on yet.", false);
  } catch (e) {
    if (missingTable(e)) return empty("Refund requests are not switched on yet.", false);
  }
  if (!canRequestRefund(req.status)) {
    return empty(
      req.status === "refunded" ? "This request has already been refunded."
      : req.status === "paid_out" ? "This task is closed and the buddy has been paid. Contact support if something is wrong."
      : req.status === "disputed" ? "There is already an open issue on this request."
      : "There is no payment on this request yet.",
    );
  }

  const pay = await heldPayment(db, req.id);
  if (!pay) return empty("No completed payment was found on this request.");
  if (!pay.funds_held) return empty("The funds on this request have already been released. Contact support.");

  const paid = Number(pay.amount_ngn || 0);
  const r = computeRetention(req.status, paid, policy);

  // Existing requests, if the table is there.
  let openRequest: RefundQuote["openRequest"] = null;
  let lastDecision: RefundQuote["lastDecision"] = null;
  try {
    const { data: rows } = await db
      .from("refund_requests")
      .select("id, status, reason, created_at, refunded_ngn, retained_ngn, decision_note, decided_at")
      .eq("request_id", req.id)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of rows ?? []) {
      if (row.status === "open" && !openRequest) {
        openRequest = { id: row.id, created_at: row.created_at, reason: row.reason };
      }
      if ((row.status === "approved" || row.status === "declined") && !lastDecision) {
        lastDecision = {
          status: row.status, refunded_ngn: row.refunded_ngn, retained_ngn: row.retained_ngn,
          decision_note: row.decision_note, decided_at: row.decided_at,
        };
      }
    }
  } catch { /* table not migrated yet — still quote, just without history */ }

  return {
    enabled: true,
    available: !openRequest,
    reason: openRequest ? "You already have a refund request open on this task." : "",
    paid_ngn: paid,
    refundable_ngn: r.refundable_ngn,
    retained_ngn: r.retained_ngn,
    basis: r.basis,
    rules: policySummary(policy),
    reasons: REFUND_REASONS,
    openRequest,
    lastDecision,
  };
}

/**
 * The client asks for their money back.
 *
 * Takes a reason and nothing else. Every figure is recomputed here from the
 * stored payment and the stored policy, so a tampered form cannot change what
 * is owed.
 */
export async function requestRefund(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };

  const requestId = String(formData.get("request_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  const reasonCode = String(formData.get("reason_code") || "other").trim() || "other";
  if (!requestId) return { error: "Request not found." };
  if (reason.length < 5) return { error: "Please tell us briefly why, so we can sort it out properly." };
  if (!REFUND_REASONS.some(([k]) => k === reasonCode)) return { error: "Pick a reason from the list." };

  const db = createAdminClient();
  const { data: req } = await db
    .from("requests").select("id, status, client_id, title, assigned_buddy_id").eq("id", requestId).maybeSingle();
  if (!req || req.client_id !== p.id) return { error: "Request not found." };

  const policy = await loadPolicy(db);
  if (!policy.enabled) return { error: "Refund requests are not available at the moment." };
  if (!canRequestRefund(req.status)) return { error: `A refund cannot be requested from "${req.status}".` };

  const pay = await heldPayment(db, req.id);
  if (!pay) return { error: "No completed payment was found on this request." };
  if (!pay.funds_held) return { error: "The funds on this request have already been released. Contact support." };

  const paid = Number(pay.amount_ngn || 0);
  const quoted = computeRetention(req.status, paid, policy);

  // Auto approval only where rule 1 says nothing can be retained anyway: no
  // buddy has ever committed, so there is no judgement for a human to make.
  const autoApprove =
    policy.auto_approve_unassigned && quoted.pre_assignment && !req.assigned_buddy_id;

  const row: Record<string, any> = {
    request_id: req.id,
    raised_by: p.id,
    reason,
    reason_code: reasonCode,
    status: "open",
    request_status_at_request: req.status,
    paid_ngn: paid,
    policy_retained_ngn: quoted.retained_ngn,
    policy_basis: quoted.basis,
  };

  const { data: inserted, error: insErr } = await db
    .from("refund_requests").insert(row).select("id").single();

  if (insErr) {
    if (missingTable(insErr)) {
      return { error: "Refund requests are not switched on yet. Run migration 0042 in Supabase." };
    }
    if (String(insErr.message).includes("duplicate") || String(insErr.code) === "23505") {
      return { error: "You already have a refund request open on this task." };
    }
    return { error: insErr.message };
  }

  await db.from("request_timeline").insert({
    request_id: req.id, from_status: req.status, to_status: req.status,
    actor_id: p.id, note: `Client requested a refund: ${reason.slice(0, 180)}`,
  });

  if (autoApprove) {
    const done = await applyApproval(db, {
      refundRequestId: inserted.id,
      request: req,
      paidNgn: paid,
      retained: 0,
      refunded: paid,
      fault: null,
      note: "Approved automatically: no buddy had been assigned.",
      actorId: p.id,
      auto: true,
    });
    if (done.error) return { error: done.error };
    revalidatePath(`/client/requests/${requestId}`);
    return { error: "", saved: true, autoApproved: true, refunded: paid };
  }

  // A buddy who is mid task should know the client wants out, before they spend
  // another naira of their own money on it.
  if (req.assigned_buddy_id) {
    await notifyInApp(
      req.assigned_buddy_id,
      "Client has asked for a refund",
      `The client on "${req.title}" has requested a refund. Hold off on further spending until we come back to you.`,
      `/buddy/tasks/${req.id}`,
    );
  }

  await notifyAdmins(
    "Refund requested",
    `${reason.slice(0, 140)} — ${req.title}. Policy would retain ₦${Math.round(quoted.retained_ngn).toLocaleString("en-NG")}.`,
    "/admin/refunds",
  );

  revalidatePath(`/client/requests/${requestId}`);
  return { error: "", saved: true, autoApproved: false };
}

/** A client changes their mind about changing their mind. */
export async function withdrawRefundRequest(refundRequestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: rr } = await db
    .from("refund_requests").select("id, request_id, raised_by, status").eq("id", refundRequestId).maybeSingle();
  if (!rr || rr.raised_by !== p.id) return { error: "Refund request not found." };
  if (rr.status !== "open") return { error: "This refund request has already been decided." };
  await db.from("refund_requests").update({ status: "withdrawn", decided_at: new Date().toISOString() }).eq("id", rr.id);
  await db.from("request_timeline").insert({
    request_id: rr.request_id, from_status: "", to_status: "",
    actor_id: p.id, note: "Client withdrew their refund request",
  });
  revalidatePath(`/client/requests/${rr.request_id}`);
  return { error: "" };
}

/* ------------------------------------------------------------------ *
 * Admin surface
 * ------------------------------------------------------------------ */

export async function listRefundRequests(status: string = "open") {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { rows: [], migrationMissing: false };
  const db = createAdminClient();
  try {
    let q = db
      .from("refund_requests")
      .select("*, requests(id, title, status, client_price_ngn, assigned_buddy_id), profiles!refund_requests_raised_by_fkey(full_name, email)")
      .order("created_at", { ascending: true })
      .limit(200);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      if (missingTable(error)) return { rows: [], migrationMissing: true };
      return { rows: [], migrationMissing: false };
    }
    return { rows: data ?? [], migrationMissing: false };
  } catch (e) {
    return { rows: [], migrationMissing: missingTable(e) };
  }
}

/**
 * The admin decides.
 *
 * `fault` drives the arithmetic: ours or the buddy's waives the non refundable
 * amount entirely, whatever stage the task had reached. `amountOverride` lets a
 * human depart from the computed figure, and both numbers are stored so the
 * departure is visible later.
 */
export async function decideRefundRequest(
  refundRequestId: string,
  decision: "approve" | "decline",
  opts: { fault?: Fault | null; amountOverride?: number | null; note?: string } = {},
) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();

  const { data: rr } = await db
    .from("refund_requests").select("*").eq("id", refundRequestId).maybeSingle();
  if (!rr) return { error: "Refund request not found." };
  if (rr.status !== "open") return { error: "This refund request has already been decided." };

  const { data: req } = await db
    .from("requests").select("id, status, client_id, title, assigned_buddy_id").eq("id", rr.request_id).maybeSingle();
  if (!req) return { error: "Request not found." };

  const note = String(opts.note || "").trim();

  if (decision === "decline") {
    if (!note) return { error: "Give the client a reason for the decline." };
    await db.from("refund_requests").update({
      status: "declined", fault: opts.fault ?? null, retained_ngn: null, refunded_ngn: 0,
      decision_note: note, decided_by: p.id, decided_at: new Date().toISOString(),
    }).eq("id", rr.id);
    await db.from("audit_log").insert({
      actor_id: p.id, action: "decline_refund_request", target_id: req.id,
      detail: { refund_request_id: rr.id, note },
    });
    await notify(req.client_id, "Refund request declined",
      `Your refund request on "${req.title}" was not approved. ${note}`,
      `/client/requests/${req.id}`, "refund_decision");
    revalidatePath("/admin/refunds");
    revalidatePath(`/client/requests/${req.id}`);
    return { error: "" };
  }

  // Approve. Recompute from the CURRENT status and the CURRENT policy rather
  // than trusting the snapshot: the task may have moved on since the client
  // asked, and the live position is the fair one.
  const pay = await heldPayment(db, req.id);
  if (!pay) return { error: "No completed payment to refund." };
  if (!pay.funds_held) return { error: "Funds already released — this can no longer be refunded from held funds." };

  const paid = Number(pay.amount_ngn || 0);
  const policy = await loadPolicy(db);
  const computed = computeRetention(req.status, paid, policy, opts.fault ?? null);

  let refunded = computed.refundable_ngn;
  let retained = computed.retained_ngn;

  if (opts.amountOverride != null) {
    const amt = Number(opts.amountOverride);
    if (!Number.isFinite(amt) || amt < 0) return { error: "The refund amount is not a valid number." };
    if (amt > paid) return { error: `A refund cannot exceed the ₦${Math.round(paid).toLocaleString("en-NG")} that was paid.` };
    refunded = Math.round(amt * 100) / 100;
    retained = Math.round((paid - refunded) * 100) / 100;
  }

  if (refunded <= 0) {
    return { error: "This approval refunds nothing. Decline it instead, with a reason, so the client is told why." };
  }

  const applied = await applyApproval(db, {
    refundRequestId: rr.id,
    request: req,
    paidNgn: paid,
    retained,
    refunded,
    fault: opts.fault ?? null,
    note: note || computed.basis,
    actorId: p.id,
    auto: false,
  });
  if (applied.error) return { error: applied.error };

  revalidatePath("/admin/refunds");
  revalidatePath(`/client/requests/${req.id}`);
  return { error: "" };
}

/**
 * Everything an approval does, shared by the automatic and the human path.
 *
 * Moves the request along a transition the state machine already allows rather
 * than inventing one: pre assignment goes to cancelled, work in flight goes to
 * disputed, and recordManualRefund takes either of those to refunded once the
 * money has actually been transferred.
 */
async function applyApproval(db: any, a: {
  refundRequestId: string;
  request: { id: string; status: string; client_id: string; title: string; assigned_buddy_id?: string | null };
  paidNgn: number;
  retained: number;
  refunded: number;
  fault: Fault | null;
  note: string;
  actorId: string;
  auto: boolean;
}): Promise<{ error: string }> {
  const { request: req } = a;

  // Pick the legal route to a state where a refund can be recorded.
  const target = canTransition(req.status as any, "cancelled" as any)
    ? "cancelled"
    : canTransition(req.status as any, "disputed" as any)
      ? "disputed"
      : null;

  if (!target) return { error: `A refund cannot be approved from "${req.status}".` };

  await db.from("refund_requests").update({
    status: "approved",
    fault: a.fault,
    retained_ngn: a.retained,
    refunded_ngn: a.refunded,
    decision_note: a.note,
    decided_by: a.actorId,
    decided_at: new Date().toISOString(),
    auto_approved: a.auto,
  }).eq("id", a.refundRequestId);

  await db.from("requests").update({ status: target, updated_at: new Date().toISOString() }).eq("id", req.id);
  await db.from("request_timeline").insert({
    request_id: req.id, from_status: req.status, to_status: target, actor_id: a.actorId,
    note: a.auto
      ? `Refund approved automatically — ₦${fmt(a.refunded)} to be returned`
      : `Refund approved — ₦${fmt(a.refunded)} to be returned, ₦${fmt(a.retained)} retained`,
  });

  await db.from("audit_log").insert({
    actor_id: a.actorId, action: a.auto ? "auto_approve_refund_request" : "approve_refund_request",
    target_id: req.id,
    detail: { refund_request_id: a.refundRequestId, paid_ngn: a.paidNgn, refunded_ngn: a.refunded, retained_ngn: a.retained, fault: a.fault },
  });

  // Deliberately does NOT say the money has been sent. It has not.
  const retainedLine = a.retained > 0
    ? ` ₦${fmt(a.retained)} is non refundable at this stage. ${a.note}`
    : "";
  await notify(
    req.client_id,
    "Refund approved",
    `Your refund of ₦${fmt(a.refunded)} on "${req.title}" has been approved and is being processed.${retainedLine}`,
    `/client/requests/${req.id}`,
    "refund_decision",
  );

  if (req.assigned_buddy_id) {
    await notifyInApp(
      req.assigned_buddy_id,
      "Task cancelled — refund approved",
      `"${req.title}" has been refunded to the client. Stop any further work on it.`,
      `/buddy/tasks/${req.id}`,
    );
  }

  await notifyAdmins(
    "Refund approved — transfer still to be made",
    `₦${fmt(a.refunded)} is owed back on "${req.title}". Transfer it, then press Record refund sent.`,
    "/admin/refunds",
  );

  return { error: "" };
}

function fmt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString("en-NG");
}

/* ------------------------------------------------------------------ *
 * Policy editing
 * ------------------------------------------------------------------ */

export async function getRefundPolicy() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const db = createAdminClient();
  return loadPolicy(db);
}

export async function saveRefundPolicy(next: unknown) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  // Parsed, clamped and normalised before it is stored, so nothing unparseable
  // or out of range can ever reach the table.
  const clean = parseRefundPolicy(next);
  const db = createAdminClient();
  const { error } = await db.from("app_settings").upsert({
    key: POLICY_KEY, value: clean as any, updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({
    actor_id: p.id, action: "update_refund_policy", target_id: null, detail: clean as any,
  });
  revalidatePath("/admin/refunds");
  return { error: "", policy: clean };
}
