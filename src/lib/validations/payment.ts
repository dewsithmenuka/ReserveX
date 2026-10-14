import { z } from "zod";
import { isTestCard } from "@/modules/payments/gateway";

function notExpired(v: string) {
  const [mm, yy] = v.split("/").map(Number);
  return Date.UTC(2000 + yy, mm, 1) > Date.now();
}

export const payReservationSchema = z.object({
  cardholder: z.string().trim().min(1, "Enter the cardholder name").max(120),
  cardNumber: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d{12,19}$/, "Enter a valid card number")
        .refine(isTestCard, "Demo mode: use a test card such as 4242 4242 4242 4242"),
    ),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY")
    .refine(notExpired, "This card has expired"),
  cvc: z.string().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit security code"),
});