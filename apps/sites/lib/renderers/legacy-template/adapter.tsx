import type { SiteRenderer } from "@/core/renderers/contract";
import { getSchoolUploadedFaviconUrl, legacyDemoSchools, type SchoolConfig } from "@/renderers/legacy-template/legacy-data";
import { PublicSchoolPage } from "@/site-ui";

export type LegacyRendererData = { schoolKey: string };

export const legacyTemplateRenderer: SiteRenderer<LegacyRendererData> = {
  key: "legacy-template",
  schemaVersion: "1",
  routes: [
    { key: "home", path: "/" }, { key: "about", path: "/about" }, { key: "academics", path: "/academics" },
    { key: "admissions", path: "/admissions" }, { key: "fees", path: "/fees" }, { key: "visit", path: "/visit" }, { key: "contact", path: "/contact" },
  ],
  validateRendererData(input) {
    const field = input.fields.schoolKey;
    const schoolKey = field && typeof field === "object" && "kind" in field && field.kind === "text" && "value" in field && typeof field.value === "string"
      ? field.value
      : null;
    return schoolKey && input.school.id === `legacy:${schoolKey}` && input.school.slug === schoolKey && legacyDemoSchools.some((school) => school.key === schoolKey) ? { schoolKey } : null;
  },
  getPresentation(data, context) {
    const school = legacyDemoSchools.find((candidate) => candidate.key === data.schoolKey);
    const page = school ? resolveLegacyPage(school, context.request.routeKey) : null;
    if (!school || !page) return undefined;
    const root = new URL("/", context.request.canonicalUrl).toString();
    const title = page.key === "home" ? school.brand.name : `${page.title} — ${school.brand.name}`;
    return {
      title, description: page.description, applicationName: school.brand.name,
      faviconUrl: legacyFaviconUrl(school),
      manifest: { name: school.brand.name, shortName: school.brand.shortName, themeColor: school.theme.primary, backgroundColor: school.theme.background },
      structuredData: { "@context": "https://schema.org", "@graph": [
        { "@type": "WebSite", name: school.brand.name, url: root, description: page.description },
        { "@type": "EducationalOrganization", name: school.brand.name, url: root, telephone: school.contact.phone, email: school.contact.email, address: school.contact.address },
      ] },
    };
  },
  render(context) {
    const school = legacyDemoSchools.find((candidate) => candidate.key === context.rendererData.schoolKey);
    if (!school) return null;
    const page = resolveLegacyPage(school, context.request.routeKey);
    const template = schoolTemplatesForLegacy(school);
    return page && template ? <>{context.request.preview ? <p className="fixed bottom-4 left-4 z-50 bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">Draft preview — not public</p> : null}<PublicSchoolPage school={school} template={template} page={page} pathPrefix={context.request.pathPrefix} /></> : null;
  },
};

function legacyFaviconUrl(school: SchoolConfig): string {
  const uploaded = getSchoolUploadedFaviconUrl(school);
  if (uploaded) return uploaded;
  // A deterministic school-mark fallback preserves demo-tenant identity without
  // reintroducing any shared platform/Melo icon or remote asset.
  const mark = school.brand.logoMark.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || school.brand.fallbackMark;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${school.theme.primary}"/><text x="32" y="40" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="22" font-weight="700">${mark}</text></svg>`)}`;
}

function schoolTemplatesForLegacy(school: SchoolConfig) {
  // The generic template system is intentionally quarantined in this adapter.
  return schoolTemplates[school.templateKey];
}

function resolveLegacyPage(school: SchoolConfig, routeKey: string) {
  const page = corePages.find((candidate) => candidate.key === routeKey);
  if (!page) return null;
  const template = schoolTemplatesForLegacy(school);
  const layout = template?.pageLayouts[page.key];
  const content = school.pageContent[page.key];
  if (!template || !layout?.visible || !content) return null;
  return { key: page.key, slug: page.slug, title: page.key === "home" ? school.brand.name : page.label, description: content.hero.description, visible: true, slots: layout.slots, content, canonicalPath: page.slug ? `/${page.slug}` : "/" };
}

// Re-exported only for this quarantined renderer; no site-core code consumes it.
import { coreSitePages as corePages, schoolTemplates } from "@/renderers/legacy-template/legacy-data";
