import { describe, expect, it } from "vitest";
import { computeAmountCents } from "@/modules/payments/pricing";
import { chargeCard } from "@/modules/payments/gateway";
import { payReservationSchema } from "@/lib/validations/payment";

const h = (n: number) => new Date(Date.UTC(2031, 0, 1, 10) + n * 3_600_000);

describe("computeAmountCents", () => {
  it("prices whole and partial hours", () => {
    expect(computeAmountCents(150000, h(0), h(2))).toBe(300000);
    expect(computeAmountCents(150000, h(0), h(1.5))).toBe(225000);
    expect(computeAmountCents(0, h(0), h(5))).toBe(0);
  });
});

describe("gateway and card validation", () => {
  const ok = { cardholder: "A", cardNumber: "4242 4242 4242 4242", expiry: "12/40", cvc: "123" };

  it("accepts a test card and normalises spaces", () => {
    const r = payReservationSchema.parse(ok);
    expect(r.cardNumber).toBe("4242424242424242");
    expect(chargeCard(r)).toMatchObject({ ok: true, last4: "4242" });
  });

  it("declines the decline test card", () => {
    const r = payReservationSchema.parse({ ...ok, cardNumber: "4000000000000002" });
    expect(chargeCard(r)).toMatchObject({ ok: false });
  });

  it("rejects real-looking cards, expired cards and bad codes", () => {
    expect(payReservationSchema.safeParse({ ...ok, cardNumber: "4111111111111111" }).success).toBe(false);
    expect(payReservationSchema.safeParse({ ...ok, expiry: "01/20" }).success).toBe(false);
    expect(payReservationSchema.safeParse({ ...ok, cvc: "12" }).success).toBe(false);
  });
});
describe("amount limits", () => {
  it("fits the largest allowed booking in the database", () => {
    expect(computeAmountCents(10_000_000, h(0), h(24 * 7))).toBe(1_680_000_000);
  });
  it("rejects totals that would overflow", () => {
    expect(() => computeAmountCents(10_000_000, h(0), h(24 * 365))).toThrow();
  });
});