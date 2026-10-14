import { SignJWT, jwtVerify } from "jose";

export const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours, in seconds

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function signSessionToken(userId: string, version: number, maxAgeSeconds = SESSION_MAX_AGE) {
  return new SignJWT({ ver: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(key());
}

export async function readSessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    return { userId: payload.sub, version: payload.ver };
  } catch {
    return null;
  }
}