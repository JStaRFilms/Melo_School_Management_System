import type { MetadataRoute } from "next";
import { siteBrand } from "@/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteBrand.siteUrl}/sitemap.xml`,
  };
}
