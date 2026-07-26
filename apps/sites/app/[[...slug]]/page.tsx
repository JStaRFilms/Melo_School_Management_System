import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getRequestHostname, buildCanonicalOrigin } from "@/core/domain";
import { loadSite } from "@/core/content";
import { buildApplicationRedirectHref } from "@/core/links";
import { buildMissingSiteMetadata, buildPageMetadata, buildStructuredData, resolveSitePage } from "@/core/site";
import { getSiteContentSource } from "@/core/source";

export const dynamic = "force-dynamic";

interface RouteParams { slug?: string[]; }
interface RouteProps { params: Promise<RouteParams>; searchParams: Promise<Record<string, string | string[] | undefined>>; }

function splitPreview(slug: string[] | undefined) {
  if (slug?.[0] !== "__preview" || !slug[1]) return { previewToken: undefined, routeParts: slug };
  return { previewToken: slug[1], routeParts: slug.slice(2) };
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { previewToken, routeParts } = splitPreview((await params).slug);
  const previewPathPrefix = previewToken ? `/__preview/${encodeURIComponent(previewToken)}` : undefined;
  const page = await resolveSitePage({ hostname: getRequestHostname(await headers()), slugParts: routeParts, source: getSiteContentSource(), previewToken, previewPathPrefix });
  return page ? buildPageMetadata(page) : buildMissingSiteMetadata();
}

export default async function SitePage({ params, searchParams }: RouteProps) {
  const { previewToken, routeParts } = splitPreview((await params).slug);
  const requestHeaders = await headers();
  const hostname = getRequestHostname(requestHeaders);
  const source = getSiteContentSource();

  // The shared convenience route never renders or proxies admissions. It starts
  // from B0's exact href and preserves only the bounded attribution allowlist.
  if (!previewToken && routeParts?.length === 1 && routeParts[0] === "apply") {
    const loaded = await loadSite({ hostname, source });
    if (loaded.status !== "available") notFound();
    const query = await searchParams;
    const requestUrl = new URL("/apply", buildCanonicalOrigin(loaded.canonicalDomain));
    for (const [key, value] of Object.entries(query)) if (typeof value === "string") requestUrl.searchParams.set(key, value);
    const destination = buildApplicationRedirectHref(loaded.site.links.application, requestUrl);
    if (!destination) notFound();
    redirect(destination);
  }

  const previewPathPrefix = previewToken ? `/__preview/${encodeURIComponent(previewToken)}` : undefined;
  const page = await resolveSitePage({ hostname, slugParts: routeParts, source, previewToken, previewPathPrefix });
  if (!page) notFound();
  if (!page.context.request.preview && page.load.redirectToHostname) {
    // `proxy.ts` owns the actual 308; this is a safe fallback for hosts where
    // middleware is not installed.
    redirect(page.context.request.canonicalUrl);
  }
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildStructuredData(page) }} />{page.renderer.render(page.context)}</>;
}
