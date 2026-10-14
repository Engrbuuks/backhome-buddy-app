/**
 * How much of a payment is refundable, and how much is not.
 *
 * Pure functions. No network, no database, no React. Everything that decides
 * money here can be run in a test, which is the point: this is the arithmetic a
 * client is shown before they press the button and the arithmetic an admin is
 * held to afterwards, and those two must be the same arithmetic.
 *
 * THE THREE RULES, in the order they are applied:
 *
 *   1. Before a buddy is assigned, nothing is retained. No buddy has turned
 *      down other work yet, so there is no cost to cover.
 *   2. If the failure is ours or the buddy's, nothing is retained, at any
 *      stage. The non refundable amount exists for a client who changed their
 *      mind, never for a task Backhome Buddy could not deliver.
 *   3. Otherwise the stage decides: a percentage of what was paid, with a naira
 *      floor, both clamped so the retention can never exceed the payment.
 *
 * The admin can override the result of all three on any single decision. The
 * override is stored next to this computed figure rather than replacing it, so
 * an exception reads as an exception.
 */

/** Who the failure belongs to. */
export type Fault = "client" | "ours" | "buddy" | "external";

/** Faults that waive the non refundable amount entirely. */
export const BLAMELESS_FAULTS: readonly Fault[] = ["ours", "buddy"] as const;

export const FAULT_LABELS: Record<Fault, string> = {
  client: "Client changed their mind or gave wrong details",
  ours: "Our fault — we could not deliver",
  buddy: "Buddy's fault — no show, poor work, abandoned",
  external: "Nobody's fault — circumstances outside everyone's control",
};

/** Why the client says they want the money back. Free text sits alongside. */
export const REFUND_REASONS: ReadonlyArray<readonly [string, string]> = [
  ["no_longer_needed", "I no longer need this done"],
  ["wrong_details", "I gave the wrong details"],
  ["too_slow", "It is taking too long"],
  ["buddy_unresponsive", "The buddy has gone quiet"],
  ["work_not_done", "The work was not done"],
  ["work_poor", "The work was done badly"],
  ["recipient_unavailable", "The person or place could not be reached"],
  ["other", "Something else"],
] as const;

export type StageRule = { pct: number; floor_ngn: number };

export type RefundPolicy = {
  /** Switched off means the client sees no refund button at all. */
  enabled: boolean;
  /** No buddy assigned yet: approve the full amount without an admin. */
  auto_approve_unassigned: boolean;
  /** Rule 2. Left configurable, but turning it off is a bad idea. */
  waive_when_our_fault: boolean;
  stages: Record<string, StageRule>;
};

/** Used when the settings row is missing, unreadable, or half written. The
 *  app must still be able to quote a refund on a database that has not been
 *  migrated yet, so this mirrors what migration 0042 seeds. */
export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  enabled: true,
  auto_approve_unassigned: true,
  waive_when_our_fault: true,
  stages: {
    paid: { pct: 0, floor_ngn: 0 },
    assigned: { pct: 10, floor_ngn: 1000 },
    in_progress: { pct: 25, floor_ngn: 2000 },
    proof_ready: { pct: 100, floor_ngn: 0 },
    proof_approved: { pct: 100, floor_ngn: 0 },
    completed: { pct: 100, floor_ngn: 0 },
  },
};

/** Statuses where money is held and a refund can therefore be asked for. */
export const REFUNDABLE_STATUSES: readonly string[] = [
  "paid", "assigned", "in_progress", "proof_ready", "proof_approved", "completed",
] as const;

/** Statuses where no buddy has committed yet, so rule 1 applies. */
export const PRE_ASSIGNMENT_STATUSES: readonly string[] = ["paid"] as const;

export function canRequestRefund(status: string): boolean {
  return REFUNDABLE_STATUSES.includes(status);
}

/**
 * Read a policy out of whatever came back from app_settings.
 *
 * Deliberately forgiving. A missing key, a null, a half edited object or a
 * string where a number belongs all fall back to the default for that one
 * field rather than throwing, because an unparseable settings row must not be
 * able to stop a client getting their money back.
 */
export function parseRefundPolicy(raw: unknown): RefundPolicy {
  const d = DEFAULT_REFUND_POLICY;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;

  const stages: Record<string, StageRule> = { ...d.stages };
  const rawStages = o.stages;
  if (rawStages && typeof rawStages === "object") {
    for (const [key, val] of Object.entries(rawStages as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const v = val as Record<string, unknown>;
      const pct = clamp(num(v.pct, stages[key]?.pct ?? 0), 0, 100);
      const floor = Math.max(0, num(v.floor_ngn, stages[key]?.floor_ngn ?? 0));
      stages[key] = { pct, floor_ngn: floor };
    }
  }

  return {
    enabled: bool(o.enabled, d.enabled),
    auto_approve_unassigned: bool(o.auto_approve_unassigned, d.auto_approve_unassigned),
    waive_when_our_fault: bool(o.waive_when_our_fault, d.waive_when_our_fault),
    stages,
  };
}

export type Retention = {
  /** What the client gets back, in naira. */
  refundable_ngn: number;
  /** What is kept, in naira. */
  retained_ngn: number;
  /** The percentage actually applied, after clamping. For display. */
  applied_pct: number;
  /** One sentence a client can read, and an admin can be held to. */
  basis: string;
  /** True when no buddy had committed, so the whole amount comes back. */
  pre_assignment: boolean;
  /** True when rule 2 fired: our failure, so nothing is kept. */
  waived_for_fault: boolean;
};

/**
 * The whole calculation, in one place.
 *
 * `fault` is optional because the client asking for a refund has not been
 * assigned a fault yet. Quoting without one shows the client the worst case
 * they could face, which is the honest thing to put in front of them: a quote
 * can only improve once a human looks at it, never worsen.
 */
export function computeRetention(
  status: string,
  paidNgn: number,
  policy: RefundPolicy = DEFAULT_REFUND_POLICY,
  fault?: Fault | null,
): Retention {
  const paid = Math.max(0, round2(num(paidNgn, 0)));

  const none = (basis: string, extra: Partial<Retention> = {}): Retention => ({
    refundable_ngn: paid,
    retained_ngn: 0,
    applied_pct: 0,
    basis,
    pre_assignment: false,
    waived_for_fault: false,
    ...extra,
  });

  if (paid <= 0) return none("Nothing has been paid on this request, so there is nothing to refund.");

  // Rule 1. No buddy has committed, so no cost has been incurred.
  if (PRE_ASSIGNMENT_STATUSES.includes(status)) {
    return none("No buddy has been assigned yet, so the full amount comes back.", { pre_assignment: true });
  }

  // Rule 2. Our failure is never charged to the client.
  if (fault && policy.waive_when_our_fault && BLAMELESS_FAULTS.includes(fault)) {
    const who = fault === "ours" ? "This was our failure" : "This was the buddy's failure";
    return none(`${who}, so the full amount comes back and nothing is retained.`, { waived_for_fault: true });
  }

  // Rule 3. The stage decides.
  const rule = policy.stages[status];
  if (!rule) {
    // An unknown status is not a licence to keep somebody's money.
    return none("This stage has no retention rule set, so the full amount comes back.");
  }

  const byPct = round2((paid * clamp(rule.pct, 0, 100)) / 100);
  // The floor never exceeds what was actually paid: a 1,000 naira minimum on a
  // 600 naira task would otherwise retain more than the client handed over.
  const floor = Math.min(Math.max(0, rule.floor_ngn), paid);
  const retained = round2(Math.min(Math.max(byPct, floor), paid));
  const refundable = round2(paid - retained);
  const appliedPct = paid > 0 ? round2((retained / paid) * 100) : 0;

  let basis: string;
  if (retained <= 0) {
    basis = `Nothing is retained at the "${stageLabel(status)}" stage, so the full amount comes back.`;
  } else if (retained >= paid) {
    basis = `The work had already reached "${stageLabel(status)}", so none of it is refundable.`;
  } else if (floor > byPct) {
    basis = `At the "${stageLabel(status)}" stage a minimum of ${naira(floor)} is non refundable, which is more than ${rule.pct}% of this task.`;
  } else {
    basis = `At the "${stageLabel(status)}" stage ${rule.pct}% of the amount paid is non refundable.`;
  }

  return {
    refundable_ngn: refundable,
    retained_ngn: retained,
    applied_pct: appliedPct,
    basis,
    pre_assignment: false,
    waived_for_fault: false,
  };
}

/** The published rules, rendered as plain sentences for the client facing
 *  policy box. Generated from the policy rather than written by hand, so the
 *  page can never drift away from what the code actually does. */
export function policySummary(policy: RefundPolicy = DEFAULT_REFUND_POLICY): string[] {
  const lines: string[] = [];
  lines.push("Before a buddy is assigned, you get everything back.");
  for (const status of ["assigned", "in_progress", "proof_ready", "proof_approved", "completed"]) {
    const rule = policy.stages[status];
    if (!rule) continue;
    if (rule.pct >= 100) {
      lines.push(`Once the task reaches "${stageLabel(status)}", the work is done and the payment is no longer refundable.`);
    } else if (rule.pct > 0 || rule.floor_ngn > 0) {
      const floorPart = rule.floor_ngn > 0 ? `, or ${naira(rule.floor_ngn)}, whichever is greater` : "";
      lines.push(`Once the task reaches "${stageLabel(status)}", ${rule.pct}% of what you paid${floorPart} is non refundable.`);
    } else {
      lines.push(`At "${stageLabel(status)}" you still get everything back.`);
    }
  }
  if (policy.waive_when_our_fault) {
    lines.push("If the task failed because of us or the buddy, you get everything back whatever stage it had reached.");
  }
  // Collapse runs of identical consecutive sentences, which happens whenever
  // several late stages share the same rule.
  return lines.filter((line, i) => line !== lines[i - 1]);
}

/** What the client's refund panel needs in order to draw itself. Declared
 *  here, in the pure module, so both the server action and the client
 *  component can import it without either one importing the other. */
export type RefundQuote = {
  /** Is the refund flow live on this deployment at all? False when the policy
   *  is switched off or migration 0042 has not been run. The client page uses
   *  this to decide whether to fall back to the older cancel button, so a
   *  half migrated database never leaves somebody with no way out. */
  enabled: boolean;
  available: boolean;
  reason: string;
  paid_ngn: number;
  refundable_ngn: number;
  retained_ngn: number;
  basis: string;
  rules: string[];
  reasons: ReadonlyArray<readonly [string, string]>;
  openRequest: { id: string; created_at: string; reason: string } | null;
  lastDecision: {
    status: string;
    refunded_ngn: number | null;
    retained_ngn: number | null;
    decision_note: string | null;
    decided_at: string | null;
  } | null;
};

export function stageLabel(status: string): string {
  const map: Record<string, string> = {
    paid: "paid",
    assigned: "buddy assigned",
    in_progress: "in progress",
    proof_ready: "proof submitted",
    proof_approved: "proof approved",
    completed: "completed",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

/* ---------- small helpers, kept private ---------- */

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
