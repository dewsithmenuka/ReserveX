import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createReservation, updateReservation } from "@/modules/reservations/service";
import { payReservation } from "@/modules/payments/service";

const card = { cardholder: "Test", cardNumber: "4242424242424242", expiry: "12/40", cvc: "123" };
const declined = { ...card, cardNumber: "4000000000000002" };
const at = (h: number) => new Date(Date.UTC(2031, 0, 1, h));
let resourceId: string;

const book = (startH: number, endH: number, id = resourceId) =>
  createReservation({
    resourceId: id,
    reservedByName: "T",
    reservedByEmail: "t@example.com",
    purpose: "test",
    startAt: at(startH),
    endAt: at(endH),
  });

beforeEach(async () => {
  await db.payment.deleteMany();
  await db.reservation.deleteMany();
  await db.resource.deleteMany();
  resourceId = (await db.resource.create({ data: { name: "Room", type: "room", pricePerHourCents: 150000 } })).id;
});

afterAll(() => db.$disconnect());

describe("pricing at booking time", () => {
  it("computes the amount on the server and marks it UNPAID", async () => {
    const r = await book(10, 12);
    expect(r).toMatchObject({ amountCents: 300000, paymentStatus: "UNPAID" });
  });

  it("free resources need no payment", async () => {
    const free = await db.resource.create({ data: { name: "Free", type: "room" } });
    const r = await book(10, 12, free.id);
    expect(r).toMatchObject({ amountCents: 0, paymentStatus: "NOT_REQUIRED" });
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ code: "NO_PAYMENT_DUE" });
  });

  it("recomputes the amount when an unpaid booking is rescheduled", async () => {
    const r = await book(10, 12);
    const updated = await updateReservation(r.id, { endAt: at(13) });
    expect(updated.amountCents).toBe(450000);
  });
});

describe("paying", () => {
  it("marks the reservation PAID and records the charge without the card number", async () => {
    const r = await book(10, 12);
    const paid = await payReservation(r.id, card);
    expect(paid.paymentStatus).toBe("PAID");
    const rows = await db.payment.findMany({ where: { reservationId: r.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "CHARGE", result: "SUCCEEDED", cardLast4: "4242", amountCents: 300000 });
    expect(JSON.stringify(rows[0])).not.toContain("4242424242424242");
  });

  it("keeps the reservation UNPAID and logs the attempt when declined", async () => {
    const r = await book(10, 12);
    await expect(payReservation(r.id, declined)).rejects.toMatchObject({ status: 402, code: "PAYMENT_DECLINED" });
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).paymentStatus).toBe("UNPAID");
    expect(await db.payment.count({ where: { reservationId: r.id, result: "FAILED" } })).toBe(1);
  });

  it("charges exactly once when 5 payments arrive at the same time", async () => {
    const r = await book(10, 12);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => payReservation(r.id, card)));
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.payment.count({ where: { reservationId: r.id, result: "SUCCEEDED" } })).toBe(1);
  });

  it("the database refuses a second successful charge", async () => {
    const r = await book(10, 12);
    await payReservation(r.id, card);
    await expect(
      db.payment.create({ data: { reservationId: r.id, kind: "CHARGE", result: "SUCCEEDED", amountCents: 1 } }),
    ).rejects.toThrow();
  });

  it("blocks further attempts after 5 failures", async () => {
    const r = await book(10, 12);
    for (let i = 0; i < 5; i++) await payReservation(r.id, declined).catch(() => {});
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ status: 429 });
  });

  it("cannot pay for a cancelled reservation", async () => {
    const r = await book(10, 12);
    await updateReservation(r.id, { status: "CANCELLED" });
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ code: "RESERVATION_CANCELLED" });
  });
});

describe("refunds and paid bookings", () => {
  it("refunds in full when a paid booking is cancelled", async () => {
    const r = await book(10, 12);
    await payReservation(r.id, card);
    const cancelled = await updateReservation(r.id, { status: "CANCELLED" });
    expect(cancelled.paymentStatus).toBe("REFUNDED");
    const refund = await db.payment.findFirstOrThrow({ where: { reservationId: r.id, kind: "REFUND" } });
    expect(refund).toMatchObject({ amountCents: 300000, result: "SUCCEEDED", cardLast4: "4242" });
  });

  it("creates no refund when an unpaid booking is cancelled", async () => {
    const r = await book(10, 12);
    await updateReservation(r.id, { status: "CANCELLED" });
    expect(await db.payment.count({ where: { reservationId: r.id } })).toBe(0);
  });

  it("does not allow rescheduling a paid booking", async () => {
    const r = await book(10, 12);
    await payReservation(r.id, card);
    await expect(updateReservation(r.id, { endAt: at(13) })).rejects.toMatchObject({
      status: 409,
      code: "PAID_RESERVATION_LOCKED",
    });
  });
});