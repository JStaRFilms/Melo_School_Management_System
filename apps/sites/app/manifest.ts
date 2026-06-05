import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildCanonicalPublicOrigin, getSchoolFaviconHref, getSchoolUploadedFaviconUrl, resolveSiteRequest } from "@/site";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const requestHeaders = await headers();
  const resolution = resolveSiteRequest(requestHeaders);

  if (resolution.status !== "active" || !resolution.school || !resolution.template) {
    return {
      name: "Melo School Sites",
      short_name: "Melo",
      description: "Managed public websites for schools on Melo.",
      start_url: "/",
      display: "browser",
      background_color: "#ffffff",
      theme_color: "#173B72",
      icons: [
        { src: "/melo-favicon.png", sizes: "512x512", type: "image/png" },
        { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      ],
    };
  }

  const canonicalOrigin = buildCanonicalPublicOrigin({ headers: requestHeaders, resolution });

  const schoolIcon = getSchoolFaviconHref(resolution.school);
  const uploadedSchoolIcon = getSchoolUploadedFaviconUrl(resolution.school);

  return {
    name: resolution.school.brand.name,
    short_name: resolution.school.brand.shortName,
    description: resolution.school.brand.tagline,
    start_url: canonicalOrigin,
    scope: `${canonicalOrigin}/`,
    display: "browser",
    background_color: resolution.school.theme.background,
    theme_color: resolution.school.theme.primary,
    icons: uploadedSchoolIcon
      ? [{ src: new URL(schoolIcon, canonicalOrigin).toString(), sizes: "any" }]
      : [
          { src: `${canonicalOrigin}/melo-favicon.png`, sizes: "512x512", type: "image/png" },
          { src: `${canonicalOrigin}/apple-icon.png`, sizes: "180x180", type: "image/png" },
        ],
  };
}
