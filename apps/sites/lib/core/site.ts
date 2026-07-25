import type { Metadata, MetadataRoute } from "next";
import { buildCanonicalOrigin } from "@/core/domain";
import { loadSite, type SiteContentSource } from "@/core/content";
import { getRenderer } from "@/core/renderers/registry";
import type { SiteLoadResult, SiteRenderContext } from "@/core/contracts";

export interface ResolvedSitePage {
  load: Extract<SiteLoadResult, { status: "available" }>;
  renderer: NonNullable<ReturnType<typeof getRenderer>>;
  route: { key: string; path: string; indexable?: boolean };
  context: SiteRenderContext;
}

export async function resolveSitePage(input: { hostname: string | null; slugParts?: string[]; source: SiteContentSource; previewToken?: string }): Promise<ResolvedSitePage | null> {
  const load = await loadSite({ hostname: input.hostname, source: input.source, previewToken: input.previewToken });
  if (load.status !== "available") return null;
  const renderer = getRenderer(load.site.revision.rendererKey, load.site.revision.rendererSchemaVersion);
  if (!renderer) return null;
  const routePath = `/${(input.slugParts ?? []).filter(Boolean).join("/")}`.replace(/\/$/, "") || "/";
  const matchedRoute = renderer.routes.map((candidate) => ({ candidate, params: matchRoute(candidate.path, routePath) })).find((candidate) => candidate.params !== null);
  if (!matchedRoute || !matchedRoute.params) return null;
  const route = matchedRoute.candidate;
  const rendererData = renderer.validateRendererData(load.site.revision.fields);
  if (rendererData === null) return null;
  const origin = buildCanonicalOrigin(load.canonicalDomain);
  const assets = Object.fromEntries(load.site.assets.map((asset) => [asset.id, asset]));
  const seo = Object.fromEntries(Object.entries(load.site.revision.routeSeo).map(([key, value]) => [key, { ...value, ...(value.shareAssetId && assets[value.shareAssetId] ? { shareAsset: assets[value.shareAssetId] } : {}) }]));
  return { load, renderer, route, context: { school: { id: load.site.profile.schoolId, slug: load.site.profile.schoolSlug, displayName: fieldText(load.site.revision.fields["identity.displayName"]), shortName: fieldText(load.site.revision.fields["identity.shortName"]) }, fields: load.site.revision.fields, assets, links: load.site.links, seo, publication: { revisionId: load.site.revision.id, publishedAt: load.site.revision.publishedAt ?? 0 }, request: { routeKey: route.key, canonicalUrl: new URL(routePath, origin).toString(), preview: load.preview, params: matchedRoute.params }, rendererData } };
}

function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean); const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]!; const pathPart = pathParts[index]!;
    const dynamic = /^\[([a-zA-Z][a-zA-Z0-9_]*)\]$/.exec(patternPart);
    if (!dynamic) { if (patternPart !== pathPart) return null; continue; }
    try { params[dynamic[1]!] = decodeURIComponent(pathPart); } catch { return null; }
  }
  return params;
}

function fieldText(value: SiteRenderContext["fields"][string] | undefined): string | undefined {
  return value?.kind === "text" ? value.value : undefined;
}

export function buildPageMetadata(page: ResolvedSitePage): Metadata {
  const routeSeo = page.context.seo[page.route.key];
  const title = routeSeo?.title ?? page.context.school.displayName ?? "School website";
  const description = routeSeo?.description ?? "";
  const canonical = page.context.request.canonicalUrl;
  const preview = page.context.request.preview;
  return {
    metadataBase: new URL(canonical), title, description,
    alternates: preview ? undefined : { canonical },
    robots: { index: !preview && page.route.indexable !== false, follow: !preview },
    openGraph: { title, description, url: canonical, type: "website", images: routeSeo?.shareAsset ? [{ url: routeSeo.shareAsset.url, alt: routeSeo.shareAsset.altText ?? title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: routeSeo?.shareAsset ? [routeSeo.shareAsset.url] : undefined },
  };
}

export function buildRobotsMetadata(load: SiteLoadResult): MetadataRoute.Robots {
  if (load.status !== "available" || load.preview) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const origin = buildCanonicalOrigin(load.canonicalDomain);
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${origin}/sitemap.xml` };
}

export async function buildSitemapEntries(hostname: string | null, source: SiteContentSource): Promise<MetadataRoute.Sitemap> {
  const load = await loadSite({ hostname, source });
  if (load.status !== "available") return [];
  const renderer = getRenderer(load.site.revision.rendererKey, load.site.revision.rendererSchemaVersion);
  if (!renderer) return [];
  const rendererData = renderer.validateRendererData(load.site.revision.fields);
  if (rendererData === null) return [];
  const origin = buildCanonicalOrigin(load.canonicalDomain);
  const lastModified = new Date(load.site.revision.publishedAt ?? 0);
  const staticPaths = renderer.routes.filter((route) => route.indexable !== false && !route.path.includes("[")).map((route) => route.path);
  const dynamicPaths = renderer.sitemapPaths?.(rendererData).filter((path) => renderer.routes.some((route) => matchRoute(route.path, path) !== null)) ?? [];
  return [...new Set([...staticPaths, ...dynamicPaths])].map((path) => ({ url: new URL(path, origin).toString(), lastModified, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 }));
}

export function buildStructuredData(page: ResolvedSitePage): string {
  const text = (fieldId: string) => fieldText(page.context.fields[fieldId]);
  const name = text("identity.displayName") ?? page.context.school.displayName;
  const graph: Record<string, unknown>[] = [{ "@type": "WebSite", name, url: page.context.request.canonicalUrl }];
  if (name) {
    const organization: Record<string, unknown> = { "@type": "EducationalOrganization", name, url: page.context.request.canonicalUrl };
    const phone = text("contact.phone"); const email = text("contact.email");
    if (phone) organization.telephone = phone;
    if (email) organization.email = email;
    const streetAddress = text("contact.address.streetAddress"); const addressLocality = text("contact.address.locality"); const addressRegion = text("contact.address.region"); const postalCode = text("contact.address.postalCode"); const addressCountry = text("contact.address.country");
    if (streetAddress || addressLocality || addressRegion || postalCode || addressCountry) organization.address = { "@type": "PostalAddress", ...(streetAddress ? { streetAddress } : {}), ...(addressLocality ? { addressLocality } : {}), ...(addressRegion ? { addressRegion } : {}), ...(postalCode ? { postalCode } : {}), ...(addressCountry ? { addressCountry } : {}) };
    graph.push(organization);
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}

export function buildMissingSiteMetadata(): Metadata { return { title: "Public school website unavailable", description: "This school website is unavailable on the current hostname.", robots: { index: false, follow: false } }; }
