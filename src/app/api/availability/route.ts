import { NextResponse, connection } from "next/server";
import { handleError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { availabilitySchema } from "@/lib/validations/reservation";
import { checkAvailability } from "@/modules/reservations/service";

export async function GET(req: Request) {
  await connection();
  try {
    await requireUser();
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const { resourceId, startAt, endAt } = availabilitySchema.parse(params);
    return NextResponse.json(await checkAvailability(resourceId, startAt, endAt));
  } catch (err) {
    return handleError(err);
  }
}