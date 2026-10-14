import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, handleError } from "@/lib/errors";
import { registerSchema } from "@/lib/validations/auth";

describe("handleError", () => {
  it("returns a generic 500 and leaks nothing for unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(
      new Error("connect ECONNREFUSED postgresql://reservex:s3cret@db:5432/app"),
      { code: "P1001" },
    );
    const res = handleError(err);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
    for (const leak of ["s3cret", "postgresql", "ECONNREFUSED", "stack", " at "]) {
      expect(text).not.toContain(leak);
    }
    spy.mockRestore();
  });

  it("maps Prisma unique and not-found errors without database details", async () => {
    const dup = handleError(Object.assign(new Error("Unique constraint failed on User_email_key"), { code: "P2002" }));
    expect(dup.status).toBe(409);
    expect(await dup.text()).not.toContain("User_email_key");
    expect(handleError(Object.assign(new Error("x"), { code: "P2025" })).status).toBe(404);
  });

  it("does not echo submitted values in validation errors", async () => {
    const parsed = registerSchema.safeParse({ name: "N", email: "not-an-email-LEAKCHECK", password: "x" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const res = handleError(parsed.error);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("LEAKCHECK");
  });

  it("passes AppError status and headers through", () => {
    const res = handleError(new AppError(429, "RATE_LIMITED", "slow down", undefined, { "Retry-After": "30" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(z).toBeDefined();
  });
});