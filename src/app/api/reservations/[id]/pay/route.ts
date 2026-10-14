import { NextResponse } from "next/server";
import { AppError, handleError } from "@/lib/errors";
import { parseId, readJson } from "@/lib/http";
import { consume } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { payReservationSchema } from "@/lib/validations/payment";
import { payReservation } from "@/modules/payments/service";
import { getReservation } from "@/modules/reservations/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await getReservation(parseId(id));
    if (existing.userId !== user.id) {
      throw new AppError(403, "FORBIDDEN", "You can only pay for your own reservations");
    }
    await consume(`pay:user:${user.id}`, 10, 10 * 60);
    // The schema only keeps card fields: any client-sent amount is discarded.
    const card = payReservationSchema.parse(await readJson(req));
    return NextResponse.json(await payReservation(existing.id, card));
  } catch (err) {
    return handleError(err);
  }
}