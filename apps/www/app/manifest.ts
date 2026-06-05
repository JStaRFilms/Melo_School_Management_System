import type { MetadataRoute } from "next";
import { siteBrand } from "@/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteBrand.name} — ${siteBrand.tagline}`,
    short_name: siteBrand.name,
    description: siteBrand.description,
    start_url: siteBrand.siteUrl,
    scope: `${siteBrand.siteUrl}/`,
    display: "browser",
    background_color: "#F7F1E8",
    theme_color: "#173B72",
    icons: [
      { src: "/melo-favicon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
