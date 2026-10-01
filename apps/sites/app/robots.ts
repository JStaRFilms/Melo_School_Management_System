import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolvePath } from "../core/gateway";
export const dynamic = "force-dynamic";
export default async function robots():Promise<MetadataRoute.Robots> {
  const result = await resolvePath(await headers(),"/");
  return result.status === "available" && !result.site.redirectToCanonical ? {rules:[{userAgent:"*",allow:"/",disallow:"/apply"}],sitemap:`${result.site.canonicalOrigin}/sitemap.xml`} : {rules:[{userAgent:"*",disallow:"/"}]};
}
