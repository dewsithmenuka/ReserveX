import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

// Only trustworthy behind a proxy that overwrites X-Forwarded-For (Vercel, nginx, ...).
export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

// Hashed so emails are never stored in the rate-limit table.
export const hashKey = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 32);

export async function consume(key: string, limit: number, windowSeconds: number, now = Date.now()) {
  const windowMs = windowSeconds * 1000;
  const bucket = Math.floor(now / windowMs);
  const bucketKey = `${key}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowMs);

  // Atomic increment: concurrent requests cannot slip past the limit.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${bucketKey}, 1, ${expiresAt}::timestamptz)
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;

  if (Math.random() < 0.02) {
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  }

  if (rows[0].count > limit) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please try again later.", undefined, {
      "Retry-After": String(retryAfter),
    });
  }

  return {
    // Give the attempt back (used when a login succeeds, so only failures count).
    refund: async () => {
      await db.$executeRaw`
        UPDATE "RateLimit" SET "count" = GREATEST("count" - 1, 0) WHERE "key" = ${bucketKey}`;
    },
  };
}