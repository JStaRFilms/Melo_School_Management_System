import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getRequestHostname } from "@/core/domain";
import { loadSite } from "@/core/content";
import { buildSiteManifest } from "@/core/site";
import { getSiteContentSource } from "@/core/source";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await loadSite({ hostname: getRequestHostname(await headers()), source: getSiteContentSource() });
  return buildSiteManifest(site);
}
