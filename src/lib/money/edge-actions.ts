"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { notify, notifyAdmins } from "@/lib/notifications/notify";

async function move(db: any, req: any, to: string, actorId: string, note: string) {
  await db.from("requests").update({ status: to, updated_at: new Date().toISOString() }).eq("id", req.id);
  await db.from("request_timeline").insert({ request_id: req.id, from_status: req.status, to_status: to, actor_id: actorId, note });
}

/** Client cancels. submitted/quoted = clean; paid/assigned = cancelled, refund pending. */
export async function cancelRequest(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_id").eq("id", requestId).single();
  if (!req || req.client_id !== p.id) return { error: "Request not found." };
  if (!canTransition(req.status, "cancelled")) return { error: `Cannot cancel from "${req.status}". Raise an issue instead.` };
  const refundPending = ["paid", "assigned"].includes(req.status);
  await move(db, req, "cancelled", p.id, refundPending ? "Client cancelled — refund pending" : "Client cancelled");
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
  await move(db, req, "disputed", p.id, "Client raised an issue");
  await notifyAdmins("Dispute raised", reason.slice(0, 140), "/admin/disputes");
  revalidatePath(`/client/requests/${requestId}`);
  return { error: "", saved: true };
}

/** Admin records a manual refund. cancelled/disputed → refunded; funds released back. */
export async function recordManualRefund(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!canTransition(req.status, "refunded")) return { error: `Cannot refund from "${req.status}".` };
  const { data: pay } = await db.from("payments").select("id, amount_ngn, funds_held").eq("request_id", req.id).eq("status", "succeeded").single();
  if (!pay) return { error: "No succeeded payment to refund." };
  if (!pay.funds_held) return { error: "Funds already released — refund not possible from held funds." };
  const { error: rErr } = await db.from("refunds").insert({
    payment_id: pay.id, request_id: req.id, amount_ngn: pay.amount_ngn,
    provider_reference: `manual-refund-${req.id}`, status: "succeeded", reason: "Manual refund (bank transfer)",
  });
  if (rErr) return { error: rErr.message.includes("duplicate") ? "Refund already recorded." : rErr.message };
  await db.from("payments").update({ funds_held: false, status: "refunded" }).eq("id", pay.id);
  await db.from("transactions").insert({ kind: "refund", request_id: req.id, amount_ngn: -Number(pay.amount_ngn), note: "Manual refund to client" });
  await move(db, req, "refunded", p.id, "Client refunded (manual transfer)");
  await db.from("audit_log").insert({ actor_id: p.id, action: "record_manual_refund", target_id: req.id, detail: { amount_ngn: pay.amount_ngn } });
  const { data: r5 } = await db.from("requests").select("client_id").eq("id", req.id).single();
  if (r5) await notify(r5.client_id, "Refund sent", "Your refund has been sent to you.", `/client/requests/${req.id}`);
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
    await db.from("requests").update({ status: "completed" }).eq("id", req.id); // make payout-eligible
    await db.from("request_timeline").insert({ request_id: req.id, from_status: "disputed", to_status: "completed", actor_id: p.id, note: "Dispute resolved in buddy's favour — payout eligible" });
  } else {
    await move(db, req, "in_progress", p.id, "Dispute resolved — work resumes");
  }
  await db.from("disputes").update({ status: "resolved", resolved_outcome: outcome, resolution: `Resolved: ${outcome}`, resolved_at: new Date().toISOString() }).eq("id", d.id);
  await db.from("audit_log").insert({ actor_id: p.id, action: "resolve_dispute", target_id: req.id, detail: { outcome } });
  const { data: r6 } = await db.from("requests").select("client_id, assigned_buddy_id, title").eq("id", req.id).single();
  if (r6) {
    const msg = outcome === "refund" ? "resolved with a refund to you" : outcome === "release" ? "resolved — work accepted" : "resolved — work resumes";
    await notify(r6.client_id, "Dispute resolved", `Your issue on "${r6.title}" was ${msg}.`, `/client/requests/${req.id}`);
    if (r6.assigned_buddy_id) await notify(r6.assigned_buddy_id, "Dispute resolved", `Outcome: ${outcome}.`, `/buddy/tasks/${req.id}`);
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
    .in("status", ["cancelled"]).order("updated_at", { ascending: true });
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
    .eq("status", "open").order("created_at", { ascending: true });
  return data ?? [];
}
