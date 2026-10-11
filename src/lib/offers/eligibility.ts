/** Pure helpers for the offer layer.
 *
 *  No database access and no "use server", so this is importable from client
 *  components and testable on its own. Every rule that decides who may be
 *  offered what lives here in one place; the server actions and the SQL accept
 *  function both enforce the same rules, and this is the readable copy.
 */

import type { TrustTier } from "@/lib/admin/vetting-checks";
import { tierRank } from "@/lib/admin/vetting-checks";

/** Why a buddy turned a task down. The whole point of the offer layer is that
 *  this answer gets recorded: four declines on price in one area means the rate
 *  card is wrong there, and nothing else will tell you. */
export const DECLINE_REASONS = [
  { key: "payout_too_low", label: "Payout is too low" },
  { key: "too_far", label: "Too far from me" },
  { key: "not_available", label: "Not available right now" },
  { key: "outside_my_skill", label: "Outside what I do" },
  { key: "other", label: "Something else" },
] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number]["key"];

export function isDeclineReason(v: string): v is DeclineReason {
  return DECLINE_REASONS.some((r) => r.key === v);
}

export function declineLabel(key: string): string {
  return DECLINE_REASONS.find((r) => r.key === key)?.label ?? key;
}

/**
 * How long a buddy has to answer.
 *
 * Urgent work gets a shorter window because waiting 45 minutes on someone who
 * is asleep defeats the point of calling it urgent. Nothing shorter than a few
 * minutes: a buddy who is mid-task should still get a fair chance to look.
 */
export function offerWindowMinutes(urgency?: string | null): number {
  const u = (urgency || "").toLowerCase();
  if (/urgent|express|same.?day|rush/.test(u)) return 20;
  return 45;
}

/** Everything the gates need to know about one candidate. */
export type Candidate = {
  id: string;
  name: string;
  score: number;
  vetting: string;
  accepting_work: boolean;
  max_concurrent_tasks: number;
  tasks_completed: number;
  clearance_tier: TrustTier;
  liveTasks: number;
  /** Rounds in which this buddy has already been offered this request. */
  alreadyOffered: boolean;
};

export type TaskRequirements = {
  trustTier: TrustTier;
  minCompletedTasks: number;
};

/**
 * The hard gates. Anything failing one of these is not "ranked lower", it is
 * excluded: offering a task to someone who cannot legally or practically take
 * it wastes the window and delays the client.
 *
 * Returns null when eligible, or the reason for exclusion (useful in the admin
 * trail, so "why was nobody offered this?" has an answer).
 */
export function exclusionReason(c: Candidate, req: TaskRequirements): string | null {
  if (c.vetting !== "approved") return "not approved";
  if (!c.accepting_work) return "not accepting work";
  if (c.alreadyOffered) return "already offered this round";
  if (c.liveTasks >= c.max_concurrent_tasks) return `at capacity (${c.liveTasks}/${c.max_concurrent_tasks})`;
  if (tierRank(c.clearance_tier) < tierRank(req.trustTier)) return `not cleared for ${req.trustTier.replace("_", " ")}`;
  if (c.tasks_completed < req.minCompletedTasks) return `needs ${req.minCompletedTasks} completed tasks, has ${c.tasks_completed}`;
  return null;
}

/**
 * Rank the eligible candidates.
 *
 * Matcher score leads, but a buddy who has just been given work is nudged down
 * so the same top scorer does not take every job in their city while everyone
 * else stays at zero completed tasks and never becomes eligible for anything.
 * Spreading work is not politeness, it is how the bench gets built.
 */
export function rankCandidates(cands: Candidate[], req: TaskRequirements): Candidate[] {
  return cands
    .filter((c) => exclusionReason(c, req) === null)
    .map((c) => ({ ...c, score: c.score - c.liveTasks * 8 }))
    .sort((a, b) => b.score - a.score || a.liveTasks - b.liveTasks);
}
