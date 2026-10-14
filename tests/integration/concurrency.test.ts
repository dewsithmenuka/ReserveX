import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createReservation, updateReservation } from "@/modules/reservations/service";
import { payReservation } from "@/modules/payments/service";

const card = { cardholder: "T", cardNumber: "4242424242424242", expiry: "12/40", cvc: "123" };
const declined = { ...card, cardNumber: "4000000000000002" };
const at = (h: number, day = 1) => new Date(Date.UTC(2031, 0, day, h));
const conflict = { status: 409, code: "RESERVATION_CONFLICT" };

let resourceId: string;

const book = (s: number, e: number, opts: { day?: number; resource?: string } = {}) =>
  createReservation({
    resourceId: opts.resource ?? resourceId,
    reservedByName: "T",
    reservedByEmail: "t@example.com",
    purpose: "t",
    startAt: at(s, opts.day),
    endAt: at(e, opts.day),
  });

async function confirmedOverlaps() {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Reservation" a JOIN "Reservation" b
      ON a.id < b.id AND a."resourceId" = b."resourceId"
     AND a.status = 'CONFIRMED' AND b.status = 'CONFIRMED'
     AND a."startAt" < b."endAt" AND a."endAt" > b."startAt"`;
  return Number(rows[0].n);
}

const fulfilled = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r) => r.status === "fulfilled").length;
const codes = (results: PromiseSettledResult<unknown>[]) =>
  results.map((r) => (r.status === "rejected" ? (r.reason as { code?: string }).code : "ok"));

beforeEach(async () => {
  await db.payment.deleteMany();
  await db.reservation.deleteMany();
  await db.resource.deleteMany();
  resourceId = (await db.resource.create({ data: { name: "Room", type: "room", pricePerHourCents: 150000 } })).id;
});

afterAll(() => db.$disconnect());

describe("booking locks under concurrency", () => {
  it("does not serialise different resources: each one gets its own winner", async () => {
    const other = await db.resource.create({ data: { name: "Room 2", type: "room" } });
    const results = await Promise.allSettled([
      ...Array.from({ length: 5 }, () => book(10, 11, { day: 2 })),
      ...Array.from({ length: 5 }, () => book(10, 11, { day: 2, resource: other.id })),
    ]);
    expect(fulfilled(results)).toBe(2);
    expect(await db.reservation.count({ where: { resourceId } })).toBe(1);
    expect(await db.reservation.count({ where: { resourceId: other.id } })).toBe(1);
  });

  it("lets exactly one of two reservations move into the same slot", async () => {
    const x = await book(8, 9, { day: 3 });
    const y = await book(12, 13, { day: 3 });
    const results = await Promise.allSettled([
      updateReservation(x.id, { startAt: at(14, 3), endAt: at(15, 3) }),
      updateReservation(y.id, { startAt: at(14, 3), endAt: at(15, 3) }),
    ]);
    expect(fulfilled(results)).toBe(1);
    const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject(conflict);
    expect(await confirmedOverlaps()).toBe(0);
  });

  it("never produces an overlap when creates race with a move", async () => {
    const x = await book(8, 9, { day: 4 });
    const results = await Promise.allSettled([
      ...Array.from({ length: 5 }, () => book(16, 17, { day: 4 })),
      updateReservation(x.id, { startAt: at(16, 4), endAt: at(17, 4) }),
    ]);
    expect(fulfilled(results)).toBe(1);
    expect(await confirmedOverlaps()).toBe(0);
  });
});

describe("payment concurrency", () => {
  it("records at most 5 failed attempts even when 8 arrive at once", async () => {
    const r = await book(10, 12);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => payReservation(r.id, declined)));
    expect(codes(results).filter((c) => c === "PAYMENT_DECLINED")).toHaveLength(5);
    expect(codes(results).filter((c) => c === "TOO_MANY_ATTEMPTS")).toHaveLength(3);
    expect(await db.payment.count({ where: { reservationId: r.id, result: "FAILED" } })).toBe(5);
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ status: 429 });
  });

  it("refunds exactly once when 5 cancellations arrive at once", async () => {
    const r = await book(10, 12);
    await payReservation(r.id, card);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => updateReservation(r.id, { status: "CANCELLED" })),
    );
    expect(fulfilled(results)).toBe(1);
    expect(codes(results).filter((c) => c === "RESERVATION_CANCELLED")).toHaveLength(4);
    expect(await db.payment.count({ where: { reservationId: r.id, kind: "REFUND" } })).toBe(1);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).paymentStatus).toBe("REFUNDED");
  });

  it("the database itself refuses a second refund", async () => {
    const r = await book(10, 12);
    await payReservation(r.id, card);
    await updateReservation(r.id, { status: "CANCELLED" });
    await expect(
      db.payment.create({ data: { reservationId: r.id, kind: "REFUND", result: "SUCCEEDED", amountCents: 1 } }),
    ).rejects.toThrow();
  });

  it("keeps charges and refunds balanced when a payment races a cancellation", async () => {
    for (let h = 10; h < 15; h++) {
      const r = await book(h, h + 1, { day: 5 });
      await Promise.allSettled([payReservation(r.id, card), updateReservation(r.id, { status: "CANCELLED" })]);
      const row = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
      const charges = await db.payment.count({ where: { reservationId: r.id, kind: "CHARGE", result: "SUCCEEDED" } });
      const refunds = await db.payment.count({ where: { reservationId: r.id, kind: "REFUND" } });
      expect(row.status).toBe("CANCELLED");
      expect(refunds).toBe(charges);
      expect(row.paymentStatus).toBe(charges === 1 ? "REFUNDED" : "UNPAID");
    }
  });
});

describe("reservation and payment state transitions", () => {
  it("NOT_REQUIRED: free bookings cannot be paid and cancel without a refund", async () => {
    const free = await db.resource.create({ data: { name: "Free", type: "room" } });
    const r = await book(10, 12, { resource: free.id });
    expect(r.paymentStatus).toBe("NOT_REQUIRED");
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ code: "NO_PAYMENT_DUE" });
    const cancelled = await updateReservation(r.id, { status: "CANCELLED" });
    expect(cancelled).toMatchObject({ status: "CANCELLED", paymentStatus: "NOT_REQUIRED" });
    expect(await db.payment.count({ where: { reservationId: r.id } })).toBe(0);
  });

  it("UNPAID: cancelling creates no refund and the booking can no longer be paid", async () => {
    const r = await book(10, 12);
    const cancelled = await updateReservation(r.id, { status: "CANCELLED" });
    expect(cancelled).toMatchObject({ status: "CANCELLED", paymentStatus: "UNPAID" });
    expect(await db.payment.count({ where: { reservationId: r.id } })).toBe(0);
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ code: "RESERVATION_CANCELLED" });
  });

  it("PAID: cannot be paid twice or rescheduled, can be edited, cancels into REFUNDED", async () => {
    const r = await book(10, 12);
    expect((await payReservation(r.id, card)).paymentStatus).toBe("PAID");
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ code: "ALREADY_PAID" });
    await expect(updateReservation(r.id, { endAt: at(13) })).rejects.toMatchObject({ code: "PAID_RESERVATION_LOCKED" });
    expect((await updateReservation(r.id, { purpose: "renamed" })).purpose).toBe("renamed");
    expect(await updateReservation(r.id, { status: "CANCELLED" })).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
    });
  });

  it("REFUNDED / CANCELLED is final: no pay, no edit, no second cancel", async () => {
    const r = await book(10, 12);
    await payReservation(r.id, card);
    await updateReservation(r.id, { status: "CANCELLED" });
    await expect(payReservation(r.id, card)).rejects.toMatchObject({ code: "RESERVATION_CANCELLED" });
    await expect(updateReservation(r.id, { purpose: "x" })).rejects.toMatchObject({ code: "RESERVATION_CANCELLED" });
    await expect(updateReservation(r.id, { status: "CANCELLED" })).rejects.toMatchObject({ code: "RESERVATION_CANCELLED" });
    expect(await db.payment.count({ where: { reservationId: r.id, kind: "REFUND" } })).toBe(1);
  });

  it("ended reservations can be neither paid, edited nor cancelled (no refund after use)", async () => {
    const ended = await db.reservation.create({
      data: {
        resourceId,
        reservedByName: "T",
        reservedByEmail: "t@example.com",
        purpose: "old",
        startAt: new Date(Date.now() - 3 * 3_600_000),
        endAt: new Date(Date.now() - 2 * 3_600_000),
        amountCents: 100,
        paymentStatus: "UNPAID",
      },
    });
    await expect(payReservation(ended.id, card)).rejects.toMatchObject({ code: "RESERVATION_ENDED" });
    await expect(updateReservation(ended.id, { status: "CANCELLED" })).rejects.toMatchObject({ code: "RESERVATION_ENDED" });
    await expect(updateReservation(ended.id, { purpose: "x" })).rejects.toMatchObject({ code: "RESERVATION_ENDED" });
  });
});

describe("amounts are computed and enforced by the server", () => {
  it("locks the booking-time price even if the resource is repriced before payment", async () => {
    const r = await book(10, 12);
    expect(r.amountCents).toBe(300000);
    await db.resource.update({ where: { id: resourceId }, data: { pricePerHourCents: 999999 } });
    await payReservation(r.id, card);
    expect((await db.payment.findFirstOrThrow({ where: { reservationId: r.id } })).amountCents).toBe(300000);
  });

  it("rejects bookings longer than 7 days and totals that cannot fit", async () => {
    await expect(book(10, 11, {}).then(() =>
      createReservation({
        resourceId, reservedByName: "T", reservedByEmail: "t@example.com", purpose: "t",
        startAt: at(12, 10), endAt: at(12, 18),
      }),
    )).rejects.toMatchObject({ code: "DURATION_TOO_LONG" });
  });

  it("fits the largest allowed booking (7 days at the maximum price)", async () => {
    await db.resource.update({ where: { id: resourceId }, data: { pricePerHourCents: 10_000_000 } });
    const r = await createReservation({
      resourceId, reservedByName: "T", reservedByEmail: "t@example.com", purpose: "t",
      startAt: at(0, 12), endAt: at(0, 19),
    });
    expect(r.amountCents).toBe(1_680_000_000);
  });

  it("the database rejects inconsistent amounts and absurd prices", async () => {
    const base = { resourceId, reservedByName: "T", reservedByEmail: "t@example.com", purpose: "t", startAt: at(10, 20), endAt: at(11, 20) };
    await expect(db.reservation.create({ data: { ...base, amountCents: 0, paymentStatus: "UNPAID" } })).rejects.toThrow();
    await expect(db.reservation.create({ data: { ...base, amountCents: 500, paymentStatus: "NOT_REQUIRED" } })).rejects.toThrow();
    await expect(db.resource.update({ where: { id: resourceId }, data: { pricePerHourCents: 10_000_001 } })).rejects.toThrow();
  });
});