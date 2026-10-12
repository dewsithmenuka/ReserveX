import { z } from "zod";

const idSchema = z.string().uuid();

export function parseId(id: string) {
  return idSchema.parse(id);
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    const { AppError } = await import("@/lib/errors");
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}