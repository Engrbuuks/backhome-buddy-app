/**
 * Offer engine — internals, NOT server actions.
 *
 * SECURITY: this file deliberately has no "use server" directive. Every export
 * from a "use server" module becomes a callable HTTP endpoint that anyone who
 * can reach the deployment may invoke. `supersedePendingOffers` and
 * `expireAndCascade` take no user identity and are not something a stranger
 * should be able to fire, so they live here and are reachable only from other
 * server code: the auth-guarded wrappers in ./actions.ts, and the cron route,
 * which is protected by CRON_SECRET.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins } from "@/lib/notifications/notify";
import {
  offerWindowMinutes, rankCandidates, exclusionReason, isDeclineReason, declineLabel,
  type Candidate, type TaskRequirements,
} from "@/lib/offers/eligibility";
import type { TrustTier } from "@/lib/admin/vetting-checks";


if (typeof window !== "undefined") {
  throw new Error("offers/engine is server-only and must never reach the browser.");
}

const STATES_HOLDING_A_BUDDY = ["assigned", "in_progress", "proof_ready"];

/** Build the ranked, filtered shortlist for a request. Nothing is written. */
async function buildShortlist(db: any, requestId: string, round: number) {
  const { data: req } = await db
    .from("requests")
    .select("id, status, urgency, assigned_buddy_id, service_type_id, title")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return { req: null, ranked: [] as Candidate[], excluded: [] as string[] };

  // Requirements come from the service type; a request with none is standard.
  let reqs: TaskRequirements = { trustTier: "standard", minCompletedTasks: 0 };
  if (req.service_type_id) {
    const { data: st } = await db
      .from("service_types")
      .select("trust_tier, min_completed_tasks")
      .eq("id", req.service_type_id)
      .maybeSingle();
    if (st) {
      reqs = {
        trustTier: (st.trust_tier ?? "standard") as TrustTier,
        minCompletedTasks: Number(st.min_completed_tasks ?? 0),
      };
    }
  }

  // Reuse the existing matcher for scoring rather than reimplementing it here,
  // so the admin assignment screen and the offer layer can never disagree.
  const { matchBuddiesForTask } = await import("@/lib/admin/competency-actions");
  const { matches } = await matchBuddiesForTask(requestId);
  const scoreOf = new Map<string, number>(matches.map((m: any) => [m.id, m.score]));
  const nameOf = new Map<string, string>(matches.map((m: any) => [m.id, m.name]));

  const { data: buddies } = await db
    .from("buddy_profiles")
    .select("id, vetting, accepting_work, max_concurrent_tasks, tasks_completed, clearance_tier")
    .eq("vetting", "approved");

  // Live task counts in one query, rather than one per buddy.
  const { data: live } = await db
    .from("requests")
    .select("assigned_buddy_id")
    .in("status", STATES_HOLDING_A_BUDDY)
    .not("assigned_buddy_id", "is", null);
  const liveCount = new Map<string, number>();
  for (const r of live ?? []) {
    liveCount.set(r.assigned_buddy_id, (liveCount.get(r.assigned_buddy_id) ?? 0) + 1);
  }

  // Who has already seen this request in this round.
  const { data: seen } = await db
    .from("task_offers")
    .select("buddy_id")
    .eq("request_id", requestId)
    .eq("round", round);
  const seenIds = new Set((seen ?? []).map((o: any) => o.buddy_id));

  const cands: Candidate[] = (buddies ?? []).map((b: any) => ({
    id: b.id,
    name: nameOf.get(b.id) ?? "Buddy",
    score: scoreOf.get(b.id) ?? 0,
    vetting: b.vetting,
    accepting_work: b.accepting_work ?? true,
    max_concurrent_tasks: b.max_concurrent_tasks ?? 3,
    tasks_completed: b.tasks_completed ?? 0,
    clearance_tier: (b.clearance_tier ?? "standard") as TrustTier,
    liveTasks: liveCount.get(b.id) ?? 0,
    alreadyOffered: seenIds.has(b.id),
  }));

  const ranked = rankCandidates(cands, reqs);
  const excluded = cands
    .map((c) => ({ c, why: exclusionReason(c, reqs) }))
    .filter((x) => x.why)
    .map((x) => `${x.c.name}: ${x.why}`);

  return { req, ranked, excluded };
}

/** Raise the next offer for a request, if anyone is left to offer it to. */
export type OfferMode = "off" | "advisory" | "automatic";

/**
 * The safety valve.
 *
 *   off       — no offers raised at all; assignment is entirely manual
 *   advisory  — an offer is raised and the buddy is notified, but it does not
 *               expire and does not cascade; the admin still presses Assign
 *   automatic — the full cascade
 *
 * Defaults to advisory. An automatic cascade is only as good as its ability to
 * reach a phone, so until the delivery records show that offers are landing,
 * the system should suggest rather than decide. A stalled advisory offer costs
 * nothing; a stalled automatic one quietly burns the whole bench and leaves the
 * client waiting.
 */
export async function getOfferMode(db: any): Promise<OfferMode> {
  try {
    const { data } = await db.from("app_settings").select("value").eq("key", "offer_mode").maybeSingle();
    const m = (data?.value as any)?.mode;
    return m === "off" || m === "automatic" ? m : "advisory";
  } catch {
    return "advisory";   // fail safe, never fail open into automatic
  }
}

/** How many expiries before a request stops cascading and goes to a human. */
async function maxExpiries(db: any): Promise<number> {
  try {
    const { data } = await db.from("app_settings").select("value").eq("key", "offer_max_expiries").maybeSingle();
    const n = Number((data?.value as any)?.count);
    return Number.isFinite(n) && n >= 1 && n <= 20 ? n : 2;
  } catch {
    return 2;
  }
}

export async function offerNext(db: any, requestId: string, actorId: string | null) {
  const mode = await getOfferMode(db);
  if (mode === "off") return { offered: false, reason: "Offers are switched off; assign manually." };

  const { data: existing } = await db
    .from("task_offers")
    .select("id, round, status")
    .eq("request_id", requestId)
    .order("offered_at", { ascending: false });

  // Already live, or already taken — nothing to do.
  if ((existing ?? []).some((o: any) => o.status === "pending")) return { offered: false, reason: "An offer is already open." };
  if ((existing ?? []).some((o: any) => o.status === "accepted")) return { offered: false, reason: "Already accepted." };

  // Circuit breaker. Two buddies in a row failing to answer is already the
  // signal that the channel is not reaching people; there is no sense
  // discovering that on the twelfth. Escalate to a human instead.
  const expiredSoFar = (existing ?? []).filter((o: any) => o.status === "expired").length;
  const limit = await maxExpiries(db);
  if (expiredSoFar >= limit) {
    await notifyAdmins(
      "Offers not being answered",
      `A paid task has had ${expiredSoFar} offers expire with no response. Assign it manually and check whether buddies are receiving alerts.`,
      `/admin/requests/${requestId}`,
    );
    await db.from("audit_log").insert({
      actor_id: actorId, action: "offer_circuit_breaker", target_id: requestId,
      detail: { expired: expiredSoFar, limit },
    });
    return { offered: false, reason: `${expiredSoFar} offers expired unanswered — escalated to admin.` };
  }

  const round = Math.max(1, ...(existing ?? []).map((o: any) => o.round ?? 1));
  const { req, ranked, excluded } = await buildShortlist(db, requestId, round);
  if (!req) return { offered: false, reason: "Request not found." };
  if (req.assigned_buddy_id) return { offered: false, reason: "Already assigned." };
  if (req.status !== "paid") return { offered: false, reason: `Not offerable from "${req.status}".` };

  if (ranked.length === 0) {
    // Shortlist exhausted. This is a real operational event, not a silent
    // no-op: somebody has to assign this by hand.
    await notifyAdmins(
      "No buddy available",
      `"${req.title ?? "A paid task"}" has nobody left to offer. Assign it manually.`,
      `/admin/requests/${requestId}`,
    );
    await db.from("audit_log").insert({
      actor_id: actorId, action: "offer_exhausted", target_id: requestId,
      detail: { round, excluded: excluded.slice(0, 20) },
    });
    return { offered: false, reason: "No eligible buddy — escalated to admin." };
  }

  const pick = ranked[0];
  // In advisory mode the offer is a recommendation plus a nudge, so it is given
  // a window long enough that the expiry sweep will never touch it. The admin
  // remains the one who assigns.
  const mins = mode === "advisory" ? 60 * 24 * 7 : offerWindowMinutes(req.urgency);
  const expires = new Date(Date.now() + mins * 60_000).toISOString();

  const { data: offer, error } = await db
    .from("task_offers")
    .insert({
      request_id: requestId, buddy_id: pick.id, round,
      rank: 1, score: Math.round(pick.score), expires_at: expires, created_by: actorId,
    })
    .select("id")
    .single();

  // A unique-violation here means another process raised an offer a moment
  // ago. That is the index doing its job, not an error worth surfacing.
  if (error) return { offered: false, reason: error.message.includes("duplicate") ? "An offer is already open." : error.message };

  const offerTitle = "New task offered to you";
  const offerBody = mode === "advisory"
    ? `"${req.title ?? "A task"}" has been matched to you. Open the app to accept it.`
    : `"${req.title ?? "A task"}" is offered to you. You have ${mins} minutes to accept before it goes to the next buddy.`;

  // skipPush: the richer, urgent, tagged push goes out just below. Without
  // this the buddy would get two buzzes for one offer.
  await notify(pick.id, offerTitle, offerBody, `/buddy/dashboard`, "task_assigned_buddy", { skipPush: true });

  // Push is the only channel that reaches a buddy who is not currently looking
  // at the site, which is most of them most of the time. Non-fatal: the offer
  // stands whether or not the phone buzzed, and the delivery record tells you
  // afterwards which it was.
  try {
    const { sendPushToUser } = await import("@/lib/notifications/push");
    await sendPushToUser(
      pick.id,
      { title: offerTitle, body: offerBody, url: "/buddy/dashboard", urgent: true, tag: `offer-${requestId}` },
      { typeKey: "task_assigned_buddy", requestId },
    );
  } catch (e) {
    console.error("offer push failed:", e);
  }
  if (mode === "advisory") {
    await notifyAdmins(
      "Buddy matched",
      `${pick.name} is the best match for "${req.title ?? "a paid task"}". They have been notified; assign when ready.`,
      `/admin/requests/${requestId}`,
    );
  }

  await db.from("audit_log").insert({
    actor_id: actorId, action: "offer_raised", target_id: requestId,
    detail: { offer_id: offer.id, buddy_id: pick.id, round, score: Math.round(pick.score), window_minutes: mins, mode },
  });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/buddy/dashboard");
  return { offered: true, reason: "" };
}


/**
 * Opportunistic offer expiry — the sweep that does not need a frequent cron.
 *
 * Vercel's Hobby plan caps cron jobs at once per DAY, so a scheduled sweep
 * cannot drive a 20 to 45 minute offer window. Rather than make the offer
 * layer depend on a paid plan, expiry also runs lazily: any time someone loads
 * a page that cares about offers, stale ones are closed and the next buddy is
 * offered the task.
 *
 * Throttled to once a minute across the whole deployment via app_settings, so
 * a busy minute does not run the sweep dozens of times. Never throws: a failed
 * sweep must not break the page that triggered it.
 *
 * The daily cron stays as a backstop for quiet periods when nobody loads
 * anything. On Pro you can set it back to "*‍/10 * * * *" and this becomes
 * belt and braces.
 */
export async function maybeExpireOffers(db: any): Promise<void> {
  try {
    const KEY = "offer_sweep_last_run";
    const now = Date.now();

    const { data } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const last = Number((data?.value as any)?.at ?? 0);
    if (now - last < 60_000) return;   // swept recently; nothing to do

    // Claim the slot BEFORE sweeping, so two concurrent page loads do not both
    // run it. Worst case on a race is one wasted sweep, never a double cascade:
    // the unique index still allows only one pending offer per request.
    await db.from("app_settings").upsert({ key: KEY, value: { at: now }, updated_at: new Date().toISOString() });

    await expireAndCascade();
  } catch {
    /* A sweep that fails is a delay, not an error worth surfacing. */
  }
}

/**
 * Cron: expire offers whose window has closed, then cascade each affected
 * request to the next buddy. Separate from the auto-release job because it
 * runs on a very different clock.
 */
export async function expireAndCascade() {
  const db = createAdminClient();
  const { data, error } = await db.rpc("expire_stale_offers");
  if (error) return { expired: 0, reoffered: 0, error: error.message };

  const requestIds: string[] = Array.from(
    new Set((data ?? []).map((r: any) => String(r.request_id))),
  );
  let reoffered = 0;
  for (const id of requestIds) {
    const r = await offerNext(db, id, null);
    if (r.offered) reoffered++;
  }
  return { expired: requestIds.length, reoffered, error: "" };
}

/** Called when an admin assigns by hand: the live offer is no longer meaningful. */
export async function supersedePendingOffers(requestId: string) {
  const db = createAdminClient();
  await db
    .from("task_offers")
    .update({ status: "superseded", responded_at: new Date().toISOString() })
    .eq("request_id", requestId)
    .eq("status", "pending");
}
