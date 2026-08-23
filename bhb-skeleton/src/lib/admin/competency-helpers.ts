/** Plain synchronous helpers shared by competency + interview features.
 *  These live OUTSIDE any "use server" file, because every export in a
 *  "use server" module must be an async server action. */

export type CompScoreKey =
  | "comp_property" | "comp_welfare" | "comp_documents" | "comp_purchases"
  | "comp_communication" | "comp_reliability";

/** Map a service type name to a competency dimension, so a task can be matched
 *  to the right buddy strength. Extend as your service catalog grows. */
export function taskTypeToDimension(serviceName?: string): CompScoreKey | null {
  const s = (serviceName || "").toLowerCase();
  if (/propert|land|inspect|verif|house|building/.test(s)) return "comp_property";
  if (/welfare|visit|check|family|elder|care/.test(s)) return "comp_welfare";
  if (/document|office|govern|paper|certificate|registrat/.test(s)) return "comp_documents";
  if (/purchase|buy|market|shop|deliver|errand/.test(s)) return "comp_purchases";
  return null;
}

export type AnswerMap = Record<string, { score?: number; note?: string }>;

import { isHonesty } from "@/lib/admin/interview-catalog";

/** Compute a simple overall score + suggested decision from the answers. */
export function summarize(answers: AnswerMap, proofScore: number | null) {
  const scored = Object.entries(answers).filter(([, a]) => typeof a.score === "number");
  const total = scored.reduce((s, [, a]) => s + (a.score || 0), 0);
  const avg = scored.length ? total / scored.length : 0;
  const honestyFlag = scored.some(([k, a]) => isHonesty(k) && (a.score || 0) <= 2);
  const proofFail = proofScore != null && proofScore <= 2;
  let decision: "advance" | "trial" | "decline" = "advance";
  if (honestyFlag || proofFail) decision = "decline";
  else if (avg < 3.2) decision = "trial";
  return { overall: Math.round(avg * 20), decision, honestyFlag, proofFail, answered: scored.length };
}
