import { NextResponse, connection } from "next/server";
import { AppError, handleError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { parseId, readJson } from "@/lib/http";
import { updateReservationSchema } from "@/lib/validations/reservation";
import {
  getReservation,
  updateReservation,
} from "@/modules/reservations/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  await connection();

  try {
    const user = await requireUser();
    const { id } = await params;

    const reservation = await getReservation(parseId(id));

    if (user.role !== "ADMIN" && reservation.userId !== user.id) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You can only view your own reservations",
      );
    }

    return NextResponse.json(reservation);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await getReservation(parseId(id));

    if (user.role !== "ADMIN" && existing.userId !== user.id) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You can only change your own reservations",
      );
    }

    const input = updateReservationSchema.parse(
      await readJson(req),
    );

    return NextResponse.json(
      await updateReservation(existing.id, input),
    );
  } catch (err) {
    return handleError(err);
  }
}
