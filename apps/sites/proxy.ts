import { NextRequest, NextResponse } from "next/server";
import { resolvePath } from "./core/gateway";
import { applyDestination, canonicalRedirect, safePath, safeQuery } from "./core/public";

export async function proxy(request: NextRequest) {
  const denied = () => NextResponse.next({headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
  const path = request.nextUrl.pathname;
  const query = request.nextUrl.search;
  if (!safePath(path) || !safeQuery(query)) return denied();
  // /apply is a dedicated foundation-link projection, not a renderer route.
  const result = await resolvePath(request.headers,path === "/apply" ? "/" : path);
  if (result.status !== "available") return denied();
  if (path === "/apply") {
    const target = applyDestination(result.site);
    return target ? NextResponse.redirect(target, {status:307,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}}) : denied();
  }
  const destination = canonicalRedirect(result.site,path,query);
  return destination ? NextResponse.redirect(destination,{status:308,headers:{"Cache-Control":"no-store"}}) : NextResponse.next({headers:{"Cache-Control":"no-store"}});
}
// Keep health/marker, framework, APIs and technical metadata out of tenant routing.
export const config = {matcher:["/((?!_next/|api/|\\.well-known/|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$|favicon\\.ico$|.*\\.[^/]+$).*)"]};
