import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { parseId, readJson } from "@/lib/http";
import { updateReservationSchema } from "@/lib/validations/reservation";
import { getReservation, updateReservation } from "@/modules/reservations/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json(await getReservation(parseId(id)));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const input = updateReservationSchema.parse(await readJson(req));
    return NextResponse.json(await updateReservation(parseId(id), input));
  } catch (err) {
    return handleError(err);
  }
}