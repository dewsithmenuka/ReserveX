import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { revokeSessions, userFromToken } from "@/lib/session";
import { signSessionToken } from "@/lib/session-token";

let user: { id: string; name: string; email: string };

beforeEach(async () => {
  await db.user.deleteMany();
  user = await db.user.create({ data: { name: "U", email: "u@example.com", passwordHash: "x" } });
});

afterAll(() => db.$disconnect());

describe("server-side session validation", () => {
  it("resolves a valid token to a user without secrets", async () => {
    const token = await signSessionToken(user.id, 0);
    expect(await userFromToken(token)).toEqual({ id: user.id, name: "U", email: "u@example.com", role: "USER" });
  });

  it("invalidates old tokens when sessions are revoked (logout / password change)", async () => {
    const old = await signSessionToken(user.id, 0);
    await revokeSessions(user.id);
    expect(await userFromToken(old)).toBeNull();
    const { tokenVersion } = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await userFromToken(await signSessionToken(user.id, tokenVersion))).not.toBeNull();
  });

  it("rejects tokens for deleted users, garbage and missing tokens", async () => {
    const token = await signSessionToken(user.id, 0);
    await db.user.delete({ where: { id: user.id } });
    expect(await userFromToken(token)).toBeNull();
    expect(await userFromToken("garbage")).toBeNull();
    expect(await userFromToken(undefined)).toBeNull();
  });
});