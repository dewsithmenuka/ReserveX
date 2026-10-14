import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { getReservation } from "@/modules/reservations/service";
import { chargeCard, type CardInput } from "./gateway";
import type { Prisma } from "@/generated/prisma/client";

const MAX_FAILED_ATTEMPTS = 5;

export async function payReservation(reservationId: string, card: CardInput) {
  const outcome = await db.$transaction(
    async (tx) => {
      // The row lock serialises concurrent payments, so a double click cannot charge twice.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Reservation"
        WHERE "id" = ${reservationId}::uuid
        FOR UPDATE
      `;

      const r = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!r) throw notFound("Reservation");

      if (r.status === "CANCELLED") {
        throw new AppError(
          409,
          "RESERVATION_CANCELLED",
          "Cancelled reservations cannot be paid",
        );
      }

      if (r.paymentStatus === "PAID") {
        throw new AppError(
          409,
          "ALREADY_PAID",
          "This reservation is already paid",
        );
      }

      if (r.paymentStatus !== "UNPAID") {
        throw new AppError(
          409,
          "NO_PAYMENT_DUE",
          "No payment is due for this reservation",
        );
      }

      if (r.endAt <= new Date()) {
        throw new AppError(
          409,
          "RESERVATION_ENDED",
          "This reservation has already ended",
        );
      }

      const failed = await tx.payment.count({
        where: {
          reservationId,
          kind: "CHARGE",
          result: "FAILED",
        },
      });

      if (failed >= MAX_FAILED_ATTEMPTS) {
        throw new AppError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Too many failed payment attempts. Contact an admin.",
        );
      }

      const result = chargeCard(card);

      await tx.payment.create({
        data: {
          reservationId,
          userId: r.userId,
          kind: "CHARGE",
          result: result.ok ? "SUCCEEDED" : "FAILED",
          amountCents: r.amountCents,
          cardBrand: result.brand,
          cardLast4: result.last4,
          failureReason: result.ok ? null : result.reason,
        },
      });

      if (result.ok) {
        await tx.reservation.update({
          where: { id: reservationId },
          data: { paymentStatus: "PAID" },
        });
      }

      return result;
    },
    { maxWait: 10_000, timeout: 15_000 },
  );

  // Thrown after the transaction commits, so the FAILED attempt is kept for the audit trail.
  if (!outcome.ok) {
    throw new AppError(402, "PAYMENT_DECLINED", outcome.reason);
  }

  return getReservation(reservationId);
}

export async function listPayments(input: {
  userId?: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const q = input.q;

  const where: Prisma.PaymentWhereInput = {
    ...(input.userId && { userId: input.userId }),
    ...(q && {
      OR: [
        { cardLast4: { contains: q } },
        { cardBrand: { contains: q, mode: "insensitive" } },
        { failureReason: { contains: q, mode: "insensitive" } },
        {
          reservation: {
            OR: [
              { purpose: { contains: q, mode: "insensitive" } },
              { reservedByEmail: { contains: q, mode: "insensitive" } },
              { reservedByName: { contains: q, mode: "insensitive" } },
              {
                resource: {
                  name: { contains: q, mode: "insensitive" },
                },
              },
            ],
          },
        },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        reservation: {
          select: {
            purpose: true,
            reservedByEmail: true,
            resource: {
              select: { name: true },
            },
          },
        },
      },
    }),
    db.payment.count({ where }),
  ]);

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getPaymentStats() {
  const sum = (kind: "CHARGE" | "REFUND") =>
    db.payment.aggregate({
      _sum: { amountCents: true },
      _count: true,
      where: { kind, result: "SUCCEEDED" },
    });

  const [charged, refunded, failedAttempts, outstanding] = await Promise.all([
    sum("CHARGE"),
    sum("REFUND"),
    db.payment.count({
      where: { kind: "CHARGE", result: "FAILED" },
    }),
    db.reservation.aggregate({
      _sum: { amountCents: true },
      _count: true,
      where: {
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
      },
    }),
  ]);

  const chargedCents = charged._sum.amountCents ?? 0;
  const refundedCents = refunded._sum.amountCents ?? 0;

  return {
    collectedCents: chargedCents - refundedCents,
    refundedCents,
    failedAttempts,
    paidCount: charged._count,
    outstandingCents: outstanding._sum.amountCents ?? 0,
    outstandingCount: outstanding._count,
  };
}