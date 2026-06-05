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
  quoted: ["awaiting_pay", "cancelled"],
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
 * COMPLETED request, or an explicit admin DISPUTED resolution. Never from held,
 * unconfirmed funds. Callers enforcing payouts must check this.
 */
export function isPayoutEligible(status: RequestStatus): boolean {
  return status === "completed" || status === "disputed";
}
