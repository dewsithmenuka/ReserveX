import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations/auth";

const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5gC9u1Yw8Qz7b0k3Qm9m1p4m2k8s0yK";

export async function POST(req: Request) {
  try {
    const input = loginSchema.parse(await readJson(req));
    const user = await db.user.findUnique({ where: { email: input.email } });
    // Compare even when the user is missing so response time doesn't reveal which emails exist
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

    await createSession(user.id);
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    return handleError(err);
  }
}