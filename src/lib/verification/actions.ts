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

/**
 * Admin: give existing buddies the bank code their typed bank name implies,
 * then they can be verified like anyone who registered after the key was set.
 * Pass dryRun to see what it would do without writing anything.
 */
export async function runBankCodeBackfill(dryRun = false) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return null;
  const { backfillBankCodes } = await import("@/lib/verification/bank");
  const r = await backfillBankCodes(dryRun);
  if (!dryRun) revalidatePath("/admin/buddies");
  return r;
}

/**
 * Admin sets one buddy's bank by hand, for the ones the backfill could not
 * place. Takes a code from the Paystack list, never a free-text name, so an
 * unresolvable value cannot be stored.
 */
export async function setBuddyBankCode(buddyId: string, bankCode: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized." };
  if (!buddyId || !bankCode) return { error: "Pick a bank." };

  const { listNigerianBanks, verifyBuddyBankAccount } = await import("@/lib/verification/bank");
  const banks = await listNigerianBanks();
  const bank = banks.find((b) => b.code === bankCode);
  if (!bank) return { error: "That bank is not in Paystack's list." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const { error } = await db
    .from("buddy_profiles")
    .update({ bank_code: bank.code, bank_name: bank.name })
    .eq("id", buddyId);
  if (error) return { error: error.message };

  await db.from("audit_log").insert({
    actor_id: p.id, action: "set_buddy_bank_code", target_id: buddyId,
    detail: { bank_code: bank.code, bank_name: bank.name },
  });

  // Run the check straight away: setting the bank is the only thing that was
  // standing between this buddy and an automatic verification.
  const r = await verifyBuddyBankAccount(buddyId, p.id);
  revalidatePath("/admin/buddies");
  return { error: "", result: r };
}
