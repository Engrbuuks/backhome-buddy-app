"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { notify, notifyAdmins } from "@/lib/notifications/notify";

/**
 * Move a request, but only if it is still where we read it.
 *
 * Same reasoning as `transition` in admin/workflow-actions.ts: a read followed
 * by an unconditional write lets two admins both pass their checks and both
 * write, so the same held payment can be paid out and refunded. Returns false
 * when somebody else got there first, and writes no timeline row in that case.
 */
async function move(db: any, req: any, to: string, actorId: string, note: string): Promise<boolean> {
  const from = req.status;
  const { data: changed } = await db
    .from("requests")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("status", from)
    .select("id");
  if (!changed || changed.length === 0) return false;
  await db.from("request_timeline").insert({ request_id: req.id, from_status: from, to_status: to, actor_id: actorId, note });
  req.status = to;
  return true;
}

const RACED = "This request was changed by someone else a moment ago. Reload and try again.";

/** Client cancels. submitted/quoted = clean; paid/assigned = cancelled, refund pending.
 *
 *  `reason` is optional and free text. It used to be absent entirely, which
 *  meant an admin opened the refund queue knowing a client had walked away but
 *  never why. */
export async function cancelRequest(requestId: string, reason?: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_id").eq("id", requestId).single();
  if (!req || req.client_id !== p.id) return { error: "Request not found." };
  if (!canTransition(req.status, "cancelled")) return { error: `Cannot cancel from "${req.status}". Raise an issue instead.` };
  const refundPending = ["paid", "assigned"].includes(req.status);
  const why = String(reason || "").trim().slice(0, 300);
  const base = refundPending ? "Client cancelled — refund pending" : "Client cancelled";
  if (!(await move(db, req, "cancelled", p.id, why ? `${base}: ${why}` : base))) return { error: RACED };
  if (refundPending) await notifyAdmins("Cancellation — refund pending", "A paid request was cancelled. Process the refund.", "/admin/refunds");
  revalidatePath(`/client/requests/${requestId}`);
  return { error: "" };
}

/** Client raises a dispute on in-flight/finished work. */
export async function raiseDispute(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  const requestId = String(formData.get("request_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "Describe the issue." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_id").eq("id", requestId).single();
  if (!req || req.client_id !== p.id) return { error: "Request not found." };
  if (!canTransition(req.status, "disputed")) return { error: `Cannot dispute from "${req.status}".` };
  await db.from("disputes").insert({ request_id: req.id, raised_by: p.id, reason });
  if (!(await move(db, req, "disputed", p.id, "Client raised an issue"))) return { error: RACED };
  await notifyAdmins("Dispute raised", reason.slice(0, 140), "/admin/disputes");
  revalidatePath(`/client/requests/${requestId}`);
  return { error: "", saved: true };
}

/**
 * Admin records a manual refund. cancelled/disputed → refunded; funds released back.
 *
 * `amountNgn` makes a PARTIAL refund possible, which is what the non
 * refundable amount needs: the client gets part of the payment back and the
 * rest is retained. Called with no amount, the behaviour is unchanged from
 * before — except that an approved refund request now supplies the figure, so
 * the admin does not have to retype it and cannot mistype it.
 */
export async function recordManualRefund(requestId: string, amountNgn?: number) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!canTransition(req.status, "refunded")) return { error: `Cannot refund from "${req.status}".` };
  const { data: pay } = await db.from("payments").select("id, amount_ngn, funds_held").eq("request_id", req.id).eq("status", "succeeded").single();
  if (!pay) return { error: "No succeeded payment to refund." };
  if (!pay.funds_held) return { error: "Funds already released — refund not possible from held funds." };

  const paid = Number(pay.amount_ngn);

  // Where the amount comes from, in order of authority: what the caller said,
  // then what an approved refund request decided, then the whole payment.
  let amount = paid;
  let approvedId: string | null = null;
  if (amountNgn != null) {
    amount = Math.round(Number(amountNgn) * 100) / 100;
  } else {
    try {
      const { data: rr } = await db.from("refund_requests")
        .select("id, refunded_ngn").eq("request_id", req.id).eq("status", "approved")
        .order("decided_at", { ascending: false }).limit(1).maybeSingle();
      if (rr?.refunded_ngn != null) { amount = Number(rr.refunded_ngn); approvedId = rr.id; }
    } catch { /* table not migrated yet — fall back to the full amount */ }
  }

  if (!Number.isFinite(amount) || amount <= 0) return { error: "The refund amount must be greater than zero." };
  if (amount > paid) return { error: `A refund cannot exceed the ${paid} paid.` };

  const partial = amount < paid;
  const retained = Math.round((paid - amount) * 100) / 100;

  // CLAIM THE REQUEST FIRST, before any money row is written. If a payout
  // release is happening in the same moment, exactly one of us wins the
  // status, and the loser stops here having written nothing.
  const fromStatus = req.status;
  if (!(await move(db, req, "refunded", p.id, partial ? `Client partially refunded (manual transfer) — ${retained} retained` : "Client refunded (manual transfer)"))) {
    return { error: RACED };
  }

  const giveBackClaim = async () => {
    await db.from("requests").update({ status: fromStatus }).eq("id", req.id).eq("status", "refunded");
    req.status = fromStatus;
  };

  const { data: refRow, error: rErr } = await db.from("refunds").insert({
    payment_id: pay.id, request_id: req.id, amount_ngn: amount,
    // The unsuffixed reference is kept for a full refund so the existing
    // "already recorded" guard still catches a double click. A partial gets a
    // distinct reference because the column is unique.
    provider_reference: partial ? `manual-refund-${req.id}-p${Math.round(amount)}` : `manual-refund-${req.id}`,
    status: "succeeded",
    reason: partial ? `Partial refund (bank transfer) — ${retained} retained` : "Manual refund (bank transfer)",
  }).select("id").single();
  if (rErr) {
    await giveBackClaim();
    return { error: rErr.message.includes("duplicate") ? "Refund already recorded." : rErr.message };
  }

  await db.from("payments").update({ funds_held: false, status: partial ? "partial_refund" : "refunded" }).eq("id", pay.id);
  await db.from("transactions").insert({ kind: "refund", request_id: req.id, payment_id: pay.id, refund_id: refRow?.id ?? null, amount_ngn: -amount, note: partial ? `Partial refund to client — ${retained} retained` : "Manual refund to client" });
  await db.from("audit_log").insert({ actor_id: p.id, action: "record_manual_refund", target_id: req.id, detail: { amount_ngn: amount, retained_ngn: retained, paid_ngn: paid, refund_request_id: approvedId } });
  const { data: r5 } = await db.from("requests").select("client_id").eq("id", req.id).single();
  if (r5) await notify(r5.client_id, "Refund sent", partial ? "Your refund has been sent to you." : "Your refund has been sent to you.", `/client/requests/${req.id}`);
  revalidatePath("/admin/refunds"); revalidatePath("/admin/disputes");
  return { error: "" };
}

/** Admin resolves a dispute: refund client / release to buddy / resume work. */
export async function resolveDispute(disputeId: string, outcome: "refund" | "release" | "resume") {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: d } = await db.from("disputes").select("id, request_id, status").eq("id", disputeId).single();
  if (!d || d.status !== "open") return { error: "Dispute not found or already resolved." };
  const { data: req } = await db.from("requests").select("id, status").eq("id", d.request_id).single();
  if (!req || req.status !== "disputed") return { error: "Request is not in disputed state." };

  if (outcome === "refund") {
    const r = await recordManualRefund(req.id);
    if (r.error) return r;
  } else if (outcome === "release") {
    // Conditional, and it sets updated_at: the old version wrote the status
    // blind and left updated_at stale, so a dispute-released task sorted to
    // the wrong end of the payout queue, which orders by that column.
    const { data: ok } = await db.from("requests")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", req.id).eq("status", "disputed").select("id");
    if (!ok || ok.length === 0) return { error: RACED };
    await db.from("request_timeline").insert({ request_id: req.id, from_status: "disputed", to_status: "completed", actor_id: p.id, note: "Dispute resolved in buddy's favour — payout eligible" });
  } else {
    if (!(await move(db, req, "in_progress", p.id, "Dispute resolved — work resumes"))) return { error: RACED };
  }
  await db.from("disputes").update({ status: "resolved", resolved_outcome: outcome, resolution: `Resolved: ${outcome}`, resolved_at: new Date().toISOString() }).eq("id", d.id);
  await db.from("audit_log").insert({ actor_id: p.id, action: "resolve_dispute", target_id: req.id, detail: { outcome } });
  const { data: r6 } = await db.from("requests").select("client_id, assigned_buddy_id, title").eq("id", req.id).single();
  if (r6) {
    const msg = outcome === "refund" ? "resolved with a refund to you" : outcome === "release" ? "resolved — work accepted" : "resolved — work resumes";
    await notify(r6.client_id, "Dispute resolved", `Your issue on "${r6.title}" was ${msg}.`, `/client/requests/${req.id}`, "dispute_resolved");
    if (r6.assigned_buddy_id) await notify(r6.assigned_buddy_id, "Dispute resolved", `Outcome: ${outcome}.`, `/buddy/tasks/${req.id}`, "dispute_resolved");
  }
  revalidatePath("/admin/disputes"); revalidatePath("/admin/payouts");
  return { error: "" };
}

export async function listRefundQueue() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return [];
  const db = createAdminClient();
  const { data } = await db.from("requests")
    .select("id, title, status, client_price_ngn, created_at, profiles!requests_client_id_fkey(full_name)")
    .in("status", ["cancelled"]).order("updated_at", { ascending: true }).limit(100);
  // only those with held funds
  const out: any[] = [];
  for (const r of data ?? []) {
    const { data: pay } = await db.from("payments").select("id, funds_held").eq("request_id", r.id).eq("funds_held", true).limit(1);
    if ((pay ?? []).length) out.push(r);
  }
  return out;
}

export async function listOpenDisputes() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return [];
  const db = createAdminClient();
  const { data } = await db.from("disputes")
    .select("id, reason, created_at, requests(id, title, status, client_price_ngn)")
    .eq("status", "open").order("created_at", { ascending: true }).limit(100);
  return data ?? [];
}
