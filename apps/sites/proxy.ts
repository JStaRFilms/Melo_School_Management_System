import { NextRequest, NextResponse } from "next/server";
import { getRequestHostname, buildCanonicalOrigin } from "@/core/domain";
import { loadSite } from "@/core/content";
import { previewTokenFromPath } from "@/core/preview";
import { getSiteContentSource } from "@/core/source";

export async function proxy(request: NextRequest) {
  // Preview authorization is bound to the opaque token and requested host. It
  // intentionally bypasses canonical redirects, including active aliases.
  const previewToken = previewTokenFromPath(request.nextUrl.pathname);
  const resolved = await loadSite({ hostname: getRequestHostname(request.headers), source: getSiteContentSource(), previewToken });
  if (previewToken || resolved.status !== "available" || !resolved.redirectToHostname) return NextResponse.next();
  return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, buildCanonicalOrigin(resolved.canonicalDomain)), 308);
}

export const config = { matcher: ["/((?!_next).*)"] };
