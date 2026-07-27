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
