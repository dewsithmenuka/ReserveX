import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type {
  createResourceSchema,
  updateResourceSchema,
  listResourcesSchema,
} from "@/lib/validations/resource";

type CreateInput = z.infer<typeof createResourceSchema>;
type UpdateInput = z.infer<typeof updateResourceSchema>;
type ListInput = z.infer<typeof listResourcesSchema>;

export async function listResources(input: ListInput) {
  const where: Prisma.ResourceWhereInput = {
    ...(input.type && { type: input.type }),
    ...(input.isActive && { isActive: input.isActive === "true" }),
    ...(input.q && {
      OR: [
        { name: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } },
        { location: { contains: input.q, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    db.resource.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.resource.count({ where }),
  ]);

  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function getResource(id: string) {
  const resource = await db.resource.findUnique({ where: { id } });
  if (!resource) throw notFound("Resource");
  return resource;
}

export function createResource(input: CreateInput) {
  return db.resource.create({ data: input });
}

export async function updateResource(id: string, input: UpdateInput) {
  await getResource(id);
  return db.resource.update({ where: { id }, data: input });
}