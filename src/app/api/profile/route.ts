import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { updateProfileSchema } from "@/lib/validations/auth";
import { updateName } from "@/modules/users/service";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const input = updateProfileSchema.parse(await readJson(req));
    return NextResponse.json(await updateName(user.id, input.name));
  } catch (err) {
    return handleError(err);
  }
}