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
  if (!["paid", "assigned", "in_progress", "proof_submitted"].includes(req.status)) {
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

export async function decideCharge(chargeId: string, approve: boolean) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: ch } = await db.from("additional_charges").select("*, requests(id, client_id, title)").eq("id", chargeId).maybeSingle();
  if (!ch) return { error: "Charge not found." };
  if (p.role !== "admin" && ch.requests?.client_id !== p.id) return { error: "Not authorized." };
  if (ch.status !== "proposed") return { error: "This charge has already been decided." };
  const status = approve ? "approved" : "declined";
  const { error } = await db.from("additional_charges").update({ status, decided_at: new Date().toISOString() }).eq("id", chargeId);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: `additional_charge_${status}`, target_id: ch.request_id, detail: { amount_ngn: ch.amount_ngn } });
  const { data: reqRow } = await db.from("requests").select("status").eq("id", ch.request_id).maybeSingle();
  await db.from("request_timeline").insert({ request_id: ch.request_id, from_status: reqRow?.status, to_status: reqRow?.status, actor_id: p.id, note: `Additional cost ₦${Number(ch.amount_ngn).toLocaleString()} ${status} by client` });
  await notifyAdmins(`Additional charge ${status}`, `"${ch.requests?.title}": ₦${Number(ch.amount_ngn).toLocaleString()} ${status}.`, `/admin/requests/${ch.request_id}`);
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
  // Ledger: extra funds held against this request.
  await db.from("transactions").insert({
    request_id: ch.request_id,
    kind: "payment",
    amount_ngn: ch.amount_ngn,
    note: `Additional charge: ${ch.reason}`,
  });
  await db.from("audit_log").insert({ actor_id: p.id, action: "additional_charge_paid", target_id: ch.request_id, detail: { amount_ngn: ch.amount_ngn } });
  const { data: reqRow2 } = await db.from("requests").select("status").eq("id", ch.request_id).maybeSingle();
  await db.from("request_timeline").insert({ request_id: ch.request_id, from_status: reqRow2?.status, to_status: reqRow2?.status, actor_id: p.id, note: `Additional payment received: ₦${Number(ch.amount_ngn).toLocaleString()}` });
  await notify(ch.requests!.client_id, "Additional payment confirmed", `"${ch.requests?.title}": ₦${Number(ch.amount_ngn).toLocaleString()} received — work continues.`, `/client/requests/${ch.request_id}`);
  revalidatePath(`/admin/requests/${ch.request_id}`);
  revalidatePath(`/client/requests/${ch.request_id}`);
  return { error: "" };
}
