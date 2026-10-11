"use server";
/**
 * The guarded surface for bank verification.
 *
 * Every export here is a public HTTP endpoint, so each establishes who is
 * calling first. `verifyBuddyBankAccount` takes a buddy id and triggers an
 * outbound lookup, so it is never exposed directly — it lives in ./bank.ts and
 * is reached only through these wrappers.
 */
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/roles";

/** The bank dropdown for the payout form. Any signed-in user may read it; it
 *  is public reference data, not anybody's information. */
export async function getBankList() {
  const p = await getCurrentProfile();
  if (!p) return [];
  const { listNigerianBanks } = await import("@/lib/verification/bank");
  return listNigerianBanks();
}

/** Admin re-runs the check on a buddy, from the vetting screen. */
export async function runBankCheck(buddyId: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  const { verifyBuddyBankAccount } = await import("@/lib/verification/bank");
  const r = await verifyBuddyBankAccount(buddyId, p.id);
  revalidatePath("/admin/buddies");
  return { error: r.ran ? "" : r.reason, result: r };
}

/** A buddy checks their own account, so they can fix a typo before an admin
 *  ever sees it. Scoped to themselves: no buddy id is accepted. */
export async function checkMyBankAccount() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const { verifyBuddyBankAccount } = await import("@/lib/verification/bank");
  const r = await verifyBuddyBankAccount(p.id, p.id);
  revalidatePath("/buddy/settings");
  return { error: r.ran ? "" : r.reason, result: r };
}

/** Is the integration switched on for this deployment? Lets the UI explain
 *  itself instead of silently doing nothing. */
export async function bankCheckAvailable() {
  const p = await getCurrentProfile();
  if (!p) return false;
  const { bankCheckConfigured } = await import("@/lib/verification/bank");
  return bankCheckConfigured();
}
