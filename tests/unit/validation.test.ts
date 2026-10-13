import { describe, expect, it } from "vitest";
import { createReservationSchema } from "@/lib/validations/reservation";
import { dayBounds } from "@/lib/time";

const valid = {
  resourceId: "10000000-0000-4000-8000-000000000001",
  reservedByName: "Nimal",
  reservedByEmail: "nimal@example.com",
  purpose: "Meeting",
  startAt: "2031-01-01T10:00:00Z",
  endAt: "2031-01-01T11:00:00Z",
};

describe("createReservationSchema", () => {
  it("accepts a valid reservation", () => {
    expect(createReservationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects end equal to start", () => {
    expect(createReservationSchema.safeParse({ ...valid, endAt: valid.startAt }).success).toBe(false);
  });

  it("rejects end before start", () => {
    expect(
      createReservationSchema.safeParse({ ...valid, endAt: "2031-01-01T09:00:00Z" }).success,
    ).toBe(false);
  });

  it("rejects a bad email and a non-UUID resource id", () => {
    expect(createReservationSchema.safeParse({ ...valid, reservedByEmail: "nope" }).success).toBe(false);
    expect(createReservationSchema.safeParse({ ...valid, resourceId: "123" }).success).toBe(false);
  });
});

describe("dayBounds (Asia/Colombo)", () => {
  it("uses the Sri Lanka calendar day, not the UTC day", () => {
    // 20:00 UTC on Oct 12 is 01:30 on Oct 13 in Colombo
    const { start, end } = dayBounds(new Date("2026-10-12T20:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-12T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-13T18:30:00.000Z");
  });
});