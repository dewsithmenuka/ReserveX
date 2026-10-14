export type CardInput = { cardholder: string; cardNumber: string; expiry: string; cvc: string };

// Demo mode: only documented test cards are accepted, so real card numbers are never processed.
const TEST_CARDS: Record<string, { brand: string; decline: string | null }> = {
  "4242424242424242": { brand: "Visa", decline: null },
  "5555555555554444": { brand: "Mastercard", decline: null },
  "4000000000000002": { brand: "Visa", decline: "Your card was declined." },
  "4000000000009995": { brand: "Visa", decline: "Insufficient funds." },
};

export const isTestCard = (n: string) => Object.hasOwn(TEST_CARDS, n);

export type ChargeResult =
  | { ok: true; brand: string; last4: string }
  | { ok: false; brand: string; last4: string; reason: string };

export function chargeCard(card: CardInput): ChargeResult {
  const last4 = card.cardNumber.slice(-4);
  const info = Object.hasOwn(TEST_CARDS, card.cardNumber) ? TEST_CARDS[card.cardNumber] : null;
  if (!info) return { ok: false, brand: "Unknown", last4, reason: "Unsupported test card" };
  return info.decline
    ? { ok: false, brand: info.brand, last4, reason: info.decline }
    : { ok: true, brand: info.brand, last4 };
}