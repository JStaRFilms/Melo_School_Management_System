import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildRobotsMetadata, resolveSiteRequest } from "@/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const resolution = resolveSiteRequest(requestHeaders);
  return buildRobotsMetadata({ headers: requestHeaders, resolution });
}
