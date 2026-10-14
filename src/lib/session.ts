import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { SESSION_MAX_AGE, readSessionToken, signSessionToken } from "@/lib/session-token";

// Set INSECURE_COOKIES=true only to run `npm start` over plain http (e.g. Safari on localhost).
const secure = process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true";
const COOKIE = secure ? "__Host-session" : "session";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };

export async function createSession(userId: string) {
  const { tokenVersion } = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  const token = await signSessionToken(userId, tokenVersion);
  (await cookies()).set(COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE });
}

export async function destroySession() {
  // Re-set with maxAge 0 so the __Host- prefix rules (Secure, Path=/) still match.
  (await cookies()).set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

// Invalidates every existing session of this user (logout, password change).
export async function revokeSessions(userId: string) {
  await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}

// Re-reads the user on every call, so role changes, deleted accounts and revoked sessions apply immediately.
export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const session = await readSessionToken(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== session.version) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function getCurrentUser() {
  return userFromToken((await cookies()).get(COOKIE)?.value);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please sign in");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Admin access required");
  return user;
}