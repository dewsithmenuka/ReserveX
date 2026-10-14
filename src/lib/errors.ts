import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);

function logUnexpected(err: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(err);
    return;
  }
  // Production: no stack, and only the last line of the message (Prisma puts query arguments first).
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  const lastLine = String(e?.message ?? "").trim().split("\n").pop()?.slice(0, 200);
  console.error("Unhandled error", { name: e?.name, code: e?.code, message: lastLine });
}

function respond(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined && { details }) } },
    { status, headers },
  );
}

export function handleError(err: unknown) {
  if (err instanceof AppError) {
    return respond(err.status, err.code, err.message, err.details, err.headers);
  }
  if (err instanceof ZodError) {
    return respond(
      400,
      "VALIDATION_ERROR",
      "Invalid request",
      err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "P2002") return respond(409, "CONFLICT", "A record with these values already exists");
  if (code === "P2025") return respond(404, "NOT_FOUND", "Record not found");

  logUnexpected(err);
  return respond(500, "INTERNAL_ERROR", "Something went wrong");
}