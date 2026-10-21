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

/* ------------------------------------------------------------------ *
 * Backfilling the bank code for buddies who registered before the
 * Paystack key was set
 * ------------------------------------------------------------------ */

/** Strip everything that varies between how people write a bank's name:
 *  case, punctuation, the words BANK, PLC, LIMITED, NIGERIA, and spaces. */
function bankKey(raw: string): string {
  return (raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(BANK|PLC|LTD|LIMITED|NIGERIA|NIG|OF|AND)\b/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

/** The handful of names Nigerians actually type, mapped to the bank's name
 *  AS bankKey() normalises it — not as Paystack writes it. That distinction
 *  matters: bankKey strips the words BANK, OF and AND, so Paystack's "United
 *  Bank For Africa" normalises to UNITEDFORAFRICA, and an alias pointing at
 *  UNITEDBANKFORAFRICA matches nothing at all. Caught by the unit tests.
 *  Without these, "GTB" and "UBA" resolve to nobody. */
const ALIASES: Record<string, string> = {
  GTB: "GUARANTYTRUST",
  GT: "GUARANTYTRUST",
  GTBANK: "GUARANTYTRUST",
  GUARANTYTRUSTBANK: "GUARANTYTRUST",
  FIRST: "FIRST",
  FIRSTBANK: "FIRST",
  FBN: "FIRST",
  UBA: "UNITEDFORAFRICA",
  UNITEDBANKFORAFRICA: "UNITEDFORAFRICA",
  ZENITH: "ZENITH",
  ACCESS: "ACCESS",
  GTCO: "GUARANTYTRUST",
  STANBIC: "STANBICIBTC",
  IBTC: "STANBICIBTC",
  STANBICIBTC: "STANBICIBTC",
  POLARIS: "POLARIS",
  UNION: "UNION",
  FIDELITY: "FIDELITY",
  STERLING: "STERLING",
  WEMA: "WEMA",
  KUDA: "KUDA",
  OPAY: "OPAY",
  PALMPAY: "PALMPAY",
  MONIEPOINT: "MONIEPOINT",
  MONIEPOINTMFB: "MONIEPOINT",
};

export type BackfillResult = {
  ran: boolean;
  reason: string;
  matched: number;
  /** `candidates` is the list of banks that tied, so the admin can see WHY it
   *  refused rather than being told only that it did. */
  ambiguous: { id: string; name: string; bank: string; candidates: string[] }[];
  unmatched: { id: string; name: string; bank: string }[];
};

/** Words that mark a different KIND of institution. A buddy who typed
 *  "Zenith Bank" did not mean a microfinance bank that happens to share the
 *  name, so candidates carrying these are dropped unless the buddy used one. */
const INSTITUTION_WORDS = ["MICROFINANCE", "MFB", "MORTGAGE", "MERCHANT", "NONINTEREST", "BUREAU"];

function hasInstitutionWord(raw: string): boolean {
  const u = (raw || "").toUpperCase().replace(/[^A-Z]+/g, "");
  return INSTITUTION_WORDS.some((w) => u.includes(w));
}

/**
 * Narrow a tie down to one bank, or give up honestly.
 *
 * Tried in order of how much evidence each rule carries, strongest first. A
 * rule only applies if it leaves exactly one candidate; otherwise the next is
 * tried, and if none of them settle it the tie is reported with the names.
 */
function narrow(typed: string, key: string, candidates: Bank[]): { bank: Bank | null; tied: Bank[] } {
  // Several list entries that are really the same bank are not a tie at all.
  const byCode = new Map(candidates.map((b) => [b.code, b]));
  let pool = [...byCode.values()];
  if (pool.length === 1) return { bank: pool[0], tied: [] };

  // 1. The typed name IS one of the bank names, give or take spacing and case.
  const squash = (x: string) => x.toUpperCase().replace(/\s+/g, " ").trim();
  const exact = pool.filter((b) => squash(b.name) === squash(typed));
  if (exact.length === 1) return { bank: exact[0], tied: [] };

  // 2. Equal normalised names beat ones that merely share a prefix: "ZENITH"
  //    should not be dragged into a tie by "ZENITH SOMETHING ELSE".
  const equal = pool.filter((b) => bankKey(b.name) === key);
  if (equal.length === 1) return { bank: equal[0], tied: [] };
  if (equal.length > 1) pool = equal;

  // 3. A plain bank beats a microfinance or mortgage bank of the same name,
  //    unless the buddy actually wrote one of those words.
  if (!hasInstitutionWord(typed)) {
    const plain = pool.filter((b) => !hasInstitutionWord(b.name));
    if (plain.length === 1) return { bank: plain[0], tied: [] };
    if (plain.length > 1) pool = plain;
  }

  return { bank: null, tied: pool };
}

/**
 * Give every existing buddy the Paystack bank code their typed bank name implies.
 *
 * WHY THIS IS NEEDED
 *
 * The automated check resolves an account number against a numeric bank code.
 * That code is only captured when the buddy picks their bank from a dropdown,
 * and that dropdown only renders once PAYSTACK_SECRET_KEY is set. So every
 * buddy who registered before the key was added typed their bank as free text
 * and has no code. For them the check stops at "No bank selected" forever, and
 * there is no screen where anyone can fix it.
 *
 * This reads each of those buddies' typed bank name, normalises it, and sets
 * the code where exactly one bank matches. Anything ambiguous or unrecognised
 * is reported rather than guessed, because writing the wrong code would
 * resolve a real account belonging to the wrong person.
 *
 * Safe to run repeatedly: it only touches rows where bank_code is null.
 */
export async function backfillBankCodes(dryRun = false): Promise<BackfillResult> {
  const empty = (reason: string): BackfillResult =>
    ({ ran: false, reason, matched: 0, ambiguous: [], unmatched: [] });

  if (!secret()) return empty("PAYSTACK_SECRET_KEY is not set, so the bank list cannot be fetched.");

  const banks = await listNigerianBanks();
  if (!banks.length) return empty("Paystack returned no bank list. Check the secret key.");

  // Keep the whole bank, not just the code: narrowing a tie needs the names.
  const byKey = new Map<string, Bank[]>();
  for (const b of banks) {
    const k = bankKey(b.name);
    if (!k) continue;
    byKey.set(k, [...(byKey.get(k) ?? []), b]);
  }

  const db = createAdminClient();
  const { data: rows } = await db
    .from("buddy_profiles")
    .select("id, bank_name, bank_account_number, profiles!buddy_profiles_id_fkey(full_name)")
    .is("bank_code", null)
    .not("bank_name", "is", null);

  const ambiguous: BackfillResult["ambiguous"] = [];
  const unmatched: BackfillResult["unmatched"] = [];
  let matched = 0;

  for (const r of rows ?? []) {
    const who = ((Array.isArray((r as any).profiles) ? (r as any).profiles[0] : (r as any).profiles)?.full_name) || r.id;
    const typed = String((r as any).bank_name || "");
    const k = bankKey(typed);
    const resolvedKey = ALIASES[k] ?? k;

    // Gather every plausible bank: the exact normalised name first, then
    // anything sharing a prefix either way ("ZENITH" against "ZENITHBANK").
    const candidates: Bank[] = [...(byKey.get(resolvedKey) ?? [])];
    if (resolvedKey.length >= 4) {
      for (const [key, list] of byKey.entries()) {
        if (key === resolvedKey) continue;
        if (key.startsWith(resolvedKey) || resolvedKey.startsWith(key)) candidates.push(...list);
      }
    }

    if (candidates.length === 0) { unmatched.push({ id: r.id, name: who, bank: typed }); continue; }

    const { bank, tied } = narrow(typed, resolvedKey, candidates);
    if (!bank) {
      ambiguous.push({ id: r.id, name: who, bank: typed, candidates: tied.map((b) => b.name) });
      continue;
    }

    if (!dryRun) await db.from("buddy_profiles").update({ bank_code: bank.code, bank_name: bank.name }).eq("id", r.id);
    matched++;
  }

  return {
    ran: true,
    reason: dryRun ? "Preview only — nothing was saved." : "",
    matched, ambiguous, unmatched,
  };
}
