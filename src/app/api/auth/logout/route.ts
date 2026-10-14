import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { destroySession, getCurrentUser, revokeSessions } from "@/lib/session";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) await revokeSessions(user.id);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}