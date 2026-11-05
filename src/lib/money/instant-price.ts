/**
 * The price of a standard task, worked out without a human.
 *
 * Pure functions. No network, no database, no React, so it is testable on its
 * own and importable from both the browser and the server.
 *
 * WHY THIS MODULE EXISTS
 *
 * The arithmetic for a published price lived in the browser, inside the new
 * request form, and nowhere else. The server never computed it, because the
 * server never needed to: every request went to a human who typed a quote.
 *
 * That is the bottleneck this removes. Once a client can pay without waiting
 * for a quote, the figure they are shown becomes the figure they are charged,
 * which means exactly one piece of code may produce it. This is that piece.
 * The form imports it and the server imports it, so the two cannot drift.
 */

/** Pricing zone of a region. A is the major metros, B carries an uplift. */
export type Zone = "A" | "B";

/**
 * How a service is priced.
 *
 *  quote  the client asks, a human prices it. The original behaviour.
 *  from   a starting price is displayed, a human still prices the real one.
 *  fixed  the published price IS the price. No human, no waiting.
 */
export type PricingMode = "quote" | "from" | "fixed";

export type PriceInput = {
  fromPriceUsd: number;
  zone: Zone | null;
  zoneBUpliftPct: number;
  urgent: boolean;
  urgentSurchargePct: number;
};

export type PriceLine = { label: string; amountUsd: number; itemType: "service" | "purchase" };

export type Price = {
  /** What the client pays, in US dollars, before any vendor amount. */
  totalUsd: number;
  /** The service component, before the urgency surcharge. */
  baseUsd: number;
  /** The urgency surcharge, zero when the task is standard. */
  urgentUsd: number;
  /** The uplift applied for a region outside the base zone. */
  upliftUsd: number;
  /** Ready to become quote_items rows, so the client sees the breakdown. */
  lines: PriceLine[];
};

/** Guards every input so a malformed setting cannot produce a silly price. */
function clean(n: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Work out what a standard task costs.
 *
 * Deliberately the same three steps the form has always shown: the base price
 * for the service, an uplift if the region is outside the base zone, then the
 * urgency surcharge on top of both. Changing the order would change what
 * clients have been quoted, so it is kept exactly as it was.
 */
export function computeInstantPrice(input: PriceInput): Price {
  const base = clean(input.fromPriceUsd, 0, 0);
  const upliftPct = clean(input.zoneBUpliftPct, 25, 0, 500);
  const urgentPct = clean(input.urgentSurchargePct, 40, 0, 500);

  if (base <= 0) {
    return { totalUsd: 0, baseUsd: 0, urgentUsd: 0, upliftUsd: 0, lines: [] };
  }

  // Zone B pays the uplift. An unknown zone is treated as the base zone
  // rather than silently charging extra for a region we cannot classify.
  const zoned = input.zone === "B" ? base * (1 + upliftPct / 100) : base;
  const uplift = round2(zoned - base);

  const urgent = input.urgent ? round2(zoned * (urgentPct / 100)) : 0;
  const total = round2(zoned + urgent);

  const lines: PriceLine[] = [{ label: "Service fee", amountUsd: round2(zoned), itemType: "service" }];
  if (urgent > 0) {
    lines.push({ label: `Urgent handling (${urgentPct}%)`, amountUsd: urgent, itemType: "service" });
  }

  return { totalUsd: total, baseUsd: round2(base), urgentUsd: urgent, upliftUsd: uplift, lines };
}

/** Can this service be paid for without anybody writing a quote? */
export function isInstantlyPayable(mode: string | null | undefined, fromPriceUsd: unknown): boolean {
  return mode === "fixed" && clean(fromPriceUsd, 0, 0) > 0;
}

/**
 * Convert a dollar figure to naira at a given rate.
 *
 * Rounded to whole naira: a client transferring money by hand cannot send
 * kobo, and a price ending in kobo makes a bank transfer fail reconciliation.
 */
export function usdToNgn(usd: number, usdRate: number): number {
  const rate = clean(usdRate, 0, 0);
  if (rate <= 0) return 0;
  return Math.round(clean(usd, 0, 0) * rate);
}

/**
 * The whole thing a purpose bound payment costs: our fee plus the bill itself.
 *
 * The vendor amount is a PURCHASE line, not revenue. The accounting screen
 * already separates purchases from service revenue by that flag, so money
 * that is only passing through to a school or a hospital never shows up as
 * something this business earned.
 */
export function withVendorAmount(price: Price, vendorNgn: number, usdRate: number, label: string): Price {
  const vendor = Math.max(0, Math.round(clean(vendorNgn, 0, 0)));
  if (vendor <= 0) return price;
  const rate = clean(usdRate, 0, 0);
  const vendorUsd = rate > 0 ? round2(vendor / rate) : 0;
  return {
    ...price,
    totalUsd: round2(price.totalUsd + vendorUsd),
    lines: [...price.lines, { label: label || "Amount to be paid on your behalf", amountUsd: vendorUsd, itemType: "purchase" }],
  };
}
