import type { Metadata, MetadataRoute } from "next";
import { buildCanonicalOrigin } from "@/core/domain";
import { loadSite, type SiteContentSource } from "@/core/content";
import { getRenderer } from "@/core/renderers/registry";
import type { RendererFieldValue, SiteLoadResult, SiteRenderContext } from "@/core/contracts";

export interface ResolvedSitePage {
  load: Extract<SiteLoadResult, { status: "available" }>;
  renderer: NonNullable<ReturnType<typeof getRenderer>>;
  route: { key: string; path: string; indexable?: boolean };
  context: SiteRenderContext;
}

export async function resolveSitePage(input: { hostname: string | null; slugParts?: string[]; source: SiteContentSource; previewToken?: string; previewPathPrefix?: string }): Promise<ResolvedSitePage | null> {
  const load = await loadSite({ hostname: input.hostname, source: input.source, previewToken: input.previewToken });
  if (load.status !== "available") return null;
  const renderer = getRenderer(load.site.revision.rendererKey, load.site.revision.rendererSchemaVersion);
  if (!renderer) return null;
  const routePath = `/${(input.slugParts ?? []).filter(Boolean).join("/")}`.replace(/\/$/, "") || "/";
  const matchedRoute = renderer.routes.map((candidate) => ({ candidate, params: matchRoute(candidate.path, routePath) })).find((candidate) => candidate.params !== null);
  if (!matchedRoute || !matchedRoute.params) return null;
  const route = matchedRoute.candidate;
  const school = { id: load.site.profile.schoolId, slug: load.site.profile.schoolSlug, displayName: fieldText(load.site.revision.fields["identity.displayName"]), shortName: fieldText(load.site.revision.fields["identity.shortName"]) };
  const rendererData = renderer.validateRendererData({ school, fields: load.site.revision.fields });
  if (rendererData === null) return null;
  const origin = buildCanonicalOrigin(load.canonicalDomain);
  const request = { routeKey: route.key, canonicalUrl: new URL(routePath, origin).toString(), preview: load.preview, params: matchedRoute.params, pathPrefix: load.preview ? input.previewPathPrefix ?? "" : "" };
  const routeContext = { links: load.site.links, request };
  if (renderer.isRouteAvailable?.(rendererData, route.key, matchedRoute.params, routeContext) === false) return null;
  const assets = Object.fromEntries(load.site.assets.map((asset) => [asset.id, asset]));
  const seo = Object.fromEntries(Object.entries(load.site.revision.routeSeo).map(([key, value]) => [key, { ...value, ...(value.shareAssetId && assets[value.shareAssetId] ? { shareAsset: assets[value.shareAssetId] } : {}) }]));
  const routeIndexable = route.indexable !== false && renderer.isRouteIndexable?.(rendererData, route.key, matchedRoute.params, routeContext) !== false;
  return { load, renderer, route: { ...route, indexable: routeIndexable }, context: { school, assets, links: load.site.links, seo, publication: { revisionId: load.site.revision.id, publishedAt: load.site.revision.publishedAt ?? 0 }, request, rendererData } };
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

function fieldText(value: RendererFieldValue | undefined): string | undefined {
  return value?.kind === "text" ? value.value : undefined;
}

function presentationFor(page: ResolvedSitePage) {
  return page.renderer.getPresentation?.(page.context.rendererData, page.context);
}

function selectedAsset(page: ResolvedSitePage, fieldId: string, kind: "logo" | "favicon") {
  const field = page.load.site.revision.fields[fieldId];
  const asset = field?.kind === "asset_ref" ? page.context.assets[field.assetId] : undefined;
  return asset?.kind === kind && asset.channels.includes("site") ? asset : undefined;
}

/** Published pages require non-empty, unique metadata before search indexing. */
function hasUniqueRouteMetadata(page: ResolvedSitePage, title: string, description: string): boolean {
  if (!title.trim() || !description.trim()) return false;
  return !Object.entries(page.context.seo).some(([routeKey, seo]) => routeKey !== page.route.key && seo.title === title);
}

export function buildPageMetadata(page: ResolvedSitePage): Metadata {
  const routeSeo = page.context.seo[page.route.key];
  const presentation = presentationFor(page);
  const title = presentation?.title ?? routeSeo?.title ?? page.context.school.displayName ?? "School website";
  const description = presentation?.description ?? routeSeo?.description ?? "";
  const canonical = page.context.request.canonicalUrl;
  const preview = page.context.request.preview;
  // Managed revisions select their approved brand assets explicitly; never use
  // an arbitrary tenant favicon or a platform fallback.
  const favicon = selectedAsset(page, "brand.favicon", "favicon")?.url ?? (page.renderer.key === "legacy-template" ? presentation?.faviconUrl : undefined);
  const indexable = !preview && page.route.indexable !== false && hasUniqueRouteMetadata(page, title, description);
  return {
    metadataBase: new URL(canonical), applicationName: presentation?.applicationName, title, description,
    alternates: preview ? undefined : { canonical },
    robots: { index: indexable, follow: indexable },
    openGraph: { title, description, url: canonical, type: "website", images: routeSeo?.shareAsset ? [{ url: routeSeo.shareAsset.url, alt: routeSeo.shareAsset.altText ?? title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: routeSeo?.shareAsset ? [routeSeo.shareAsset.url] : undefined },
    ...(favicon ? { icons: { icon: [{ url: favicon }] } } : {}),
  };
}

export function buildSiteManifest(load: SiteLoadResult): MetadataRoute.Manifest {
  const fallback = { name: "Managed school site", short_name: "School", start_url: "/", display: "browser" as const, background_color: "#ffffff", theme_color: "#173B72" };
  if (load.status !== "available") return fallback;
  const renderer = getRenderer(load.site.revision.rendererKey, load.site.revision.rendererSchemaVersion);
  if (!renderer) return fallback;
  const school = { id: load.site.profile.schoolId, slug: load.site.profile.schoolSlug, displayName: fieldText(load.site.revision.fields["identity.displayName"]), shortName: fieldText(load.site.revision.fields["identity.shortName"]) };
  const rendererData = renderer.validateRendererData({ school, fields: load.site.revision.fields });
  if (rendererData === null) return fallback;
  const origin = buildCanonicalOrigin(load.canonicalDomain);
  const assets = Object.fromEntries(load.site.assets.map((asset) => [asset.id, asset]));
  const context: SiteRenderContext = { school, assets, links: load.site.links, seo: {}, publication: { revisionId: load.site.revision.id, publishedAt: load.site.revision.publishedAt ?? 0 }, request: { routeKey: "home", canonicalUrl: new URL("/", origin).toString(), preview: load.preview, params: {}, pathPrefix: "" }, rendererData };
  const presentation = renderer.getPresentation?.(rendererData, context);
  const manifest = presentation?.manifest;
  const name = manifest?.name ?? school.displayName ?? fallback.name;
  const faviconField = load.site.revision.fields["brand.favicon"];
  const favicon = faviconField?.kind === "asset_ref" ? assets[faviconField.assetId] : undefined;
  return { name, short_name: manifest?.shortName ?? school.shortName ?? name, start_url: "/", display: "browser", background_color: manifest?.backgroundColor ?? fallback.background_color, theme_color: manifest?.themeColor ?? fallback.theme_color, ...(favicon?.kind === "favicon" && favicon.channels.includes("site") ? { icons: [{ src: favicon.url }] } : {}) };
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
  const school = { id: load.site.profile.schoolId, slug: load.site.profile.schoolSlug, displayName: fieldText(load.site.revision.fields["identity.displayName"]), shortName: fieldText(load.site.revision.fields["identity.shortName"]) };
  const rendererData = renderer.validateRendererData({ school, fields: load.site.revision.fields });
  if (rendererData === null) return [];
  const origin = buildCanonicalOrigin(load.canonicalDomain);
  const lastModified = new Date(load.site.revision.publishedAt ?? 0);
  const isIndexable = (route: { key: string; path: string; indexable?: boolean }, path: string, params: Record<string, string>) => {
    const context = { links: load.site.links, request: { routeKey: route.key, canonicalUrl: new URL(path, origin).toString(), preview: false, params, pathPrefix: "" } };
    const metadata = load.site.revision.routeSeo[route.key];
    // Compatibility metadata is code-owned. Every B0-backed renderer needs
    // unique, complete revision metadata before it can enter the sitemap.
    const metadataIsUnique = renderer.key === "legacy-template" || Boolean(metadata?.title && metadata?.description)
      && Object.entries(load.site.revision.routeSeo).filter(([key, other]) => key !== route.key && other.title === metadata?.title).length === 0;
    return metadataIsUnique && route.indexable !== false && renderer.isRouteAvailable?.(rendererData, route.key, params, context) !== false && renderer.isRouteIndexable?.(rendererData, route.key, params, context) !== false;
  };
  const staticPaths = renderer.routes.filter((route) => !route.path.includes("[") && isIndexable(route, route.path, {})).map((route) => route.path);
  const dynamicPaths = renderer.sitemapPaths?.(rendererData).filter((path) => renderer.routes.some((route) => { const params = matchRoute(route.path, path); return params !== null && isIndexable(route, path, params); })) ?? [];
  return [...new Set([...staticPaths, ...dynamicPaths])].map((path) => ({ url: new URL(path, origin).toString(), lastModified, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 }));
}

export function buildStructuredData(page: ResolvedSitePage): string {
  const presentation = presentationFor(page);
  if (presentation?.structuredData) return JSON.stringify(presentation.structuredData).replace(/</g, "\\u003c");
  const text = (fieldId: string) => fieldText(page.load.site.revision.fields[fieldId]);
  const name = text("identity.displayName") ?? page.context.school.displayName;
  const root = new URL("/", page.context.request.canonicalUrl).toString();
  const graph: Record<string, unknown>[] = [{ "@type": "WebSite", name, url: root }];
  if (name) {
    const organization: Record<string, unknown> = { "@type": "EducationalOrganization", name, url: root };
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
