import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getRequestHostname } from "@/core/domain";
import { buildSitemapEntries } from "@/core/site";
import { getSiteContentSource } from "@/core/source";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries(getRequestHostname(await headers()), getSiteContentSource());
}
