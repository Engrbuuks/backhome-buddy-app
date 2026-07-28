"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

/**
 * Request intake (build step 5). No money yet — just creating and listing
 * requests. RLS does the heavy lifting: a client only ever sees/creates their
 * own requests; the admin sees all. These reads go through the session client
 * (RLS-enforced) on purpose — we WANT the database to filter by role.
 */

// Active service types + regions for the client's New Request form dropdowns.
export async function getRequestFormOptions() {
  const supabase = createClient();
  const [{ data: services }, { data: regions }, { data: upliftRow }, { data: urgentRow }] = await Promise.all([
    supabase.from("service_types").select("id, name, base_price_ngn, pricing_mode, from_price_usd").eq("active", true).order("sort_order"),
    supabase.from("regions").select("id, name, state, zone").eq("active", true).order("name"),
    supabase.from("app_settings").select("value").eq("key", "pricing_zone_b_uplift_pct").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "pricing_urgent_surcharge_pct").maybeSingle(),
  ]);
  const pct = Number((upliftRow?.value as any)?.pct);
  const upct = Number((urgentRow?.value as any)?.pct);
  return {
    services: services ?? [],
    regions: regions ?? [],
    zoneBUpliftPct: Number.isFinite(pct) && pct >= 0 ? pct : 25,
    urgentSurchargePct: Number.isFinite(upct) && upct >= 0 ? upct : 40,
  };
}

// Client creates a request. RLS "client creates own request" enforces client_id = self.
export async function createRequest(_prev: unknown, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "client") {
    return { error: "Only clients can submit requests." };
  }
  const supabase = createClient();

  const title = String(formData.get("title") || "").trim().slice(0, 140);
  if (!title) return { error: "Please give your request a short title." };

  const regionRaw = String(formData.get("region_id") || "");
  const isOtherState = regionRaw === "__other__";
  const requestedState = isOtherState ? String(formData.get("requested_state") || "").slice(0, 80).trim() : null;
  if (isOtherState && !requestedState) return { error: "Tell us which state the task is in." };

  const { data, error } = await supabase.from("requests").insert({
    client_id: profile.id,
    service_type_id: (formData.get("service_type_id") as string) || null,
    region_id: isOtherState ? null : regionRaw || null,
    requested_state: requestedState,
    expectations: String(formData.get("expectations") || "").slice(0, 2000).trim() || null,
    status: "submitted",
    title,
    description: String(formData.get("description") || "").slice(0, 4000),
    urgency: String(formData.get("urgency") || "standard"),
    display_currency: "USD",
    recipient_name: String(formData.get("recipient_name") || "").slice(0, 120),
    recipient_phone: String(formData.get("recipient_phone") || "").slice(0, 32),
    recipient_address: String(formData.get("recipient_address") || "").slice(0, 300),
  }).select("id, title, urgency").single();
  if (error) return { error: error.message };

  if (data) {
    const { notifyAdmins } = await import("@/lib/notifications/notify");
    const urgent = data.urgency === "urgent";
    await notifyAdmins(
      urgent ? "🔴 URGENT request — quote within 6 hours" : "New request submitted",
      `"${data.title}"${isOtherState ? ` — OUT OF COVERAGE (${requestedState})` : ""} — review and quote.`,
      `/admin/requests/${data.id}`
    );
  }

  revalidatePath("/client/dashboard");
  redirect("/client/dashboard");
}

// Client's own requests (RLS auto-filters to theirs).
export async function listMyRequests() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id, title, status, urgency, client_price_ngn, fx_rate, created_at, service_types(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Admin: all requests (RLS "admin reads all requests" allows it).
export async function listAllRequests(page = 1, pageSize = 20) {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("requests")
    .select("id, title, status, urgency, client_price_ngn, created_at, service_types(name), profiles!requests_client_id_fkey(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

// One request with its quote items + proofs (RLS scopes who can see it).
export async function getRequestById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("requests")
    .select("*, service_types(name), quote_items(id, label, amount_ngn), proofs(id, kind, file_url, note, created_at, captured_lat, captured_lng, captured_accuracy, captured_at, server_received_at, capture_method)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

/** Client responds to a quote: accept, request changes (note), or counter with a
 *  specific price. Counter-offers are capped to a few rounds to avoid endless
 *  haggling. Acceptance doesn't move the state machine (payment recording does).
 */
const MAX_NEGOTIATION_ROUNDS = 3;

export async function respondToQuote(_prev: unknown, formData: FormData) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { notifyAdmins } = await import("@/lib/notifications/notify");
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  const requestId = String(formData.get("request_id") || "");
  const decision = String(formData.get("decision") || "");
  const note = String(formData.get("note") || "").slice(0, 1000).trim();
  if (!["accepted", "changes_requested", "countered"].includes(decision)) return { error: "Invalid response." };
  if (decision === "changes_requested" && !note) return { error: "Tell us what you'd like changed." };

  const db = createAdminClient();
  const { data: req } = await db.from("requests").select("*").eq("id", requestId).maybeSingle();
  if (!req || req.client_id !== profile.id) return { error: "Request not found." };
  if (req.status !== "quoted") return { error: "This quote can no longer be responded to." };

  // Handle a counter-offer: client proposes a specific price in their currency.
  let counterAmountNgn: number | null = null;
  if (decision === "countered") {
    const rounds = Number(req.negotiation_rounds || 0);
    if (rounds >= MAX_NEGOTIATION_ROUNDS) {
      return { error: `You've reached the maximum of ${MAX_NEGOTIATION_ROUNDS} counter-offers. Please accept the current quote or contact us to discuss.` };
    }
    const offerAmount = Number(formData.get("offer_amount"));
    const offerCurrency = String(formData.get("offer_currency") || "USD");
    if (!(offerAmount > 0)) return { error: "Enter a valid amount for your offer." };
    // Convert the client's offer (in their display currency) into NGN.
    const { getRates } = await import("@/lib/money/fx");
    const { isCurrency } = await import("@/lib/money/currency");
    const rates = await getRates();
    const cur = isCurrency(offerCurrency) ? offerCurrency : "USD";
    counterAmountNgn = cur === "NGN" ? offerAmount : Math.round(offerAmount * (rates[cur] || 0));
    if (!(counterAmountNgn > 0)) return { error: "Could not price your offer — please try again." };
    if (req.client_price_ngn && counterAmountNgn >= Number(req.client_price_ngn)) {
      return { error: "Your counter-offer should be lower than the current quote. To accept the quote, use Accept instead." };
    }
  }

  const patch: any = { quote_decision: decision, quote_decision_note: note || null };
  if (decision === "countered") {
    patch.counter_amount_ngn = counterAmountNgn;
    patch.negotiation_rounds = Number(req.negotiation_rounds || 0) + 1;
  }
  const { error } = await db.from("requests").update(patch).eq("id", requestId);
  if (error) return { error: error.message };

  await db.from("audit_log").insert({ actor_id: profile.id, action: `quote_${decision}`, target_id: requestId, detail: { note, counter_amount_ngn: counterAmountNgn } });

  const timelineNote = decision === "accepted"
    ? "Client accepted the quote"
    : decision === "countered"
    ? `Client counter-offered ₦${counterAmountNgn?.toLocaleString()}${note ? ` — ${note}` : ""}`
    : `Client requested changes: ${note}`;
  await db.from("request_timeline").insert({ request_id: requestId, from_status: "quoted", to_status: "quoted", actor_id: profile.id, note: timelineNote });

  const adminTitle = decision === "accepted" ? "Quote accepted ✓" : decision === "countered" ? "Client counter-offer 💬" : "Quote changes requested";
  const adminBody = decision === "accepted"
    ? `"${req.title}": client accepted — send payment instructions.`
    : decision === "countered"
    ? `"${req.title}": client offered ₦${counterAmountNgn?.toLocaleString()}${note ? ` — ${note}` : ""}. Re-quote or accept their price.`
    : `"${req.title}": ${note}`;
  await notifyAdmins(adminTitle, adminBody, `/admin/requests/${requestId}`);
  revalidatePath(`/client/requests/${requestId}`);
  return { error: "", done: true };
}
