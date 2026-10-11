/**
 * Automated bank account name verification, via Paystack's free resolve
 * endpoint.
 *
 * SECURITY: no "use server" here. Every export from a "use server" module is a
 * callable HTTP endpoint, and `verifyBuddyBankAccount` takes a buddy id — if it
 * were exposed, a stranger could trigger lookups against arbitrary accounts.
 * The guarded wrappers live in ./actions.ts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { matchNames } from "@/lib/verification/name-match";

if (typeof window !== "undefined") {
  throw new Error("verification/bank is server-only and must never reach the browser.");
}

const PAYSTACK = "https://api.paystack.co";

function secret(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

export function bankCheckConfigured(): boolean {
  return Boolean(secret());
}

export type Bank = { name: string; code: string; slug?: string };

/**
 * The list of Nigerian banks with their codes, for the payout form's dropdown.
 *
 * Cached in app_settings for a day: the list changes rarely and there is no
 * sense calling Paystack every time a buddy opens their settings page.
 */
export async function listNigerianBanks(): Promise<Bank[]> {
  const db = createAdminClient();
  const KEY = "paystack_bank_list";

  try {
    const { data } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const cached = data?.value as any;
    if (cached?.at && Date.now() - Number(cached.at) < 24 * 60 * 60 * 1000 && Array.isArray(cached.banks)) {
      return cached.banks as Bank[];
    }
  } catch { /* fall through to a fresh fetch */ }

  const key = secret();
  if (!key) return [];

  try {
    const res = await fetch(`${PAYSTACK}/bank?country=nigeria&perPage=100`, {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const banks: Bank[] = (json?.data ?? [])
      .map((b: any) => ({ name: String(b.name), code: String(b.code), slug: b.slug }))
      .sort((a: Bank, b: Bank) => a.name.localeCompare(b.name));
    if (banks.length) {
      await db.from("app_settings").upsert({
        key: KEY, value: { at: Date.now(), banks }, updated_at: new Date().toISOString(),
      });
    }
    return banks;
  } catch {
    return [];
  }
}

export type ResolveResult =
  | { ok: true; accountName: string }
  | { ok: false; reason: string };

/** Ask the bank who owns this account. Never throws. */
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<ResolveResult> {
  const key = secret();
  if (!key) return { ok: false, reason: "PAYSTACK_SECRET_KEY is not set" };

  const acct = (accountNumber || "").replace(/\D/g, "");
  if (acct.length !== 10) return { ok: false, reason: "Account number must be 10 digits (NUBAN)" };
  if (!bankCode) return { ok: false, reason: "No bank selected" };

  try {
    const res = await fetch(
      `${PAYSTACK}/bank/resolve?account_number=${encodeURIComponent(acct)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { authorization: `Bearer ${key}` } },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.status) {
      // Paystack returns a readable message for a wrong number or bank.
      return { ok: false, reason: String(json?.message || `Paystack ${res.status}`) };
    }
    const name = String(json?.data?.account_name || "").trim();
    if (!name) return { ok: false, reason: "The bank returned no account name" };
    return { ok: true, accountName: name };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Could not reach Paystack" };
  }
}

export type BankCheck = {
  ran: boolean;
  outcome: "pass" | "review" | "fail" | null;
  bankName: string | null;
  score: number | null;
  reason: string;
  duplicateOf: string[];
};

/**
 * The whole automated check for one buddy: resolve, compare, record.
 *
 * Writes to identity_checks either way, so a failed lookup is as visible as a
 * successful one. On a clean pass it also ticks the bank_name_match vetting
 * box, which is the point of automating it — the admin stops doing that by
 * hand.
 *
 * Never throws: a verification failure must not break saving payout details.
 */
export async function verifyBuddyBankAccount(
  buddyId: string,
  actorId: string | null = null,
): Promise<BankCheck> {
  const db = createAdminClient();
  const miss = (reason: string): BankCheck =>
    ({ ran: false, outcome: null, bankName: null, score: null, reason, duplicateOf: [] });

  try {
    const { data: b } = await db
      .from("buddy_profiles")
      .select("id, bank_account_number, bank_code, bank_name, profiles!buddy_profiles_id_fkey(full_name)")
      .eq("id", buddyId)
      .maybeSingle();
    if (!b) return miss("Buddy not found.");

    const applicant = ((Array.isArray((b as any).profiles) ? (b as any).profiles[0] : (b as any).profiles)?.full_name) || "";
    if (!applicant) return miss("No name on the buddy's profile to compare against.");
    if (!b.bank_account_number) return miss("No account number on file yet.");
    if (!(b as any).bank_code) return miss("No bank selected — pick the bank from the list so it can be looked up.");

    const resolved = await resolveAccount(b.bank_account_number, (b as any).bank_code);

    if (!resolved.ok) {
      await db.from("identity_checks").insert({
        buddy_id: buddyId, check_type: "bank_account_name", provider: "paystack",
        outcome: "inconclusive", result: { error: resolved.reason }, performed_by: actorId,
      });
      return miss(resolved.reason);
    }

    const m = matchNames(applicant, resolved.accountName);

    // Same payout account on another buddy: the clearest signal of one person
    // running several accounts. Flagged, never blocked — families do share.
    const { data: dupes } = await db
      .from("buddy_profiles")
      .select("id, profiles!buddy_profiles_id_fkey(full_name)")
      .eq("bank_account_number", b.bank_account_number)
      .neq("id", buddyId);
    const duplicateOf = (dupes ?? []).map(
      (d: any) => (Array.isArray(d.profiles) ? d.profiles[0] : d.profiles)?.full_name || d.id,
    );

    await db.from("buddy_profiles").update({
      bank_verified_name: resolved.accountName,
      bank_verified_at: new Date().toISOString(),
      bank_match_outcome: m.outcome,
      bank_match_score: m.score,
    }).eq("id", buddyId);

    await db.from("identity_checks").insert({
      buddy_id: buddyId, check_type: "bank_account_name", provider: "paystack",
      outcome: m.outcome === "pass" ? "pass" : m.outcome === "fail" ? "fail" : "inconclusive",
      result: {
        applicant, bank_name: resolved.accountName,
        score: m.score, matched: m.matched, unmatched: m.unmatched,
        duplicate_of: duplicateOf,
      },
      performed_by: actorId,
    });

    // The automation's actual payoff: on a clean pass, tick the box itself.
    // A duplicate account holds the tick back for a human, because that is the
    // one case where a perfect name match is not reassuring.
    if (m.outcome === "pass" && duplicateOf.length === 0) {
      const { data: row } = await db.from("buddy_profiles").select("vetting_checks").eq("id", buddyId).maybeSingle();
      const checks = { ...((row?.vetting_checks as any) ?? {}), bank_name_match: true };
      await db.from("buddy_profiles").update({ vetting_checks: checks }).eq("id", buddyId);
    }

    return {
      ran: true, outcome: m.outcome, bankName: resolved.accountName,
      score: m.score, reason: m.reason, duplicateOf,
    };
  } catch (e) {
    return miss(e instanceof Error ? e.message : "The check could not be run.");
  }
}
