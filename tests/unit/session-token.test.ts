import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE, readSessionToken, signSessionToken } from "@/lib/session-token";

const UID = "00000000-0000-4000-8000-0000000000aa";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("session token", () => {
  it("round-trips the user id and version", async () => {
    const token = await signSessionToken(UID, 3);
    expect(await readSessionToken(token)).toEqual({ userId: UID, version: 3 });
  });

  it("lives at most 24 hours", () => {
    expect(SESSION_MAX_AGE).toBeLessThanOrEqual(86_400);
  });

  it("rejects expired tokens", async () => {
    expect(await readSessionToken(await signSessionToken(UID, 0, -60))).toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await new SignJWT({ ver: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(UID)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("x".repeat(40)));
    expect(await readSessionToken(token)).toBeNull();
  });

  it("rejects unsigned (alg: none) tokens", async () => {
    const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: UID, ver: 0, exp: 4102444800 })}.`;
    expect(await readSessionToken(token)).toBeNull();
  });

  it("rejects tampered payloads", async () => {
    const [header, , signature] = (await signSessionToken(UID, 0)).split(".");
    const forged = `${header}.${b64({ sub: "someone-else", ver: 0, exp: 4102444800 })}.${signature}`;
    expect(await readSessionToken(forged)).toBeNull();
  });

  it("rejects tokens without a version", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(UID)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await readSessionToken(token)).toBeNull();
  });
});