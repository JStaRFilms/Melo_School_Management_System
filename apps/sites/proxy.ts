import { NextRequest, NextResponse } from "next/server";
import { getRequestHostname, buildCanonicalOrigin } from "@/core/domain";
import { loadSite } from "@/core/content";
import { getSiteContentSource } from "@/core/source";

export async function proxy(request: NextRequest) {
  const resolved = await loadSite({ hostname: getRequestHostname(request.headers), source: getSiteContentSource() });
  if (resolved.status !== "available" || !resolved.redirectToHostname) return NextResponse.next();
  return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, buildCanonicalOrigin(resolved.canonicalDomain)), 308);
}

export const config = { matcher: ["/((?!_next).*)"] };
