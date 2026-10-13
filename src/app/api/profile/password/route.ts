import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validations/auth";
import { changePassword } from "@/modules/users/service";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = changePasswordSchema.parse(await readJson(req));
    await changePassword(user.id, input.currentPassword, input.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}