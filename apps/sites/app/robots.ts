import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getRequestHostname } from "@/core/domain";
import { loadSite } from "@/core/content";
import { buildRobotsMetadata } from "@/core/site";
import { getSiteContentSource } from "@/core/source";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  return buildRobotsMetadata(await loadSite({ hostname: getRequestHostname(requestHeaders), source: getSiteContentSource() }));
}
