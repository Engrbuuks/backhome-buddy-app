"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { canTransition } from "@/lib/money/stateMachine";
import { getUsdRate } from "@/lib/money/fx";
import { notify } from "@/lib/notifications/notify";

/**
 * Quoting (build step 6). This is the first STATUS TRANSITION in the system,
 * so it sets the pattern every money/status change will follow:
 *   1. assert role server-side
 *   2. load current state
 *   3. check the state machine allows the transition
 *   4. write atomically via service-role
 *   5. record the transition in request_timeline
 */
export async function sendQuote(input: {
  requestId: string;
  items: { label: string; amount_ngn: number }[];
  buddy_payout_ngn: number;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Not authorized." };

  const items = (input.items ?? []).filter((i) => i.label.trim() && Number(i.amount_ngn) > 0);
  if (items.length === 0) return { error: "Add at least one line item." };
  const clientPrice = items.reduce((s, i) => s + Number(i.amount_ngn), 0);
  const payout = Number(input.buddy_payout_ngn);
  if (!(payout > 0)) return { error: "Set the buddy payout." };
  if (payout >= clientPrice) return { error: "Buddy payout must be less than the client price (margin can't be negative)." };

  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status").eq("id", input.requestId).single();
  if (!req) return { error: "Request not found." };
  if (!canTransition(req.status, "quoted")) {
    return { error: `Cannot quote a request in status "${req.status}".` };
  }

  // replace any existing line items, set prices, advance status
  const { error: delErr } = await db.from("quote_items").delete().eq("request_id", req.id);
  if (delErr) return { error: delErr.message };
  const { error: insErr } = await db.from("quote_items").insert(
    items.map((i) => ({ request_id: req.id, label: i.label.trim(), amount_ngn: i.amount_ngn }))
  );
  if (insErr) return { error: insErr.message };
  const lockedRate = await getUsdRate();
  const { error: upErr } = await db.from("requests").update({
    fx_rate: lockedRate,
    client_price_ngn: clientPrice,
    buddy_payout_ngn: payout,
    status: "quoted",
      quote_decision: null,
      quote_decision_note: null,
      counter_amount_ngn: null,
    updated_at: new Date().toISOString(),
  }).eq("id", req.id);
  if (upErr) return { error: upErr.message };

  await db.from("request_timeline").insert({
    request_id: req.id, from_status: req.status, to_status: "quoted",
    actor_id: profile.id, note: "Quote sent",
  });
  await db.from("audit_log").insert({
    actor_id: profile.id, action: "send_quote", target_id: req.id,
    detail: { client_price_ngn: clientPrice, buddy_payout_ngn: payout },
  });

  const { data: reqOwner } = await db.from("requests").select("client_id, title").eq("id", req.id).single();
  // Send the branded PDF quote (with link kept). Falls back to a plain
  // notification if the PDF/email step fails, so quoting never breaks.
  try {
    const { emailBrandedQuote } = await import("@/lib/admin/quote-email");
    const r = await emailBrandedQuote(req.id);
    if (r.error && reqOwner) {
      await notify(reqOwner.client_id, "Your quote is ready", `We priced "${reqOwner.title}" — review and proceed to payment.`, `/client/requests/${req.id}`, "quote_ready");
    }
  } catch {
    if (reqOwner) await notify(reqOwner.client_id, "Your quote is ready", `We priced "${reqOwner.title}" — review and proceed to payment.`, `/client/requests/${req.id}`, "quote_ready");
  }
  revalidatePath(`/admin/requests/${req.id}`);
  revalidatePath("/admin/requests");
  redirect("/admin/requests");
}

export async function getRequestForAdmin(id: string) {  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  const db = createAdminClient();
  const { data } = await db
    .from("requests")
    .select("*, service_types(name, base_price_ngn, default_buddy_payout_pct), regions(name, zone), quote_items(id, label, amount_ngn), proofs(id, kind, note, file_url, created_at, captured_lat, captured_lng, captured_accuracy, captured_at, server_received_at, capture_method), profiles!requests_client_id_fkey(full_name, email)")
    .eq("id", id)
    .single();
  return data;
}

/** Admin accepts the client's counter-offer: the proposed price becomes the new
 *  client price, keeping the buddy payout unchanged (margin absorbs the drop).
 *  Re-issues the quote at the agreed price for the client to accept & pay. */
export async function acceptCounterOffer(requestId: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests")
    .select("id, status, title, client_id, counter_amount_ngn, buddy_payout_ngn")
    .eq("id", requestId).maybeSingle();
  if (!req) return { error: "Request not found." };
  if (req.status !== "quoted") return { error: "Only an active quote can be settled." };
  const newPrice = Number(req.counter_amount_ngn);
  if (!(newPrice > 0)) return { error: "There is no counter-offer to accept." };
  if (Number(req.buddy_payout_ngn) >= newPrice) {
    return { error: "Can't accept — the client's price is at or below the buddy payout (margin would be negative). Re-quote instead." };
  }

  const { error } = await db.from("requests").update({
    client_price_ngn: newPrice,
    quote_decision: null,
    quote_decision_note: null,
    counter_amount_ngn: null,
    updated_at: new Date().toISOString(),
  }).eq("id", requestId);
  if (error) return { error: error.message };

  await db.from("request_timeline").insert({
    request_id: requestId, from_status: "quoted", to_status: "quoted",
    actor_id: profile.id, note: `Admin accepted client's counter-offer — price set to ₦${newPrice.toLocaleString()}`,
  });
  await db.from("audit_log").insert({ actor_id: profile.id, action: "accept_counter_offer", target_id: requestId, detail: { newPrice } });
  await notify(req.client_id, "Your offer was accepted ✓", `We've accepted your price for "${req.title}". Review and proceed to payment.`, `/client/requests/${requestId}`, "quote_ready");
  revalidatePath(`/admin/requests/${requestId}`);
  return { error: "" };
}

/** Re-send the branded PDF quote for a request that has already been quoted.
 *  Lets you attach the branded invoice to quotes that were sent before this
 *  feature, or simply send it again on request. */
export async function resendQuote(requestId: string): Promise<{ error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "Not authorized." };
  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("id, status, client_price_ngn").eq("id", requestId).maybeSingle();
  if (!req) return { error: "Request not found." };
  // Only meaningful once a quote exists (priced) — any post-quote status is fine.
  if (!["quoted", "awaiting_pay"].includes(req.status) || !(Number(req.client_price_ngn) > 0)) {
    return { error: "There's no active quote to resend for this request." };
  }
  const { emailBrandedQuote } = await import("@/lib/admin/quote-email");
  const r = await emailBrandedQuote(requestId);
  if (r.error) return { error: r.error };
  await db.from("audit_log").insert({ actor_id: profile.id, action: "resend_quote", target_id: requestId });
  await db.from("request_timeline").insert({ request_id: requestId, from_status: req.status, to_status: req.status, actor_id: profile.id, note: "Branded quote re-sent to client" });
  revalidatePath(`/admin/requests/${requestId}`);
  return { error: "" };
}
