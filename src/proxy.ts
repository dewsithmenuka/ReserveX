import { NextResponse, type NextRequest } from "next/server";
import { isAllowedRequest } from "@/lib/csrf";

export function proxy(request: NextRequest) {
  const allowed = isAllowedRequest({
    method: request.method,
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    appOrigin: process.env.APP_ORIGIN || undefined,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "CSRF_REJECTED", message: "Cross-site request blocked" } },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };