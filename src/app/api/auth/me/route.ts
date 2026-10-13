
import { connection, NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export async function GET() {
  // Keep this outside try/catch so Next.js can handle its prerendering signal.
  await connection();

  try {
    return NextResponse.json(await requireUser());
  } catch (err) {
    return handleError(err);
  }
}
