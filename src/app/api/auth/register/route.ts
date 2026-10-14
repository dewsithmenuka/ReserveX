import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { clientIp, consume } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(req: Request) {
  try {
    await consume(`register:ip:${clientIp(req)}`, 5, 60 * 60);
    const input = registerSchema.parse(await readJson(req));
    const exists = await db.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");

    // A concurrent duplicate hits the unique index and becomes a 409 in handleError (P2002).
    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await createSession(user.id);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}