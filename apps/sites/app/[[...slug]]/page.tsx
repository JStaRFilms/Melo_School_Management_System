import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { buildMissingSiteMetadata, buildOrigin, buildPageMetadata, resolveRequestedPage, resolveSiteRequest } from "@/site";
import { PublicSchoolPage } from "@/site-ui";

export const dynamic = "force-dynamic";

interface RouteParams {
  slug?: string[];
}

interface RouteProps {
  params: RouteParams;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const requestHeaders = headers();
  const resolution = resolveSiteRequest(requestHeaders);

  if (resolution.status !== "active" || !resolution.school || !resolution.template) {
    return buildMissingSiteMetadata();
  }

  const page = resolveRequestedPage(resolution.school, params.slug);
  if (!page) {
    return buildMissingSiteMetadata();
  }

  return buildPageMetadata({ origin: buildOrigin(requestHeaders), school: resolution.school, page });
}

export default function SitePage({ params }: RouteProps) {
  const requestHeaders = headers();
  const resolution = resolveSiteRequest(requestHeaders);

  if (resolution.status !== "active" || !resolution.school || !resolution.template) {
    notFound();
  }

  const page = resolveRequestedPage(resolution.school, params.slug);
  if (!page) {
    notFound();
  }

  return <PublicSchoolPage school={resolution.school} template={resolution.template} pageKey={page.key} />;
}
