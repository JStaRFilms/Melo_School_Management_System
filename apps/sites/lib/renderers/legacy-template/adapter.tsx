import type { SiteRenderer } from "@/core/renderers/contract";
import { legacyDemoSchools, type SchoolConfig } from "@/renderers/legacy-template/legacy-data";
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
  render(context) {
    const school = legacyDemoSchools.find((candidate) => candidate.key === context.rendererData.schoolKey);
    if (!school) return null;
    const page = resolveLegacyPage(school, context.request.routeKey);
    const template = schoolTemplatesForLegacy(school);
    return page && template ? <>{context.request.preview ? <p className="fixed bottom-4 left-4 z-50 bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">Draft preview — not public</p> : null}<PublicSchoolPage school={school} template={template} page={page} pathPrefix={context.request.pathPrefix} /></> : null;
  },
};

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
