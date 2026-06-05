export function formatNGN(value = 0): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  }).format(value);
}
export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(value));
}

export function formatUSD(ngn: number, rate: number): string {
  if (!rate) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(ngn / rate);
}
/** Client-facing money: USD only, converted from internal NGN at the locked rate. */
export function formatClientMoney(ngn: number, rate?: number | null): string {
  if (rate && Number(rate) > 0) return formatUSD(ngn, Number(rate));
  return formatNGN(ngn); // fallback if no rate ever set
}
