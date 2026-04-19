import type { MetadataRoute } from "next";
import { siteBrand, siteNavigation } from "@/site";

const routes = ["/", ...siteNavigation.filter((i) => i.href !== "/").map((i) => i.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: new URL(route, siteBrand.siteUrl).toString(),
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
