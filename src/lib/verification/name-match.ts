/** Comparing a name on a bank account with a name on an application.
 *
 *  Pure functions, no network, no database, so this is testable on its own and
 *  importable from anywhere.
 *
 *  This has to work for Nigerian names as people actually write them, which
 *  means handling all of the following as the SAME person:
 *
 *    "Ebuka Iloh"            vs  "ILOH EBUKA"              (order reversed)
 *    "Ebuka Iloh"            vs  "ILOH EBUKA CHUKWUDI"     (extra middle name)
 *    "Ebuka Chukwudi Iloh"   vs  "ILOH E C"                (initials)
 *    "Ebuka Iloh"            vs  "MR EBUKA ILOH"           (title)
 *    "Adéwálé Òjó"           vs  "ADEWALE OJO"             (diacritics)
 *    "Chukwu-Emeka Nwosu"    vs  "CHUKWU EMEKA NWOSU"      (hyphen)
 *
 *  And must NOT pass two different people who share one common first name.
 */

/** Honorifics and suffixes that carry no identifying information. */
const NOISE = new Set([
  "MR", "MRS", "MISS", "MS", "DR", "PROF", "ENGR", "ARCH", "BARR", "PASTOR",
  "REV", "CHIEF", "ALHAJI", "ALHAJA", "HAJIA", "SIR", "LADY", "JR", "SNR", "SR",
]);

/** Uppercase, strip accents, turn anything that is not a letter into a space. */
export function normaliseName(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // drop combining accents
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")          // hyphens, dots, apostrophes all become gaps
    .trim()
    .replace(/\s+/g, " ");
}

export function nameTokens(raw: string): string[] {
  return normaliseName(raw).split(" ").filter((t) => t && !NOISE.has(t));
}

export type NameMatch = {
  /** pass = same person. review = plausible, needs an eye. fail = not a match. */
  outcome: "pass" | "review" | "fail";
  /** 0 to 1, share of the shorter name's tokens that were found in the longer. */
  score: number;
  matched: string[];
  unmatched: string[];
  reason: string;
};

/**
 * Compare two names.
 *
 * Deliberately asymmetric about length: a bank holding more names than the
 * application (or the reverse) is normal and not suspicious, so every token of
 * the SHORTER name must be accounted for in the longer one, and extra names on
 * the other side are ignored.
 *
 * A single matching token is never a pass, however common. "Ebuka" matching
 * "Ebuka" tells you almost nothing in a country where first names repeat
 * constantly; two independent tokens is the minimum worth trusting.
 */
export function matchNames(applicant: string, bankName: string): NameMatch {
  const a = nameTokens(applicant);
  const b = nameTokens(bankName);

  if (a.length === 0 || b.length === 0) {
    return { outcome: "fail", score: 0, matched: [], unmatched: [], reason: "One of the names is empty." };
  }

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const pool = [...longer];
  const matched: string[] = [];
  const unmatched: string[] = [];
  let fullWordMatches = 0;

  for (const token of shorter) {
    // Exact token first.
    let i = pool.findIndex((p) => p === token);
    if (i >= 0) {
      matched.push(token);
      if (token.length >= 3) fullWordMatches++;
      pool.splice(i, 1);
      continue;
    }
    // Then an initial standing in for a full name, in either direction.
    i = pool.findIndex((p) =>
      (token.length === 1 && p.startsWith(token)) ||
      (p.length === 1 && token.startsWith(p)),
    );
    if (i >= 0) {
      matched.push(token);
      pool.splice(i, 1);
      continue;
    }
    unmatched.push(token);
  }

  const score = matched.length / shorter.length;

  if (score === 1 && matched.length >= 2 && fullWordMatches >= 1) {
    return { outcome: "pass", score, matched, unmatched, reason: "Every name matches." };
  }
  if (score === 1 && matched.length === 1) {
    return {
      outcome: "review", score, matched, unmatched,
      reason: "Only one name to compare — too little to confirm identity on its own.",
    };
  }
  if (score === 1 && fullWordMatches === 0) {
    return {
      outcome: "review", score, matched, unmatched,
      reason: "Matched on initials only — confirm against the ID document.",
    };
  }
  if (score >= 0.5) {
    return {
      outcome: "review", score, matched, unmatched,
      reason: `Partial match — "${unmatched.join(", ")}" not found on the account.`,
    };
  }
  return {
    outcome: "fail", score, matched, unmatched,
    reason: "The account is in a different name.",
  };
}
