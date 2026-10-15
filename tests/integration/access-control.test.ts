
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createReservation } from "@/modules/reservations/service";
import { listPayments, payReservation } from "@/modules/payments/service";

type TestUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

const current = vi.hoisted(() => ({
  user: null as TestUser | null,
}));

vi.mock("@/lib/session", async () => {
  const { AppError } = await import("@/lib/errors");

  const requireUser = async () => {
    if (!current.user) {
      throw new AppError(401, "UNAUTHENTICATED", "Please sign in");
    }

    return current.user;
  };

  const requireAdmin = async () => {
    const user = await requireUser();

    if (user.role !== "ADMIN") {
      throw new AppError(403, "FORBIDDEN", "Admin access required");
    }

    return user;
  };

  return { requireUser, requireAdmin };
});

vi.mock(
  "next/server",
  async (
    importOriginal: () => Promise<typeof import("next/server")>,
  ) => ({
    ...(await importOriginal()),
    connection: async () => {},
  }),
);

import * as reservationsRoute from "@/app/api/reservations/route";
import * as reservationRoute from "@/app/api/reservations/[id]/route";
import * as payRoute from "@/app/api/reservations/[id]/pay/route";
import * as resourcesRoute from "@/app/api/resources/route";
import * as resourceRoute from "@/app/api/resources/[id]/route";
import * as availabilityRoute from "@/app/api/availability/route";
import * as dashboardRoute from "@/app/api/dashboard/summary/route";

const card = {
  cardholder: "T",
  cardNumber: "4242424242424242",
  expiry: "12/40",
  cvc: "123",
};

const at = (h: number, day = 5) => new Date(Date.UTC(2031, 0, day, h));

const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ctx = (id: string) => ({
  params: Promise.resolve({ id }),
});

const signInAs = (user: TestUser | null) => {
  current.user = user;
};

let alice: TestUser;
let bob: TestUser;
let admin: TestUser;
let resource: { id: string };
let aliceRes: { id: string };

const bookingBody = (over: Record<string, unknown> = {}) => ({
  resourceId: resource.id,
  reservedByName: "A",
  reservedByEmail: "a@example.com",
  purpose: "p",
  startAt: at(10, 6).toISOString(),
  endAt: at(12, 6).toISOString(),
  ...over,
});

beforeEach(async () => {
  await db.rateLimit.deleteMany();
  await db.payment.deleteMany();
  await db.reservation.deleteMany();
  await db.resource.deleteMany();
  await db.user.deleteMany();

  const makeUser = (name: string, role: "USER" | "ADMIN") =>
    db.user.create({
      data: {
        name,
        email: `${name}@example.com`,
        passwordHash: "x",
        role,
      },
    });

  alice = (await makeUser("alice", "USER")) as TestUser;
  bob = (await makeUser("bob", "USER")) as TestUser;
  admin = (await makeUser("admin", "ADMIN")) as TestUser;

  resource = await db.resource.create({
    data: {
      name: "Room",
      type: "room",
      pricePerHourCents: 150000,
    },
  });

  aliceRes = await createReservation({
    resourceId: resource.id,
    reservedByName: "Alice",
    reservedByEmail: "alice@example.com",
    purpose: "test",
    startAt: at(10),
    endAt: at(12),
    userId: alice.id,
  });

  signInAs(null);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("authentication is required", () => {
  it("rejects anonymous requests with 401", async () => {
    const calls = await Promise.all([
      reservationsRoute.GET(req("GET", "/api/reservations")),
      reservationsRoute.POST(
        req("POST", "/api/reservations", bookingBody()),
      ),
      reservationRoute.GET(req("GET", "/x"), ctx(aliceRes.id)),
      reservationRoute.PATCH(
        req("PATCH", "/x", { status: "CANCELLED" }),
        ctx(aliceRes.id),
      ),
      payRoute.POST(req("POST", "/x", card), ctx(aliceRes.id)),
      availabilityRoute.GET(
        req(
          "GET",
          `/api/availability?resourceId=${resource.id}&startAt=${at(10).toISOString()}&endAt=${at(12).toISOString()}`,
        ),
      ),
      dashboardRoute.GET(),
    ]);

    for (const response of calls) {
      expect(response.status).toBe(401);
    }
  });
});

describe("users cannot touch each other's reservations or payments", () => {
  it("blocks bob from reading, changing, cancelling or paying alice's reservation", async () => {
    signInAs(bob);

    expect(
      (await reservationRoute.GET(req("GET", "/x"), ctx(aliceRes.id))).status,
    ).toBe(403);

    expect(
      (
        await reservationRoute.PATCH(
          req("PATCH", "/x", { status: "CANCELLED" }),
          ctx(aliceRes.id),
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await reservationRoute.PATCH(
          req("PATCH", "/x", { purpose: "hacked" }),
          ctx(aliceRes.id),
        )
      ).status,
    ).toBe(403);

    expect(
      (await payRoute.POST(req("POST", "/x", card), ctx(aliceRes.id))).status,
    ).toBe(403);

    const row = await db.reservation.findUniqueOrThrow({
      where: { id: aliceRes.id },
    });

    expect(row).toMatchObject({
      status: "CONFIRMED",
      purpose: "test",
      paymentStatus: "UNPAID",
    });

    expect(await db.payment.count()).toBe(0);
  });

  it("scopes reservation lists to the owner; admins see everything", async () => {
    signInAs(bob);

    expect(
      (await (await reservationsRoute.GET(req("GET", "/api/reservations"))).json())
        .total,
    ).toBe(0);

    signInAs(alice);

    expect(
      (await (await reservationsRoute.GET(req("GET", "/api/reservations"))).json())
        .total,
    ).toBe(1);

    signInAs(admin);

    expect(
      (await (await reservationsRoute.GET(req("GET", "/api/reservations"))).json())
        .total,
    ).toBe(1);
  });

  it("lets an admin view and cancel any booking, but not pay for someone else", async () => {
    signInAs(admin);

    expect(
      (await reservationRoute.GET(req("GET", "/x"), ctx(aliceRes.id))).status,
    ).toBe(200);

    expect(
      (await payRoute.POST(req("POST", "/x", card), ctx(aliceRes.id))).status,
    ).toBe(403);

    expect(
      (
        await reservationRoute.PATCH(
          req("PATCH", "/x", { status: "CANCELLED" }),
          ctx(aliceRes.id),
        )
      ).status,
    ).toBe(200);
  });

  it("only returns a user's own payments", async () => {
    await payReservation(aliceRes.id, card);

    expect(
      (
        await listPayments({
          userId: bob.id,
          page: 1,
          pageSize: 10,
        })
      ).total,
    ).toBe(0);

    expect(
      (
        await listPayments({
          userId: alice.id,
          page: 1,
          pageSize: 10,
        })
      ).total,
    ).toBe(1);

    expect(
      (
        await listPayments({
          page: 1,
          pageSize: 10,
        })
      ).total,
    ).toBe(1);
  });
});

describe("the server never trusts client-supplied money, owner or state fields", () => {
  it("ignores price, owner and status on create", async () => {
    signInAs(alice);

    const response = await reservationsRoute.POST(
      req(
        "POST",
        "/api/reservations",
        bookingBody({
          amountCents: 1,
          paymentStatus: "PAID",
          userId: bob.id,
          status: "CANCELLED",
        }),
      ),
    );

    expect(response.status).toBe(201);

    expect(await response.json()).toMatchObject({
      amountCents: 300000,
      paymentStatus: "UNPAID",
      userId: alice.id,
      status: "CONFIRMED",
    });
  });

  it("ignores payment, owner and amount fields on update", async () => {
    signInAs(alice);

    const response = await reservationRoute.PATCH(
      req(
        "PATCH",
        "/x",
        {
          purpose: "new",
          paymentStatus: "PAID",
          amountCents: 0,
          userId: bob.id,
        },
      ),
      ctx(aliceRes.id),
    );

    expect(response.status).toBe(200);

    expect(
      await db.reservation.findUniqueOrThrow({
        where: { id: aliceRes.id },
      }),
    ).toMatchObject({
      purpose: "new",
      paymentStatus: "UNPAID",
      amountCents: 300000,
      userId: alice.id,
    });
  });

  it("charges the server-side amount whatever the pay request contains", async () => {
    signInAs(alice);

    const response = await payRoute.POST(
      req(
        "POST",
        "/x",
        {
          ...card,
          amountCents: 1,
          currency: "USD",
        },
      ),
      ctx(aliceRes.id),
    );

    expect(response.status).toBe(200);

    const payment = await db.payment.findFirstOrThrow({
      where: { reservationId: aliceRes.id },
    });

    expect(payment).toMatchObject({
      amountCents: 300000,
      currency: "LKR",
      result: "SUCCEEDED",
    });
  });
});

describe("admin-only endpoints are enforced on the server", () => {
  it("POST /api/resources: 401 anonymous, 403 user, 201 admin", async () => {
    const call = () =>
      resourcesRoute.POST(
        req("POST", "/api/resources", {
          name: "New",
          type: "room",
        }),
      );

    expect((await call()).status).toBe(401);

    signInAs(alice);

    expect((await call()).status).toBe(403);

    expect(
      await db.resource.count({
        where: { name: "New" },
      }),
    ).toBe(0);

    signInAs(admin);

    expect((await call()).status).toBe(201);
  });

  it("PATCH /api/resources/[id]: users cannot deactivate or reprice; admins can", async () => {
    const patch = (body: unknown) =>
      resourceRoute.PATCH(req("PATCH", "/x", body), ctx(resource.id));

    signInAs(alice);

    expect(
      (await patch({ isActive: false, pricePerHourCents: 0 })).status,
    ).toBe(403);

    expect(
      await db.resource.findUniqueOrThrow({
        where: { id: resource.id },
      }),
    ).toMatchObject({
      isActive: true,
      pricePerHourCents: 150000,
    });

    signInAs(admin);

    expect((await patch({ isActive: false })).status).toBe(200);
  });
});

describe("data exposure", () => {
  it("shows users only their own upcoming bookings on the dashboard, with no emails", async () => {
    await createReservation({
      resourceId: resource.id,
      reservedByName: "Bob",
      reservedByEmail: "bob-secret@example.com",
      purpose: "bobs private meeting",
      startAt: at(14),
      endAt: at(15),
      userId: bob.id,
    });

    signInAs(alice);

    const text = await (await dashboardRoute.GET()).text();
    const body = JSON.parse(text);

    expect(
      body.nextReservations.map((reservation: { id: string }) => reservation.id),
    ).toEqual([aliceRes.id]);

    expect(text).not.toContain("@");
    expect(text).not.toContain("bobs private meeting");
  });

  it("reports conflicts as times only (availability and 409 responses)", async () => {
    signInAs(alice);

    const url =
      `/api/availability?resourceId=${resource.id}` +
      `&startAt=${at(11).toISOString()}` +
      `&endAt=${at(13).toISOString()}`;

    const availability = await (
      await availabilityRoute.GET(req("GET", url))
    ).json();

    expect(availability.conflicts).toHaveLength(1);

    expect(Object.keys(availability.conflicts[0]).sort()).toEqual([
      "endAt",
      "startAt",
    ]);

    const response = await reservationsRoute.POST(
      req(
        "POST",
        "/api/reservations",
        bookingBody({
          startAt: at(11, 5).toISOString(),
          endAt: at(13, 5).toISOString(),
        }),
      ),
    );

    expect(response.status).toBe(409);

    const body = await response.json();

    expect(Object.keys(body.error.details[0]).sort()).toEqual([
      "endAt",
      "startAt",
    ]);
  });
});
