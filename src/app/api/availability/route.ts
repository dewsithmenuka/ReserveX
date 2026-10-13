import { NextResponse } from "next/server";
import { availabilitySchema } from "@/lib/validations/reservation";
import { handleError } from "@/lib/errors";
import { checkAvailability } from "@/modules/reservations/service";

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);

  try {
    const { resourceId, startAt, endAt } =
      availabilitySchema.parse(params);

    return NextResponse.json(
      await checkAvailability(resourceId, startAt, endAt),
    );
  } catch (err) {
    return handleError(err);
  }
}
