import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";
import { parseId, readJson } from "@/lib/http";
import { updateResourceSchema } from "@/lib/validations/resource";
import {
  getResource,
  updateResource,
} from "@/modules/resources/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;

    return NextResponse.json(
      await getResource(parseId(id)),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();

    const { id } = await params;

    const input = updateResourceSchema.parse(
      await readJson(req),
    );

    return NextResponse.json(
      await updateResource(parseId(id), input),
    );
  } catch (err) {
    return handleError(err);
  }
}
