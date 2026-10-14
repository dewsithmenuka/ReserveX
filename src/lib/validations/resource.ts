import { z } from "zod";

export const createResourceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(120).optional(),
  capacity: z.number().int().positive().max(100000).optional(),
  pricePerHourCents: z.number().int().min(0).max(100_000_000).optional(),
});

export const updateResourceSchema = createResourceSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const listResourcesSchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.string().trim().max(60).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});