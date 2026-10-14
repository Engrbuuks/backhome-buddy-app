import type { RequestStatus } from "@/types/db";

/**
 * The request lifecycle state machine (ARCHITECTURE.md §2).
 * Any transition not listed here is forbidden and must be rejected by the
 * server before it touches the database. This is the guardrail that keeps
 * money and status correct.
 */
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["quoted", "cancelled"],
  quoted: ["awaiting_pay", "quoted", "cancelled"], // re-quote allowed during negotiation
  awaiting_pay: ["paid", "quoted"], // back to quoted if payment fails
  paid: ["assigned", "cancelled", "refunded", "disputed"],
  assigned: ["in_progress", "cancelled", "disputed"],
  in_progress: ["proof_ready", "disputed"],
  proof_ready: ["proof_approved", "in_progress", "disputed"], // bounce back if proof rejected
  proof_approved: ["completed", "disputed"],
  completed: ["paid_out", "disputed"],
  paid_out: [],
  cancelled: ["refunded"],
  refunded: [],
  disputed: ["refunded", "paid_out", "in_progress"], // admin resolution outcomes
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Hard invariant: a buddy payout may only originate from a client-confirmed
 * COMPLETED request. Never from held, unconfirmed funds.
 *
 * This used to also return true for `disputed`, and had zero call sites, so
 * the "hard invariant" was a comment rather than a guard — and it disagreed
 * with the only code that actually releases a payout, which checks for
 * `completed` alone. The two have been reconciled in favour of the stricter
 * one, and `releaseManualPayout` now calls this rather than repeating the
 * string, so they cannot drift apart again.
 *
 * A dispute resolved in the buddy's favour still reaches payout: `resolveDispute`
 * moves the request to `completed` first, which is the honest record of what
 * happened. The `disputed -> paid_out` edge in ALLOWED_TRANSITIONS is kept for
 * that historical path but no code writes it.
 */
export function isPayoutEligible(status: RequestStatus): boolean {
  return status === "completed";
}
