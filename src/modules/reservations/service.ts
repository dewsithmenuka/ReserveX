import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type {
  createReservationSchema,
  updateReservationSchema,
  listReservationsSchema,
} from "@/lib/validations/reservation";

type CreateInput = z.infer<typeof createReservationSchema>;
type UpdateInput = z.infer<typeof updateReservationSchema>;
type ListInput = z.infer<typeof listReservationsSchema>;

const PAST_GRACE_MS = 60_000;
const MAX_TRANSACTION_ATTEMPTS = 3;

const withResource = {
  resource: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
} satisfies Prisma.ReservationInclude;

function assertNotInPast(startAt: Date) {
  if (startAt.getTime() < Date.now() - PAST_GRACE_MS) {
    throw new AppError(
      400,
      "START_IN_PAST",
      "Reservations cannot start in the past",
    );
  }
}

function overlapError(conflicts?: unknown) {
  return new AppError(
    409,
    "RESERVATION_CONFLICT",
    "This resource is already booked for part of the requested time",
    conflicts,
  );
}

/**
 * Detect PostgreSQL exclusion-constraint violations and
 * Prisma-wrapped versions of the same error.
 */
function isOverlapError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;

  while (
    current &&
    typeof current === "object" &&
    !seen.has(current)
  ) {
    seen.add(current);

    const error = current as {
      code?: unknown;
      message?: unknown;
      meta?: unknown;
      cause?: unknown;
    };

    if (error.code === "23P01") {
      return true;
    }

    let details = String(error.message ?? "");

    try {
      details += JSON.stringify(error.meta ?? {});
    } catch {
      // Ignore metadata that cannot be serialized.
    }

    if (
      details.includes("Reservation_no_overlap") ||
      details.includes("exclusion constraint")
    ) {
      return true;
    }

    current = error.cause;
  }

  return false;
}

/**
 * Returns true for Prisma transaction write conflicts.
 */
function isTransactionConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const error = err as {
    code?: unknown;
    message?: unknown;
    meta?: unknown;
  };

  if (error.code === "P2034") {
    return true;
  }

  let details = String(error.message ?? "");

  try {
    details += JSON.stringify(error.meta ?? {});
  } catch {
    // Ignore metadata that cannot be serialized.
  }

  return (
    details.includes("TransactionWriteConflict") ||
    details.includes("write conflict or a deadlock")
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

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
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
    },
  });
}

export async function checkAvailability(
  resourceId: string,
  startAt: Date,
  endAt: Date,
) {
  const resource = await db.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource) {
    throw notFound("Resource");
  }

  const conflicts = await findConflicts(
    db,
    resourceId,
    startAt,
    endAt,
  );

  return {
    available: resource.isActive && conflicts.length === 0,
    resourceActive: resource.isActive,
    conflicts,
  };
}

export async function listReservations(input: ListInput) {
  const where: Prisma.ReservationWhereInput = {
    ...(input.resourceId && { resourceId: input.resourceId }),
    ...(input.status && { status: input.status }),
    ...(input.from && { endAt: { gt: input.from } }),
    ...(input.to && { startAt: { lt: input.to } }),
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

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getReservation(id: string) {
  const reservation = await db.reservation.findUnique({
    where: { id },
    include: withResource,
  });

  if (!reservation) {
    throw notFound("Reservation");
  }

  return reservation;
}

export async function createReservation(input: CreateInput) {
  assertNotInPast(input.startAt);

  const resource = await db.resource.findUnique({
    where: { id: input.resourceId },
  });

  if (!resource) {
    throw notFound("Resource");
  }

  if (!resource.isActive) {
    throw new AppError(
      409,
      "RESOURCE_INACTIVE",
      "This resource is not available for booking",
    );
  }

  for (
    let attempt = 1;
    attempt <= MAX_TRANSACTION_ATTEMPTS;
    attempt++
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          // Serialize bookings for the same resource.
          // PostgreSQL releases this row lock when the transaction ends.
          await tx.$queryRaw`
            SELECT "id"
            FROM "Resource"
            WHERE "id" = ${input.resourceId}
            FOR UPDATE
          `;

          // Check for conflicts only after obtaining the resource lock.
          const conflicts = await findConflicts(
            tx,
            input.resourceId,
            input.startAt,
            input.endAt,
          );

          if (conflicts.length > 0) {
            throw overlapError(conflicts);
          }

          return tx.reservation.create({
            data: input,
            include: withResource,
          });
        },
        {
          maxWait: 10_000,
          timeout: 15_000,
        },
      );
    } catch (err) {
      // Preserve expected application errors such as a known overlap.
      if (err instanceof AppError) {
        throw err;
      }

      // The database exclusion constraint is the final guard
      // against concurrent overlapping reservations.
      if (isOverlapError(err)) {
        throw overlapError();
      }

      // Retry transient transaction write conflicts using a
      // fresh transaction and a short increasing backoff.
      if (isTransactionConflict(err)) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS) {
          await wait(50 * attempt);
          continue;
        }

        // Do not claim the slot is booked when the actual result
        // is an unresolved transaction conflict.
        throw new AppError(
          503,
          "RESERVATION_RETRY_REQUIRED",
          "The reservation could not be completed due to temporary database contention. Please retry.",
        );
      }

      // Do not disguise unrelated database failures as conflicts.
      throw err;
    }
  }

  throw new AppError(
    503,
    "RESERVATION_RETRY_REQUIRED",
    "The reservation could not be completed. Please retry.",
  );
}

export async function updateReservation(
  id: string,
  input: UpdateInput,
) {
  const existing = await getReservation(id);

  if (existing.status === "CANCELLED") {
    throw new AppError(
      409,
      "RESERVATION_CANCELLED",
      "Cancelled reservations cannot be modified",
    );
  }

  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt ?? existing.endAt;

  if (endAt <= startAt) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid request",
      [
        {
          path: "endAt",
          message: "endAt must be after startAt",
        },
      ],
    );
  }

  if (input.startAt) {
    assertNotInPast(input.startAt);
  }

  const timeChanged = Boolean(input.startAt || input.endAt);
  const cancelling = input.status === "CANCELLED";

  try {
    return await db.$transaction(
      async (tx) => {
        // Acquire the resource lock before checking for conflicts.
        // This serializes updates with concurrent reservation creations.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Resource"
          WHERE "id" = ${existing.resourceId}
          FOR UPDATE
        `;

        if (timeChanged && !cancelling) {
          const conflicts = await findConflicts(
            tx,
            existing.resourceId,
            startAt,
            endAt,
            id,
          );

          if (conflicts.length > 0) {
            throw overlapError(conflicts);
          }
        }

        return tx.reservation.update({
          where: { id },
          data: input,
          include: withResource,
        });
      },
      {
        maxWait: 10_000,
        timeout: 15_000,
      },
    );
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    if (isOverlapError(err)) {
      throw overlapError();
    }

    throw err;
  }
}
