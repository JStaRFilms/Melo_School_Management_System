import { NextRequest, NextResponse } from "next/server";
import { buildCanonicalPublicOrigin, resolveSiteRequest } from "@/site";

export function middleware(request: NextRequest) {
  const resolution = resolveSiteRequest(request.headers);

  if (resolution.status !== "active" || !resolution.school || !resolution.template || !resolution.redirectToHostname) {
    return NextResponse.next();
  }

  if (resolution.redirectToHostname === resolution.hostname) {
    return NextResponse.next();
  }

  const canonicalOrigin = buildCanonicalPublicOrigin({ headers: request.headers, resolution });
  const redirectUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonicalOrigin);

  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ["/((?!_next).*)"],
};
