import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { clientIp, consume, hashKey } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations/auth";

const WINDOW_SECONDS = 15 * 60;

let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("not-a-real-password", 12));

export async function POST(req: Request) {
  try {
    const byIp = await consume(`login:ip:${clientIp(req)}`, 20, WINDOW_SECONDS);
    const input = loginSchema.parse(await readJson(req));
    const byEmail = await consume(`login:email:${hashKey(input.email)}`, 5, WINDOW_SECONDS);

    const user = await db.user.findUnique({ where: { email: input.email } });
    // Always compare against a real hash so timing does not reveal which emails exist.
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

    await Promise.all([byIp.refund(), byEmail.refund()]);
    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    return handleError(err);
  }
}