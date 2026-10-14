import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { computeAmountCents } from "@/modules/payments/pricing";
import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type {
  createReservationSchema,
  updateReservationSchema,
  listReservationsSchema,
} from "@/lib/validations/reservation";

type CreateInput = z.infer<typeof createReservationSchema> & { userId?: string };
type UpdateInput = z.infer<typeof updateReservationSchema>;
type ListInput = z.infer<typeof listReservationsSchema> & {
  userId?: string;
  q?: string;
  resourceType?: string;
};

const PAST_GRACE_MS = 60_000;
const MAX_BOOKING_MS = 7 * 24 * 60 * 60 * 1000;
const TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };
const withResource = {
  resource: { select: { id: true, name: true, type: true } },
} satisfies Prisma.ReservationInclude;

function assertNotInPast(startAt: Date) {
  if (startAt.getTime() < Date.now() - PAST_GRACE_MS) {
    throw new AppError(400, "START_IN_PAST", "Reservations cannot start in the past");
  }
}

function assertDuration(startAt: Date, endAt: Date) {
  if (endAt.getTime() - startAt.getTime() > MAX_BOOKING_MS) {
    throw new AppError(400, "DURATION_TOO_LONG", "A reservation can last at most 7 days");
  }
}

// Other people's reservation IDs are never exposed: conflicts are reported as times only.
function overlapError(conflicts?: { startAt: Date; endAt: Date }[]) {
  return new AppError(
    409,
    "RESERVATION_CONFLICT",
    "This resource is already booked for part of the requested time",
    conflicts?.map(({ startAt, endAt }) => ({ startAt, endAt })),
  );
}

// Detects the PostgreSQL exclusion violation (SQLSTATE 23P01) however Prisma wraps it
function isOverlapError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown };
    if (e.code === "23P01") return true;
    let text = String(e.message ?? "");
    try {
      text += JSON.stringify(e.meta ?? {});
    } catch {}
    if (text.includes("Reservation_no_overlap") || text.includes("exclusion constraint")) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

const lockResource = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT "id" FROM "Resource" WHERE "id" = ${id}::uuid FOR UPDATE`;
const lockReservation = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id" = ${id}::uuid FOR UPDATE`;

export function findConflicts(
  client: Prisma.TransactionClient,
  resourceId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string,
) {
  return client.reservation.findMany({
    where: {
      resourceId,
      status: "CONFIRMED",
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeId && { id: { not: excludeId } }),
    },
    orderBy: { startAt: "asc" },
    select: { startAt: true, endAt: true },
  });
}

export async function checkAvailability(resourceId: string, startAt: Date, endAt: Date) {
  const resource = await db.resource.findUnique({ where: { id: resourceId } });
  if (!resource) throw notFound("Resource");
  const conflicts = await findConflicts(db, resourceId, startAt, endAt);
  return {
    available: resource.isActive && conflicts.length === 0,
    resourceActive: resource.isActive,
    amountCents: computeAmountCents(resource.pricePerHourCents, startAt, endAt),
    conflicts,
  };
}

export async function listReservations(input: ListInput) {
  const where: Prisma.ReservationWhereInput = {
    ...(input.userId && { userId: input.userId }),
    ...(input.resourceId && { resourceId: input.resourceId }),
    ...(input.resourceType && { resource: { type: input.resourceType } }),
    ...(input.status && { status: input.status }),
    ...(input.from && { endAt: { gt: input.from } }),
    ...(input.to && { startAt: { lt: input.to } }),
    ...(input.q && {
      OR: [
        { purpose: { contains: input.q, mode: "insensitive" } },
        { reservedByName: { contains: input.q, mode: "insensitive" } },
        { reservedByEmail: { contains: input.q, mode: "insensitive" } },
        { resource: { name: { contains: input.q, mode: "insensitive" } } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    db.reservation.findMany({
      where,
      include: withResource,
      orderBy: { startAt: "asc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.reservation.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function getReservation(id: string) {
  const reservation = await db.reservation.findUnique({ where: { id }, include: withResource });
  if (!reservation) throw notFound("Reservation");
  return reservation;
}

export async function createReservation(input: CreateInput) {
  assertNotInPast(input.startAt);
  assertDuration(input.startAt, input.endAt);

  const resource = await db.resource.findUnique({ where: { id: input.resourceId } });
  if (!resource) throw notFound("Resource");
  if (!resource.isActive) {
    throw new AppError(409, "RESOURCE_INACTIVE", "This resource is not available for booking");
  }

  // The server decides the price; the client never sends an amount.
  const amountCents = computeAmountCents(resource.pricePerHourCents, input.startAt, input.endAt);
  const paymentStatus = amountCents > 0 ? ("UNPAID" as const) : ("NOT_REQUIRED" as const);

  try {
    return await db.$transaction(async (tx) => {
      await lockResource(tx, input.resourceId);
      const conflicts = await findConflicts(tx, input.resourceId, input.startAt, input.endAt);
      if (conflicts.length > 0) throw overlapError(conflicts);
      return tx.reservation.create({
        data: { ...input, amountCents, paymentStatus },
        include: withResource,
      });
    }, TX_OPTIONS);
  } catch (err) {
    if (isOverlapError(err)) throw overlapError();
    throw err;
  }
}

export async function updateReservation(id: string, input: UpdateInput) {
  const existing = await getReservation(id);
  if (existing.status === "CANCELLED") {
    throw new AppError(409, "RESERVATION_CANCELLED", "Cancelled reservations cannot be modified");
  }

  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt ?? existing.endAt;
  const timeChanged = Boolean(input.startAt || input.endAt);
  const cancelling = input.status === "CANCELLED";

  if (endAt <= startAt) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid request", [
      { path: "endAt", message: "endAt must be after startAt" },
    ]);
  }
  if (input.startAt) assertNotInPast(input.startAt);
  if (timeChanged) assertDuration(startAt, endAt);

  try {
    return await db.$transaction(async (tx) => {
      // Lock order is always resource, then reservation (the pay flow locks only the reservation).
      await lockResource(tx, existing.resourceId);
      await lockReservation(tx, id);

      const current = await tx.reservation.findUnique({
        where: { id },
        include: { resource: { select: { pricePerHourCents: true } } },
      });
      if (!current) throw notFound("Reservation");
      if (current.status === "CANCELLED") {
        throw new AppError(409, "RESERVATION_CANCELLED", "Cancelled reservations cannot be modified");
      }
      if (current.endAt <= new Date()) {
        throw new AppError(409, "RESERVATION_ENDED", "Ended reservations cannot be modified");
      }

      // Cancelling changes only the status, whatever else was sent.
      const data: Prisma.ReservationUncheckedUpdateInput = cancelling
        ? { status: "CANCELLED" }
        : { ...input };

      if (cancelling) {
        if (current.paymentStatus === "PAID") {
          // Policy: cancelling a paid booking refunds it in full.
          const charge = await tx.payment.findFirst({
            where: { reservationId: id, kind: "CHARGE", result: "SUCCEEDED" },
            orderBy: { createdAt: "desc" },
          });
          await tx.payment.create({
            data: {
              reservationId: id,
              userId: current.userId,
              kind: "REFUND",
              result: "SUCCEEDED",
              amountCents: current.amountCents,
              cardBrand: charge?.cardBrand,
              cardLast4: charge?.cardLast4,
            },
          });
          data.paymentStatus = "REFUNDED";
        }
      } else if (timeChanged) {
        if (current.paymentStatus === "PAID") {
          throw new AppError(
            409,
            "PAID_RESERVATION_LOCKED",
            "Paid reservations cannot be rescheduled. Cancel it for a refund and book again.",
          );
        }
        const conflicts = await findConflicts(tx, existing.resourceId, startAt, endAt, id);
        if (conflicts.length > 0) throw overlapError(conflicts);
        const amountCents = computeAmountCents(current.resource.pricePerHourCents, startAt, endAt);
        data.amountCents = amountCents;
        data.paymentStatus = amountCents > 0 ? "UNPAID" : "NOT_REQUIRED";
      }

      return tx.reservation.update({ where: { id }, data, include: withResource });
    }, TX_OPTIONS);
  } catch (err) {
    if (isOverlapError(err)) throw overlapError();
    throw err;
  }
}