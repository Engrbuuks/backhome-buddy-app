"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { notify, notifyAdmins } from "@/lib/notifications/notify";

/** Mid-task additional charges.
 *  Policy: significant unforeseen costs are proposed to the client with a
 *  reason and approved BEFORE work continues — matching the public promise
 *  "any additional costs are communicated clearly before proceeding".
 *  Lifecycle: proposed → approved → paid (or declined). Runs alongside the
 *  main request state machine without touching it. */

export async function listCharges(requestId: string) {
  const p = await getCurrentProfile();
  if (!p) return [];
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("client_id").eq("id", requestId).maybeSingle();
  if (!req) return [];
  if (p.role !== "admin" && req.client_id !== p.id) return [];
  const { data } = await db.from("additional_charges").select("*").eq("request_id", requestId).order("created_at");
  return data ?? [];
}

export async function proposeCharge(requestId: string, reason: string, amountNgn: number, buddyExtraNgn: number) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  reason = reason.trim().slice(0, 500);
  if (!reason) return { error: "Give the client a clear reason for the extra cost." };
  if (!Number.isFinite(amountNgn) || amountNgn <= 0) return { error: "Enter a valid extra amount." };
  if (!Number.isFinite(buddyExtraNgn) || buddyExtraNgn < 0 || buddyExtraNgn > amountNgn) {
    return { error: "Buddy share must be between 0 and the extra amount." };
  }
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, client_id, title, status").eq("id", requestId).maybeSingle();
  if (!req) return { error: "Request not found." };
  // "proof_submitted" is not a status this app has — the real one is
  // "proof_ready". The typo silently blocked charges at exactly the stage a
  // buddy is most likely to discover an unforeseen cost.
  if (!["paid", "assigned", "in_progress", "proof_ready"].includes(req.status)) {
    return { error: `Extra charges can only be proposed on an active task (current status: ${req.status}).` };
  }
  const { error } = await db.from("additional_charges").insert({
    request_id: requestId, reason, amount_ngn: amountNgn, buddy_extra_ngn: buddyExtraNgn, proposed_by: p.id,
  });
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "propose_additional_charge", target_id: requestId, detail: { amount_ngn: amountNgn, reason } });
  await db.from("request_timeline").insert({ request_id: requestId, from_status: req.status, to_status: req.status, actor_id: p.id, note: `Additional cost proposed: ₦${amountNgn.toLocaleString()} — ${reason}` });
  await notify(req.client_id, "Additional cost needs your approval", `"${req.title}": ₦${amountNgn.toLocaleString()} — ${reason}. Work on this item continues after your approval.`, `/client/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  return { error: "" };
}

/**
 * The client accepts or pushes back on a proposed extra cost.
 *
 * The amount is NEVER taken from the caller. It is read from the stored row
 * and written back nowhere: this action touches status, decided_at and, on a
 * push back, the client's reason. Migration 0043 removed the direct update
 * policy that used to let a client rewrite `amount_ngn` from their browser
 * while approving, so this action is now the only writer.
 */
export async function decideCharge(chargeId: string, approve: boolean, reason?: string) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: ch } = await db.from("additional_charges").select("*, requests(id, client_id, title)").eq("id", chargeId).maybeSingle();
  if (!ch) return { error: "Charge not found." };
  if (p.role !== "admin" && ch.requests?.client_id !== p.id) return { error: "Not authorized." };
  if (ch.status !== "proposed") return { error: "This charge has already been decided." };
  const why = String(reason || "").trim().slice(0, 500);
  if (!approve && !why) return { error: "Tell us what you think it should be, or why this does not look right." };
  const status = approve ? "approved" : "declined";
  const patch: Record<string, any> = { status, decided_at: new Date().toISOString() };
  if (!approve) patch.decline_reason = why;
  const { error } = await db.from("additional_charges").update(patch).eq("id", chargeId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: `additional_charge_${status}`, target_id: ch.request_id, detail: { amount_ngn: ch.amount_ngn, reason: why || null } });
  const { data: reqRow } = await db.from("requests").select("status").eq("id", ch.request_id).maybeSingle();
  await db.from("request_timeline").insert({ request_id: ch.request_id, from_status: reqRow?.status, to_status: reqRow?.status, actor_id: p.id, note: `Additional cost ₦${Number(ch.amount_ngn).toLocaleString()} ${status} by client${why ? `: ${why}` : ""}` });
  await notifyAdmins(`Additional charge ${status}`, `"${ch.requests?.title}": ₦${Number(ch.amount_ngn).toLocaleString()} ${status}.${why ? ` Client says: ${why}` : ""}`, `/admin/requests/${ch.request_id}`);
  revalidatePath(`/client/requests/${ch.request_id}`);
  revalidatePath(`/admin/requests/${ch.request_id}`);
  return { error: "" };
}

/** Record the client's transfer for an APPROVED charge (same bank-first rule as the main payment). */
export async function recordChargePayment(chargeId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: ch } = await db.from("additional_charges").select("*, requests(id, client_id, title)").eq("id", chargeId).maybeSingle();
  if (!ch) return { error: "Charge not found." };
  if (ch.status !== "approved") return { error: `Only approved charges can be recorded as paid (current: ${ch.status}).` };
  const { error } = await db.from("additional_charges").update({ status: "paid" }).eq("id", chargeId);
  if (error) return { error: error.message };

  // The buddy's share of the extra, added to what they are owed.
  //
  // This used to be collected from the client and never passed on. A buddy who
  // fronted 45,000 naira of their own money for an unforeseen cost saw the
  // client approve it, saw the client pay it, and was then paid the original
  // quote figure. The money stayed with the business, labelled in the ledger
  // as a payment. buddy_extra_ngn was written once at proposal and read by
  // nothing but a display label.
  const buddyExtra = Number((ch as any).buddy_extra_ngn ?? 0);
  if (buddyExtra > 0) {
    const { data: r } = await db.from("requests").select("buddy_payout_ngn, assigned_buddy_id, title").eq("id", ch.request_id).maybeSingle();
    if (r) {
      const updated = Math.round((Number(r.buddy_payout_ngn ?? 0) + buddyExtra) * 100) / 100;
      await db.from("requests").update({ buddy_payout_ngn: updated }).eq("id", ch.request_id);
      await db.from("request_timeline").insert({
        request_id: ch.request_id, from_status: null, to_status: null, actor_id: p.id,
        note: `Buddy payout raised by ₦${buddyExtra.toLocaleString()} for the approved extra cost`,
      });
      if ((r as any).assigned_buddy_id) {
        await notify(
          (r as any).assigned_buddy_id,
          "Your payout went up",
          `The client has paid the extra cost on "${r.title}". ₦${buddyExtra.toLocaleString()} has been added to your payout for this task.`,
          `/buddy/tasks/${ch.request_id}`,
        );
      }
    }
  }

  // Ledger: extra funds held against this request.
  await db.from("transactions").insert({
    request_id: ch.request_id,
    kind: "payment",
    amount_ngn: ch.amount_ngn,
    note: `Additional charge: ${ch.reason}${buddyExtra > 0 ? ` (₦${buddyExtra.toLocaleString()} of it owed to the buddy)` : ""}`,
  });
  await db.from("audit_log").insert({ actor_id: p.id, action: "additional_charge_paid", target_id: ch.request_id, detail: { amount_ngn: ch.amount_ngn } });
  const { data: reqRow2 } = await db.from("requests").select("status").eq("id", ch.request_id).maybeSingle();
  await db.from("request_timeline").insert({ request_id: ch.request_id, from_status: reqRow2?.status, to_status: reqRow2?.status, actor_id: p.id, note: `Additional payment received: ₦${Number(ch.amount_ngn).toLocaleString()}` });
  await notify(ch.requests!.client_id, "Additional payment confirmed", `"${ch.requests?.title}": ₦${Number(ch.amount_ngn).toLocaleString()} received — work continues.`, `/client/requests/${ch.request_id}`);
  revalidatePath(`/admin/requests/${ch.request_id}`);
  revalidatePath(`/client/requests/${ch.request_id}`);
  return { error: "" };
}
