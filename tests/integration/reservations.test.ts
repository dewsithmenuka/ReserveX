import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  checkAvailability,
  createReservation,
  updateReservation,
} from "@/modules/reservations/service";

const at = (hour: number, day = 1) => new Date(Date.UTC(2031, 0, day, hour));
let resourceId: string;

const book = (startH: number, endH: number, day = 1) =>
  createReservation({
    resourceId,
    reservedByName: "Tester",
    reservedByEmail: "t@example.com",
    purpose: "test",
    startAt: at(startH, day),
    endAt: at(endH, day),
  });

const conflict = { status: 409, code: "RESERVATION_CONFLICT" };

beforeEach(async () => {
  await db.payment.deleteMany();
  await db.reservation.deleteMany();
  await db.resource.deleteMany();

  resourceId = (
    await db.resource.create({
      data: { name: "Room", type: "room" },
    })
  ).id;
});

afterAll(() => db.$disconnect());

describe("reservation rules", () => {
  it("rejects an overlapping booking with 409", async () => {
    await book(10, 12);
    await expect(book(11, 13)).rejects.toMatchObject(conflict);
  });

  it("allows back-to-back bookings", async () => {
    await book(10, 12);
    await expect(book(12, 14)).resolves.toBeDefined();
  });

  it("frees the slot when a booking is cancelled", async () => {
    const r = await book(10, 12);
    await updateReservation(r.id, { status: "CANCELLED" });
    await expect(book(10, 12)).resolves.toBeDefined();
  });

  it("excludes a reservation from its own conflict check on update", async () => {
    const r = await book(10, 12);
    await expect(updateReservation(r.id, { endAt: at(13) })).resolves.toBeDefined();
  });

  it("rejects updating into a conflicting time", async () => {
    await book(10, 12);
    const other = await book(14, 16);
    await expect(updateReservation(other.id, { startAt: at(11) })).rejects.toMatchObject(conflict);
  });

  it("rejects bookings for inactive resources", async () => {
    await db.resource.update({ where: { id: resourceId }, data: { isActive: false } });
    await expect(book(10, 12)).rejects.toMatchObject({ status: 409, code: "RESOURCE_INACTIVE" });
  });

  it("does not allow editing a cancelled reservation", async () => {
    const r = await book(10, 12);
    await updateReservation(r.id, { status: "CANCELLED" });
    await expect(updateReservation(r.id, { purpose: "x" })).rejects.toMatchObject({
      status: 409,
      code: "RESERVATION_CANCELLED",
    });
  });

  it("reports availability", async () => {
    await book(10, 12);
    expect((await checkAvailability(resourceId, at(11), at(13))).available).toBe(false);
    expect((await checkAvailability(resourceId, at(12), at(13))).available).toBe(true);
  });
});

describe("database safeguards", () => {
  it("the exclusion constraint rejects overlaps even if the service is bypassed", async () => {
    await book(10, 12);
    await expect(
      db.reservation.create({
        data: {
          resourceId,
          reservedByName: "Bypass",
          reservedByEmail: "b@example.com",
          purpose: "direct insert",
          startAt: at(11),
          endAt: at(13),
        },
      }),
    ).rejects.toThrow();
  });
});

describe("concurrency", () => {
  it("lets exactly one of 10 simultaneous requests win", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => book(10, 11, 2)));
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(9);
    for (const l of lost) expect(l.reason).toMatchObject(conflict);
    expect(await db.reservation.count({ where: { status: "CONFIRMED" } })).toBe(1);
  });
});