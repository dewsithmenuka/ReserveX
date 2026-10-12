import { z } from "zod";

const base = z.object({
  resourceId: z.string().uuid(),
  reservedByName: z.string().trim().min(1).max(120),
  reservedByEmail: z.string().trim().email().max(254),
  purpose: z.string().trim().min(1).max(500),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

export const createReservationSchema = base.refine((v) => v.endAt > v.startAt, {
  message: "endAt must be after startAt",
  path: ["endAt"],
});

export const updateReservationSchema = base
  .omit({ resourceId: true })
  .partial()
  .extend({ status: z.enum(["CONFIRMED", "CANCELLED"]).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const listReservationsSchema = z.object({
  resourceId: z.string().uuid().optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});