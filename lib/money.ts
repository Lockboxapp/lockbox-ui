export function toCents(n: number) {
  return Math.round(n * 100);
}
export function fromCents(cents: number) {
  return (cents ?? 0) / 100;
}
export function currencyFromCents(cents: number, locale?: string) {
  return (fromCents(cents)).toLocaleString(locale, { style: "currency", currency: "USD" });
}
