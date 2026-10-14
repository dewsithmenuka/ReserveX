export const CURRENCY = "LKR";

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: CURRENCY }).format(cents / 100);
}