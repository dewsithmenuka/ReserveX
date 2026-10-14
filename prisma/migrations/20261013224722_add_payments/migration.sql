-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentResult" AS ENUM ('SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "amountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "pricePerHourCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "userId" UUID,
    "kind" "PaymentKind" NOT NULL,
    "result" "PaymentResult" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'LKR',
    "cardBrand" VARCHAR(30),
    "cardLast4" VARCHAR(4),
    "failureReason" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Resource"
  ADD CONSTRAINT "Resource_price_nonnegative" CHECK ("pricePerHourCents" >= 0);
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_amount_nonnegative" CHECK ("amountCents" >= 0);
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_nonnegative" CHECK ("amountCents" >= 0);

-- A reservation can be successfully charged once, and refunded once.
CREATE UNIQUE INDEX "Payment_one_successful_charge"
  ON "Payment" ("reservationId") WHERE "kind" = 'CHARGE' AND "result" = 'SUCCEEDED';
CREATE UNIQUE INDEX "Payment_one_refund"
  ON "Payment" ("reservationId") WHERE "kind" = 'REFUND';