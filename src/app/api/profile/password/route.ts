import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { createSession, requireUser } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validations/auth";
import { changePassword } from "@/modules/users/service";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await consume(`pwchange:user:${user.id}`, 5, 15 * 60);
    const input = changePasswordSchema.parse(await readJson(req));
    await changePassword(user.id, input.currentPassword, input.newPassword);
    await createSession(user.id); // new session version; all other sessions are now invalid
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}