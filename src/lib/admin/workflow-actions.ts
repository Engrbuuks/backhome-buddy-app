"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { notify } from "@/lib/notifications/notify";

async function admin() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  return p;
}
async function transition(db: any, req: any, to: string, actorId: string, note: string) {
  await db.from("requests").update({ status: to, updated_at: new Date().toISOString() }).eq("id", req.id);
  await db.from("request_timeline").insert({ request_id: req.id, from_status: req.status, to_status: to, actor_id: actorId, note });
  req.status = to;
}

/** Record an offline payment (bank transfer). quoted → awaiting_pay → paid, funds HELD. */
export async function recordManualPayment(requestId: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_id, client_price_ngn").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (!req.client_price_ngn) return { error: "Quote the request first." };
  if (!canTransition(req.status, "awaiting_pay")) return { error: `Cannot record payment from "${req.status}".` };

  const reference = `manual-${requestId}`;
  const { error: payErr } = await db.from("payments").insert({
    request_id: req.id, client_id: req.client_id, provider: "manual",
    provider_reference: reference, amount_ngn: req.client_price_ngn,
    status: "succeeded", funds_held: true,
  });
  if (payErr) return { error: payErr.message.includes("duplicate") ? "Payment already recorded for this request." : payErr.message };
  await db.from("transactions").insert({ kind: "payment", request_id: req.id, amount_ngn: req.client_price_ngn, note: "Manual/bank transfer payment" });
  await transition(db, req, "awaiting_pay", p.id, "Offline payment being recorded");
  await transition(db, req, "paid", p.id, "Payment received (bank transfer) — funds held");
  await db.from("audit_log").insert({ actor_id: p.id, action: "record_manual_payment", target_id: req.id, detail: { amount_ngn: req.client_price_ngn } });
  await notify(req.client_id, "Payment received", "Your payment is confirmed and held securely. We are assigning your buddy.", `/client/requests/${req.id}`, "payment_received");
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
  await transition(db, req, "assigned", p.id, "Buddy assigned");
  // Copy the service type's milestone template onto this request (once).
  try {
    const { seedRequestMilestones } = await import("@/lib/requests/milestone-actions");
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
  await transition(db, req, to, p.id, approve ? "Proof approved — awaiting client confirmation" : `Changes requested: ${note}`);
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

/** Record a manual payout (bank transfer you made to the buddy). completed → paid_out. */
export async function releaseManualPayout(requestId: string) {
  const p = await admin(); if (!p) return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests")
    .select("id, status, assigned_buddy_id, buddy_payout_ngn").eq("id", requestId).single();
  if (!req) return { error: "Request not found." };
  if (req.status !== "completed") return { error: `Payout only from "completed" (client-confirmed). Current: "${req.status}".` };
  if (!req.assigned_buddy_id || !req.buddy_payout_ngn) return { error: "No buddy/payout amount on this request." };
  const { data: bp } = await db.from("buddy_profiles")
    .select("bank_name, bank_account_number, bank_account_name").eq("id", req.assigned_buddy_id).single();
  const hasBank = Boolean(bp?.bank_account_number);
  const method = hasBank ? "bank transfer" : "manual (no bank on file — paid another way)";

  const { error: poErr } = await db.from("payouts").insert({
    request_id: req.id, buddy_id: req.assigned_buddy_id, provider: "manual",
    provider_reference: `manual-payout-${req.id}`, amount_ngn: req.buddy_payout_ngn, status: "paid",
  });
  if (poErr) return { error: poErr.message.includes("duplicate") ? "Payout already recorded." : poErr.message };
  await db.from("payments").update({ funds_held: false }).eq("request_id", req.id);
  await db.from("transactions").insert({ kind: "payout", request_id: req.id, amount_ngn: -Number(req.buddy_payout_ngn), note: `Manual payout to buddy (${method})` });
  await transition(db, req, "paid_out", p.id, `Buddy paid out (${method})`);
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
