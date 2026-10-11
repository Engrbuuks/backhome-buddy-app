"use server";
/**
 * The offer and accept layer — the auth-guarded surface.
 *
 * On payment a task is OFFERED to the best ranked eligible buddy with a time
 * window, rather than assigned to them. Decline or timeout cascades to the
 * next. After the shortlist is exhausted it escalates to the admin queue.
 *
 * Manual assignment (`assignBuddy`) is untouched and wins at any point.
 *
 * EVERY export here is a public HTTP endpoint, so every one of them starts by
 * establishing who is calling. Anything that cannot make that check — the cron
 * sweep, the supersede helper — lives in ./engine.ts instead.
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";
import { notify, notifyAdmins } from "@/lib/notifications/notify";
import { isDeclineReason, declineLabel } from "@/lib/offers/eligibility";
import { offerNext, maybeExpireOffers } from "@/lib/offers/engine";

/** Called after payment is recorded, and by the admin "re-offer" button. */
export async function startOffering(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const r = await offerNext(createAdminClient(), requestId, p.id);
  return { error: r.offered ? "" : r.reason };
}

/** Buddy accepts. All the real checking happens atomically inside the DB function. */
export async function acceptOffer(offerId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const db = createAdminClient();

  const { data, error } = await db.rpc("accept_task_offer", { p_offer: offerId, p_buddy: p.id });
  if (error) return { error: error.message };
  const res = (data ?? {}) as { ok?: boolean; reason?: string };
  if (!res.ok) return { error: res.reason || "Could not accept this offer." };

  const { data: off } = await db.from("task_offers").select("request_id").eq("id", offerId).maybeSingle();
  const requestId = off?.request_id as string | undefined;
  if (requestId) {
    // Same follow-through as a manual assignment, so an accepted offer and an
    // admin assignment leave the request in an identical state.
    try {
      const { seedRequestMilestones } = await import("@/lib/requests/milestone-actions");
      await seedRequestMilestones(requestId);
    } catch { /* non-fatal */ }
    const { data: r2 } = await db.from("requests").select("client_id, title").eq("id", requestId).maybeSingle();
    if (r2?.client_id) {
      await notify(r2.client_id, "Buddy assigned", "A vetted buddy has taken your request.", `/client/requests/${requestId}`, "buddy_assigned_client");
    }
    await notifyAdmins("Offer accepted", `"${r2?.title ?? "A task"}" was accepted by a buddy.`, `/admin/requests/${requestId}`);
    await db.from("audit_log").insert({ actor_id: p.id, action: "offer_accepted", target_id: requestId, detail: { offer_id: offerId } });
    revalidatePath(`/admin/requests/${requestId}`);
    revalidatePath(`/buddy/tasks/${requestId}`);
  }
  revalidatePath("/buddy/dashboard");
  return { error: "" };
}

/** Buddy declines, with a reason. The reason is the point. */
export async function declineOffer(offerId: string, reason: string, note?: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  if (!isDeclineReason(reason)) return { error: "Pick a reason for declining." };
  const db = createAdminClient();

  const { data: off } = await db
    .from("task_offers")
    .select("id, request_id, buddy_id, status")
    .eq("id", offerId)
    .maybeSingle();
  if (!off) return { error: "Offer not found." };
  if (off.buddy_id !== p.id) return { error: "This offer is not yours." };
  if (off.status !== "pending") return { error: "This offer is no longer open." };

  // Conditional on still being pending, so a decline cannot overwrite an
  // accept that landed a moment earlier.
  const { data: updated, error } = await db
    .from("task_offers")
    .update({
      status: "declined", responded_at: new Date().toISOString(),
      decline_reason: reason, decline_note: (note || "").slice(0, 500) || null,
    })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "This offer is no longer open." };

  await db.from("audit_log").insert({
    actor_id: p.id, action: "offer_declined", target_id: off.request_id,
    detail: { offer_id: offerId, reason, note: (note || "").slice(0, 200) },
  });

  // Straight on to the next buddy. A decline should cost the client seconds,
  // not hours.
  await offerNext(db, off.request_id, null);

  revalidatePath("/buddy/dashboard");
  return { error: "" };
}

/** The buddy's live offer, for their dashboard. */
export async function myPendingOffer() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return null;
  const db = createAdminClient();
  // Close out anything stale before answering. This is what keeps the cascade
  // moving on a Hobby plan, where cron can only run once a day.
  await maybeExpireOffers(db);
  const { data } = await db
    .from("task_offers")
    .select("id, request_id, expires_at, offered_at, requests(title, urgency, recipient_address, buddy_payout_ngn, service_types(name))")
    .eq("buddy_id", p.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** The full offer trail for a request, for the admin screen. */
export async function listOffersForRequest(requestId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return [];
  const db = createAdminClient();
  await maybeExpireOffers(db);
  const { data } = await db
    .from("task_offers")
    .select("id, buddy_id, round, rank, score, status, offered_at, expires_at, responded_at, decline_reason, decline_note, profiles!task_offers_buddy_id_fkey(full_name)")
    .eq("request_id", requestId)
    .order("offered_at", { ascending: false });
  return (data ?? []).map((o: any) => ({
    ...o,
    buddy_name: (Array.isArray(o.profiles) ? o.profiles[0] : o.profiles)?.full_name ?? "Buddy",
    decline_label: o.decline_reason ? declineLabel(o.decline_reason) : null,
  }));
}
