import { NextResponse } from "next/server";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import {
  createResourceSchema,
  listResourcesSchema,
} from "@/lib/validations/resource";
import { createResource, listResources } from "@/modules/resources/service";

export async function GET(req: Request) {
  try {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const input = listResourcesSchema.parse(params);
    return NextResponse.json(await listResources(input));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = createResourceSchema.parse(await readJson(req));
    return NextResponse.json(await createResource(input), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}