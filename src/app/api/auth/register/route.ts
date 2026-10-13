import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AppError, handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { createSession } from "@/lib/session";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(req: Request) {
  try {
    const input = registerSchema.parse(await readJson(req));
    const exists = await db.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");

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