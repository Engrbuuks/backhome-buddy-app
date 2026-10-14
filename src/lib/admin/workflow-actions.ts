"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition, isPayoutEligible } from "@/lib/money/stateMachine";
import { notify } from "@/lib/notifications/notify";

async function admin() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  return p;
}
/**
 * Move a request to a new status, but only if it is still where we think.
 *
 * The `.eq("status", req.status)` is the whole point. Without it this was a
 * read, then an unconditional write, with the check happening long before the
 * write and never rechecked. Two admins acting in the same minute — one
 * releasing a payout, one approving a refund — would both pass their checks
 * and both write, paying the buddy and refunding the client out of the same
 * money. The offer system already got this right in migration 0039 with
 * `for update`; the money paths did not.
 *
 * Returns false when somebody else moved it first. No timeline row is written
 * in that case, so history never records a transition that did not happen.
 */
async function transition(db: any, req: any, to: string, actorId: string, note: string): Promise<boolean> {
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

/** The message shown when a conditional move loses the race. */
const RACED = "This task was changed by someone else a moment ago. Reload and try again.";

/** Record an offline payment (bank transfer). quoted → awaiting_pay → paid, funds HELD. */
export async function recordManualPayment(requestId: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_id, client_price_ngn").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!req.client_price_ngn) return { error: "Quote the request first." };
  if (!canTransition(req.status, "awaiting_pay")) return { error: `Cannot record payment from "${req.status}".` };

  const reference = `manual-${requestId}`;
  const { data: payRow, error: payErr } = await db.from("payments").insert({
    request_id: req.id, client_id: req.client_id, provider: "manual",
    provider_reference: reference, amount_ngn: req.client_price_ngn,
    status: "succeeded", funds_held: true,
  }).select("id").single();
  if (payErr) return { error: payErr.message.includes("duplicate") ? "Payment already recorded for this request." : payErr.message };
  // payment_id was always left null, so a ledger row had no identifier of its
  // own. Deleting a request then nulled request_id too and the line became
  // untraceable. Link it.
  await db.from("transactions").insert({ kind: "payment", request_id: req.id, payment_id: payRow?.id ?? null, amount_ngn: req.client_price_ngn, note: "Manual/bank transfer payment" });
  if (!(await transition(db, req, "awaiting_pay", p.id, "Offline payment being recorded"))) return { error: RACED };
  if (!(await transition(db, req, "paid", p.id, "Payment received (bank transfer) — funds held"))) return { error: RACED };
  await db.from("audit_log").insert({ actor_id: p.id, action: "record_manual_payment", target_id: req.id, detail: { amount_ngn: req.client_price_ngn } });
  await notify(req.client_id, "Payment received", "Your payment is confirmed. We hold it against this task and release it to your buddy only after the work is done and you accept the proof. We are assigning your buddy now.", `/client/requests/${req.id}`, "payment_received");

  // Payment is the trigger for the offer cascade. Non-fatal on purpose: if no
  // buddy can be offered the task, the payment is still recorded and the
  // request sits in the admin queue rather than the whole action failing.
  try {
    const { startOffering } = await import("@/lib/offers/actions");
    await startOffering(req.id);
  } catch (e) {
    console.error("startOffering after payment failed:", e);
  }

  revalidatePath(`/admin/requests/${req.id}`); revalidatePath("/admin/requests");
  return { error: "" };
}

export async function listApprovedBuddies() {
  const p = await admin(); if (!p) return [];
  const db = createAdminClient();
  const { data } = await db.from("buddy_profiles").select("id, vetting, skills, state, city, lga, coverage_areas, occupation, availability, profiles!buddy_profiles_id_fkey(full_name, email)").eq("vetting", "approved");
  return data ?? [];
}

/** Assign an approved buddy. paid → assigned. */
export async function assignBuddy(requestId: string, buddyId: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!canTransition(req.status, "assigned")) return { error: `Cannot assign from "${req.status}".` };
  const { data: buddy } = await db.from("buddy_profiles").select("id, vetting").eq("id", buddyId).single();
  if (!buddy || buddy.vetting !== "approved") return { error: "Buddy is not approved." };
  await db.from("requests").update({ assigned_buddy_id: buddyId }).eq("id", req.id);
  if (!(await transition(db, req, "assigned", p.id, "Buddy assigned"))) return { error: RACED };

  // An admin assigning by hand overrides the cascade. Whatever offer was live
  // is no longer meaningful, so retire it rather than leaving a buddy staring
  // at an offer for a task that is already gone.
  try {
    const { supersedePendingOffers } = await import("@/lib/offers/engine");
    await supersedePendingOffers(req.id);
  } catch (e) {
    console.error("supersedePendingOffers failed:", e);
  }
  // Copy the service type's milestone template onto this request (once).
  try {
    const { seedRequestMilestones } = await import("@/lib/requests/milestone-engine");
    await seedRequestMilestones(req.id);
  } catch { /* non-fatal */ }
  await db.from("audit_log").insert({ actor_id: p.id, action: "assign_buddy", target_id: req.id, detail: { buddyId } });
  const { data: r2 } = await db.from("requests").select("client_id, title").eq("id", req.id).single();
  await notify(buddyId, "New task assigned", `You have a new task: "${r2?.title ?? "task"}". Open it to start.`, `/buddy/tasks/${req.id}`, "task_assigned_buddy");
  if (r2) await notify(r2.client_id, "Buddy assigned", "A vetted buddy is now on your request.", `/client/requests/${req.id}`, "buddy_assigned_client");
  revalidatePath(`/admin/requests/${req.id}`); revalidatePath("/admin/requests");
  return { error: "" };
}

/** Review proof. proof_ready → proof_approved (approve) or → in_progress (request changes). */
export async function reviewProof(requestId: string, approve: boolean, note: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  const to = approve ? "proof_approved" : "in_progress";
  if (!canTransition(req.status, to)) return { error: `Cannot ${approve ? "approve" : "return"} from "${req.status}".` };
  if (!(await transition(db, req, to, p.id, approve ? "Proof approved — awaiting client confirmation" : `Changes requested: ${note}`))) return { error: RACED };
  await db.from("audit_log").insert({ actor_id: p.id, action: approve ? "approve_proof" : "request_proof_changes", target_id: req.id, detail: { note } });
  const { data: r3 } = await db.from("requests").select("client_id, assigned_buddy_id, title").eq("id", req.id).single();
  if (r3) {
    if (approve) {
      await notify(r3.client_id, "Proof approved — please confirm", `Review the proof for "${r3.title}" and confirm completion.`, `/client/requests/${req.id}`, "proof_approved_confirm");
      if (r3.assigned_buddy_id) await notify(r3.assigned_buddy_id, "Proof approved", "Awaiting client confirmation — payout follows.", `/buddy/tasks/${req.id}`);
    } else if (r3.assigned_buddy_id) {
      await notify(r3.assigned_buddy_id, "Changes requested", note || "Please revise and resubmit your proof.", `/buddy/tasks/${req.id}`, "changes_requested");
    }
  }
  revalidatePath(`/admin/requests/${req.id}`); revalidatePath("/admin/requests");
  return { error: "" };
}

/** Adjust a buddy's payout on a task that's already past the quoting stage
 *  (e.g. completed). Works two ways:
 *   - Not yet paid out: simply updates the payout amount, so the correct figure
 *     is released when you pay out.
 *   - Already paid out: records a top-up (or claws back) for the DIFFERENCE only,
 *     so the buddy's total received equals the new amount and the ledger stays right.
 */
export async function adjustBuddyPayout(requestId: string, newAmountNgn: number, reason?: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const amount = Math.round(Number(newAmountNgn));
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter a valid payout amount." };
  const db = createAdminClient();

  const { data: req } = await db.from("requests")
    .select("id, status, assigned_buddy_id, buddy_payout_ngn, client_price_ngn").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!req.assigned_buddy_id) return { error: "No buddy is assigned to this task." };

  // Never let the payout meet or exceed what the client paid.
  const clientPrice = Number(req.client_price_ngn ?? 0);
  if (clientPrice > 0 && amount >= clientPrice) {
    return { error: `Payout (${amount.toLocaleString()}) can't be equal to or above the client price (${clientPrice.toLocaleString()}).` };
  }

  const old = Number(req.buddy_payout_ngn ?? 0);
  if (amount === old) return { error: "That's the same as the current payout." };

  // A payout figure only means something on a live task. Without this, the
  // figure could be raised on a cancelled or refunded request and the
  // accounting page would start reporting it as money owed.
  const ADJUSTABLE = ["paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed", "paid_out"];
  if (!ADJUSTABLE.includes(req.status)) {
    return { error: `The payout cannot be adjusted on a "${req.status}" task.` };
  }

  // Always update the stored payout figure.
  await db.from("requests").update({ buddy_payout_ngn: amount }).eq("id", requestId);

  const alreadyPaid = req.status === "paid_out";
  if (alreadyPaid) {
    // Record the difference so the ledger and the buddy's earnings reflect reality.
    const diff = amount - old; // positive = top-up owed to buddy; negative = overpaid
    await db.from("payouts").insert({
      request_id: req.id, buddy_id: req.assigned_buddy_id, provider: "manual",
      provider_reference: `payout-adjust-${req.id}-${Date.now()}`,
      amount_ngn: diff, status: "paid",
    });
    await db.from("transactions").insert({
      kind: "payout", request_id: req.id, amount_ngn: -diff,
      note: `Payout adjustment (${diff >= 0 ? "top-up" : "correction"})${reason ? `: ${reason}` : ""}`,
    });
    if (diff > 0) {
      await notify(req.assigned_buddy_id, "Extra payout sent",
        `We've sent you an additional ${diff.toLocaleString()} for a completed task.`, "/buddy/earnings");
    }
  } else {
    // Not paid out yet — the new amount will simply be used at release time.
    if (amount > old) {
      await notify(req.assigned_buddy_id, "Your payout was increased",
        "Good news — your payout for this task has been increased.", `/buddy/tasks/${req.id}`);
    }
  }

  await db.from("audit_log").insert({
    actor_id: p.id, action: "adjust_buddy_payout", target_id: req.id,
    detail: { from: old, to: amount, already_paid: alreadyPaid, reason: reason || null },
  });
  revalidatePath(`/admin/requests/${req.id}`); revalidatePath("/admin/payouts");
  return { error: "", alreadyPaid, diff: amount - old };
}

/** Record a manual payout (bank transfer you made to the buddy). completed → paid_out. */
export async function releaseManualPayout(requestId: string) {  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests")
    .select("id, status, assigned_buddy_id, buddy_payout_ngn").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!isPayoutEligible(req.status)) return { error: `Payout only from "completed" (client-confirmed). Current: "${req.status}".` };
  if (!req.assigned_buddy_id || !req.buddy_payout_ngn) return { error: "No buddy/payout amount on this request." };
  const { data: bp } = await db.from("buddy_profiles")
    .select("bank_name, bank_account_number, bank_account_name").eq("id", req.assigned_buddy_id).single();
  const hasBank = Boolean(bp?.bank_account_number);
  const method = hasBank ? "bank transfer" : "manual (no bank on file — paid another way)";

  // CLAIM THE REQUEST FIRST, then move money.
  //
  // The old order inserted the payout, released the hold, and only then moved
  // the status. In that window a refund approval reading the same row saw
  // funds still held and passed its own check, so the buddy was paid and the
  // client refunded from one payment. Claiming the status first means exactly
  // one of the two writers wins, and the loser finds the door shut.
  if (!(await transition(db, req, "paid_out", p.id, `Buddy paid out (${method})`))) return { error: RACED };

  const { data: po, error: poErr } = await db.from("payouts").insert({
    request_id: req.id, buddy_id: req.assigned_buddy_id, provider: "manual",
    provider_reference: `manual-payout-${req.id}`, amount_ngn: req.buddy_payout_ngn, status: "paid",
  }).select("id").single();
  if (poErr) {
    // Give the claim back so the task is not stranded in paid_out with no payout.
    await db.from("requests").update({ status: "completed" }).eq("id", req.id).eq("status", "paid_out");
    req.status = "completed";
    return { error: poErr.message.includes("duplicate") ? "Payout already recorded." : poErr.message };
  }
  await db.from("payments").update({ funds_held: false }).eq("request_id", req.id).eq("status", "succeeded");
  await db.from("transactions").insert({ kind: "payout", request_id: req.id, payout_id: po?.id ?? null, amount_ngn: -Number(req.buddy_payout_ngn), note: `Manual payout to buddy (${method})` });
  await db.from("audit_log").insert({ actor_id: p.id, action: "release_manual_payout", target_id: req.id, detail: { amount_ngn: req.buddy_payout_ngn, bank: bp, hasBank } });
  await notify(req.assigned_buddy_id, "You have been paid", "Your payout has been sent to your bank account.", "/buddy/earnings");
  revalidatePath("/admin/payouts"); revalidatePath(`/admin/requests/${req.id}`);
  return { error: "" };
}

export async function listPayoutQueue() {
  if (!(await admin())) return [];
  const db = createAdminClient();
  const { data: reqs } = await db.from("requests")
    .select("id, title, status, buddy_payout_ngn, assigned_buddy_id, created_at")
    .eq("status", "completed").order("updated_at", { ascending: true }).limit(100);
  const ids = Array.from(new Set((reqs ?? []).map((r) => r.assigned_buddy_id).filter(Boolean)));
  const { data: profs } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] as any[] };
  const nameOf = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
  const { data: banks } = ids.length ? await db.from("buddy_profiles").select("id, bank_name, bank_account_number, bank_account_name").in("id", ids) : { data: [] as any[] };
  const bankOf = new Map((banks ?? []).map((b) => [b.id, b]));
  return (reqs ?? []).map((r) => ({ ...r, buddy_name: nameOf.get(r.assigned_buddy_id) ?? "—", bank: bankOf.get(r.assigned_buddy_id) ?? null }));
}
