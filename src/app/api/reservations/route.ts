import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import {
  createReservationSchema,
  listReservationsSchema,
} from "@/lib/validations/reservation";
import { createReservation, listReservations } from "@/modules/reservations/service";

export async function GET(req: Request) {
  try {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    return NextResponse.json(await listReservations(listReservationsSchema.parse(params)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = createReservationSchema.parse(await readJson(req));
    return NextResponse.json(await createReservation(input), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}