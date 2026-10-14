import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { consume } from "@/lib/rate-limit";

vi.mock("@/lib/session", () => ({ createSession: vi.fn(async () => {}) }));

import * as login from "@/app/api/auth/login/route";
import * as register from "@/app/api/auth/register/route";

const post = (url: string, body: unknown, ip = "198.51.100.1") =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

const EMAIL = "member@example.com";
const PASSWORD = "Correct-Horse-42";

beforeEach(async () => {
  await db.rateLimit.deleteMany();
  await db.user.deleteMany();
  await db.user.create({
    data: { name: "Member", email: EMAIL, passwordHash: bcrypt.hashSync(PASSWORD, 4) },
  });
});

afterAll(() => db.$disconnect());

describe("login", () => {
  it("answers identically for an unknown email and a wrong password", async () => {
    const unknown = await login.POST(post("/api/auth/login", { email: "nobody@example.com", password: "whatever1A" }));
    const wrong = await login.POST(post("/api/auth/login", { email: EMAIL, password: "wrong-password" }));
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it("locks an email after 5 failures, even when the IP changes and the password is right", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await login.POST(post("/api/auth/login", { email: EMAIL, password: "bad" }, `203.0.113.${i}`));
      expect(res.status).toBe(401);
    }
    const locked = await login.POST(post("/api/auth/login", { email: EMAIL, password: PASSWORD }, "203.0.113.99"));
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("does not count successful logins against the limit", async () => {
    for (let i = 0; i < 8; i++) {
      const res = await login.POST(post("/api/auth/login", { email: EMAIL, password: PASSWORD }));
      expect(res.status).toBe(200);
    }
  });
});

describe("register", () => {
  it("rejects weak passwords and duplicate emails", async () => {
    const weak = await register.POST(post("/api/auth/register", { name: "N", email: "n@example.com", password: "password123" }));
    expect(weak.status).toBe(400);
    const dup = await register.POST(post("/api/auth/register", { name: "N", email: EMAIL, password: PASSWORD }, "198.51.100.2"));
    expect(dup.status).toBe(409);
  });

  it("creates an account with a strong password and never returns the hash", async () => {
    const res = await register.POST(post("/api/auth/register", { name: "New", email: "new@example.com", password: PASSWORD }, "198.51.100.3"));
    expect(res.status).toBe(201);
    expect(JSON.stringify(await res.json())).not.toContain("passwordHash");
  });

  it("limits registrations per IP", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      codes.push((await register.POST(post("/api/auth/register", {}, "198.51.100.50"))).status);
    }
    expect(codes).toEqual([400, 400, 400, 400, 400, 429]);
  });
});

describe("consume()", () => {
  beforeEach(() => db.rateLimit.deleteMany());

  it("rejects once the limit is exceeded, with Retry-After", async () => {
    await consume("t:a", 2, 60);
    await consume("t:a", 2, 60);
    await expect(consume("t:a", 2, 60)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    await consume("t:b", 2, 60); // other keys are independent
  });

  it("refund gives an attempt back", async () => {
    const first = await consume("t:r", 1, 60);
    await first.refund();
    await consume("t:r", 1, 60);
    await expect(consume("t:r", 1, 60)).rejects.toMatchObject({ status: 429 });
  });

  it("starts a fresh budget in the next window", async () => {
    const now = Date.now();
    await consume("t:w", 1, 60, now);
    await expect(consume("t:w", 1, 60, now)).rejects.toMatchObject({ status: 429 });
    await expect(consume("t:w", 1, 60, now + 61_000)).resolves.toBeDefined();
  });

  it("is atomic under concurrency", async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => consume("t:c", 3, 60)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });
});