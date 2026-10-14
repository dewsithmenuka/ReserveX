import { AppError } from "@/lib/errors";

const MAX_AMOUNT_CENTS = 2_000_000_000; // stays inside PostgreSQL INTEGER

export function computeAmountCents(pricePerHourCents: number, startAt: Date, endAt: Date) {
  const minutes = (endAt.getTime() - startAt.getTime()) / 60_000;
  const amount = Math.round((minutes * pricePerHourCents) / 60);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_AMOUNT_CENTS) {
    throw new AppError(400, "AMOUNT_OUT_OF_RANGE", "The total price is out of range");
  }
  return amount;
}