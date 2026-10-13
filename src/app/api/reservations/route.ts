import { NextResponse, connection } from "next/server";
import { requireUser } from "@/lib/session";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import {
  createReservationSchema,
  listReservationsSchema,
} from "@/lib/validations/reservation";
import {
  createReservation,
  listReservations,
} from "@/modules/reservations/service";

export async function GET(req: Request) {
  await connection();

  try {
    const user = await requireUser();

    const params = Object.fromEntries(
      new URL(req.url).searchParams,
    );

    const input = listReservationsSchema.parse(params);

    return NextResponse.json(
      await listReservations({
        ...input,
        ...(user.role !== "ADMIN" && { userId: user.id }),
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const input = createReservationSchema.parse(
      await readJson(req),
    );

    return NextResponse.json(
      await createReservation({
        ...input,
        userId: user.id,
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
