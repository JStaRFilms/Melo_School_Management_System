import type { Metadata } from "next";

const platformWorkspaceUrl =
  process.env.NEXT_PUBLIC_PLATFORM_SITE_URL ?? "http://localhost:3004";

export const platformWorkspaceBrand = {
  name: "SchoolOS Platform Admin",
  shortName: "Super Admin",
  description: "Internal workspace for platform super admins to manage schools.",
  siteUrl: platformWorkspaceUrl,
} as const;

export function buildPlatformWorkspaceMetadata({
  title,
  description = platformWorkspaceBrand.description,
  path = "/",
}: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  const url = new URL(path, platformWorkspaceBrand.siteUrl).toString();
  const shareTitle = `${title} | ${platformWorkspaceBrand.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: shareTitle,
      description,
      url,
      siteName: platformWorkspaceBrand.name,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: shareTitle,
      description,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}
