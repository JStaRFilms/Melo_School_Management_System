import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolvePath } from "../core/gateway";
import { siteManifest } from "@school/shared/site-manifests";
export const dynamic = "force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const result = await resolvePath(await headers(),"/");
  if (result.status !== "available" || result.site.redirectToCanonical) return [];
  const site = result.site;
  return (siteManifest(site.rendererKey,site.rendererSchemaVersion)?.routes ?? []).filter(r => site.routeIds.includes(r.routeId)).map(r => ({url:`${site.canonicalOrigin}${r.path}`,lastModified:new Date(site.publishedAt)}));
}
