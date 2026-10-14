/** Supported display currencies. NGN is the internal base; the others convert
 *  from NGN at admin-set rates (units of NGN per 1 unit of the currency). */
export const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "NGN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<Currency, { label: string; symbol: string; locale: string; flag: string }> = {
  USD: { label: "US Dollar", symbol: "$", locale: "en-US", flag: "🇺🇸" },
  GBP: { label: "British Pound", symbol: "£", locale: "en-GB", flag: "🇬🇧" },
  EUR: { label: "Euro", symbol: "€", locale: "en-IE", flag: "🇪🇺" },
  CAD: { label: "Canadian Dollar", symbol: "C$", locale: "en-CA", flag: "🇨🇦" },
  NGN: { label: "Nigerian Naira", symbol: "₦", locale: "en-NG", flag: "🇳🇬" },
};

export function isCurrency(x: unknown): x is Currency {
  return typeof x === "string" && (CURRENCIES as readonly string[]).includes(x);
}

/** Rates map: NGN per 1 unit of currency. NGN is always 1. */
export type RateMap = Record<Currency, number>;

export const DEFAULT_RATES: RateMap = { USD: 1500, GBP: 1900, EUR: 1650, CAD: 1100, NGN: 1 };

/** Convert an internal NGN amount into the target currency and format it. */
export function formatMoneyIn(ngn: number, currency: Currency, rates: RateMap): string {
  const rate = rates[currency] || (currency === "NGN" ? 1 : 0);
  const meta = CURRENCY_META[currency];
  if (!rate) {
    // No rate set — fall back to NGN so nothing renders blank.
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(ngn);
  }
  const value = currency === "NGN" ? ngn : ngn / rate;
  return new Intl.NumberFormat(meta.locale, {
    style: "currency", currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(value);
}

/** PDF-safe money: same value, but uses ASCII currency codes/symbols only, so
 *  the standard PDF font (WinAnsi) can always render it. The Naira sign ₦ and
 *  some symbols aren't WinAnsi-encodable, so we prefix the ISO code instead. */
export function formatMoneyPdf(ngn: number, currency: Currency, rates: RateMap): string {
  const rate = rates[currency] || (currency === "NGN" ? 1 : 0);
  const effective = rate ? currency : "NGN";
  const value = effective === "NGN" ? ngn : ngn / (rates[effective] || 1);
  const digits = effective === "NGN" ? 0 : 2;
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  // WinAnsi has $ £ € but NOT ₦; use ISO code for NGN (and as a safe default).
  const prefix: Record<Currency, string> = { USD: "$", GBP: "GBP ", EUR: "EUR ", CAD: "CAD ", NGN: "NGN " };
  return `${prefix[effective]}${num}`;
}

/**
 * The rates a given request must be charged at.
 *
 * Once a quote has gone out, the client was shown a figure in their own
 * currency. That figure is a promise, and it must not move when an admin
 * updates the exchange rate the next morning: the client would transfer the
 * new, smaller amount while the system went on recording the original naira
 * price as paid in full.
 *
 * `fx_rates_snapshot` is written when the quote is sent (migration 0044).
 * Requests quoted before that column existed have none, and fall back to live
 * rates, which is the behaviour they already had.
 */
export function ratesForRequest(snapshot: unknown, live: RateMap): RateMap {
  if (!snapshot || typeof snapshot !== "object") return live;
  const snap = snapshot as Record<string, unknown>;
  const out = { ...live } as RateMap;
  let used = false;
  for (const c of CURRENCIES) {
    const v = Number(snap[c]);
    if (Number.isFinite(v) && v > 0) { out[c] = v; used = true; }
  }
  out.NGN = 1;
  return used ? out : live;
}
