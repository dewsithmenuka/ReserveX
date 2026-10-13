import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { getDashboardSummary } from "@/modules/dashboard/service";

export async function GET() {
  try {
    return NextResponse.json(await getDashboardSummary());
  } catch (err) {
    return handleError(err);
  }
}