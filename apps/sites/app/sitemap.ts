import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildSitemapEntries, resolveSiteRequest } from "@/site";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const requestHeaders = headers();
  const resolution = resolveSiteRequest(requestHeaders);
  return buildSitemapEntries({ headers: requestHeaders, resolution });
}
