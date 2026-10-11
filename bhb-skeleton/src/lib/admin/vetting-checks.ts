/** The buddy vetting checklist.
 *
 *  Previously this was a flat list where EVERY item had to be ticked before a
 *  buddy could be approved. That made the checklist impossible to change: you
 *  could not drop a check without blocking approval entirely, and you could not
 *  demand a stricter check for riskier work without demanding it for everyone.
 *
 *  Each check now carries three extra facts:
 *
 *    required  — does a missing tick block approval at all?
 *    minTier   — if required, from which trust tier upward? null means always.
 *    auto      — set by the system rather than ticked by an admin.
 *
 *  Shared by server actions (the approval gate) and the admin UI (the
 *  checklist). Pure data and pure functions only, no database access, so this
 *  file stays importable from both client and server components.
 */

export type TrustTier = "standard" | "high_value" | "safeguarding";

/** Ascending order of exposure. Used to compare tiers. */
export const TRUST_TIERS: readonly TrustTier[] = ["standard", "high_value", "safeguarding"];

export function tierRank(t: TrustTier): number {
  const i = TRUST_TIERS.indexOf(t);
  return i < 0 ? 0 : i;
}

export type VettingCheck = {
  key: string;
  label: string;
  /** False means informational: the admin can still tick it, but it never blocks approval. */
  required: boolean;
  /** Lowest trust tier at which this becomes required. null = required at every tier. */
  minTier: TrustTier | null;
  /** Set by the system (e.g. the buddy signing the NDA in their portal), not tickable by hand. */
  auto?: boolean;
  /** Shown under the label in the admin checklist. */
  hint?: string;
};

export const VETTING_CHECK_DEFS: readonly VettingCheck[] = [
  {
    key: "nda_signed", label: "NDA signed by buddy (in-app)",
    required: true, minTier: null, auto: true,
  },
  {
    key: "bank_name_match", label: "Bank account name matches applicant",
    required: true, minTier: null,
    hint: "Free. The account already passed the bank's own KYC, so a match is strong identity evidence at no cost.",
  },
  {
    key: "id_verified", label: "ID document verified (matches name + photo)",
    required: true, minTier: null,
  },
  {
    key: "nin_checked", label: "NIN checked",
    required: true, minTier: null,
    hint: "Admin comparison of the NIN slip is sufficient. Automated NIN lookup is optional and only required above standard tier.",
  },
  {
    key: "identity_verified", label: "Identity verified against government record",
    required: true, minTier: "high_value",
    hint: "Automated NIN lookup with face match, OR an admin-checked selfie holding the ID with a dated code. Only required for high value and safeguarding work.",
  },
  {
    key: "address_verified", label: "Address verified (utility bill / visit)",
    required: true, minTier: null,
  },
  {
    key: "guarantor1_verified", label: "Guarantor 1 contacted & confirmed",
    required: true, minTier: null,
  },
  {
    key: "guarantor2_verified", label: "Guarantor 2 contacted & confirmed",
    required: true, minTier: null,
  },
  {
    key: "trial_task_passed", label: "Trial proof task passed",
    required: true, minTier: null,
    hint: "The strongest single screen: it tests the actual job — travel, GPS, instructions, punctuality and written reporting — and mostly scores itself.",
  },
  {
    key: "interview_done", label: "Interview completed",
    required: true, minTier: null,
  },
  {
    key: "training_done", label: "Training completed",
    required: true, minTier: null,
  },
  {
    key: "pcc_received", label: "Police Character Certificate received",
    required: false, minTier: null,
    hint: "No longer blocks approval. Nigeria has no unified criminal record database, so a PCC attests to one command's file rather than to history, and is obtainable for a fee regardless. Tick it if you have one; its absence proves nothing either way.",
  },
  {
    key: "met_in_person", label: "Met in person",
    required: true, minTier: "safeguarding",
    hint: "Required before any task involving contact with a vulnerable person.",
  },
];

/** Back-compatible [key, label] list. Existing callers keep working unchanged. */
export const VETTING_CHECKS: ReadonlyArray<readonly [string, string]> =
  VETTING_CHECK_DEFS.map((d) => [d.key, d.label] as const);

export function checkDef(key: string): VettingCheck | undefined {
  return VETTING_CHECK_DEFS.find((d) => d.key === key);
}

export function isKnownCheck(key: string): boolean {
  return VETTING_CHECK_DEFS.some((d) => d.key === key);
}

/**
 * The checks that actually block approval at a given clearance level.
 *
 * `tier` is the highest trust tier this buddy is being cleared for. Approving
 * someone for standard work does not demand the safeguarding checks; promoting
 * them later does. That is the point: verify at the point of risk, not the
 * point of entry.
 *
 * `overrides` lets an operator mark a check optional without a deploy. A check
 * can only ever be relaxed this way, never tightened silently.
 */
export function requiredChecksFor(
  tier: TrustTier = "standard",
  overrides: Record<string, boolean> = {},
): VettingCheck[] {
  return VETTING_CHECK_DEFS.filter((d) => {
    if (overrides[d.key] === false) return false;      // explicitly relaxed
    if (!d.required && overrides[d.key] !== true) return false;
    if (d.minTier && tierRank(tier) < tierRank(d.minTier)) return false;
    return true;
  });
}

/** Labels of the blocking checks still outstanding. Empty array means clear to approve. */
export function missingRequired(
  ticked: Record<string, boolean>,
  tier: TrustTier = "standard",
  overrides: Record<string, boolean> = {},
): string[] {
  return requiredChecksFor(tier, overrides).filter((d) => !ticked[d.key]).map((d) => d.label);
}
