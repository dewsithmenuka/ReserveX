import { NextResponse, connection } from "next/server";
import { handleError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getDashboardSummary } from "@/modules/dashboard/service";

export async function GET() {
  await connection();
  try {
    const user = await requireUser();
    return NextResponse.json(await getDashboardSummary(user));
  } catch (err) {
    return handleError(err);
  }
}