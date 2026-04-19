import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildSitemapEntries, resolveSiteRequest } from "@/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const resolution = resolveSiteRequest(requestHeaders);
  return buildSitemapEntries({ headers: requestHeaders, resolution });
}
