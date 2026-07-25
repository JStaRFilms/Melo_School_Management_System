import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getRequestHostname } from "@/core/domain";
import { loadSite } from "@/core/content";
import { getSiteContentSource } from "@/core/source";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await loadSite({ hostname: getRequestHostname(await headers()), source: getSiteContentSource() });
  if (site.status !== "available") return { name: "Managed school site", short_name: "School", start_url: "/", display: "browser", background_color: "#ffffff", theme_color: "#173B72" };
  const displayName = site.site.revision.fields["identity.displayName"];
  const name = displayName?.kind === "text" ? displayName.value : site.site.profile.schoolSlug;
  return { name, short_name: name, start_url: "/", display: "browser", background_color: "#ffffff", theme_color: "#173B72" };
}
