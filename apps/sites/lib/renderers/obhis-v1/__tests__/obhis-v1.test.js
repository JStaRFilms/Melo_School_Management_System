import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getRenderer } from "@/core/renderers/registry";
import { buildPageMetadata, buildSitemapEntries, resolveSitePage } from "@/core/site";
import { obhisRenderer } from "@/renderers/obhis-v1/definition";

const school = { id: "obhis", slug: "approved-school", displayName: "Approved School" };
const validationInput = () => ({ school, fields });

const fields = {
  "identity.displayName": { kind: "text", value: "Approved School" },
  "home.hero.summary": { kind: "text", value: "Approved editorial summary." },
  "programmes.ids": { kind: "string_list", value: ["early-years"] },
  "programmes.early-years.name": { kind: "text", value: "Early years" },
  "programmes.early-years.summary": { kind: "text", value: "Approved programme summary." },
  "admissions.steps": { kind: "string_list", value: ["Review current information", "Start a secure application"] },
  "policies.ids": { kind: "string_list", value: ["family-guide"] },
  "policies.family-guide.title": { kind: "text", value: "Family guide" },
  "policies.family-guide.summary": { kind: "text", value: "Approved policy summary." },
  "contact.email": { kind: "text", value: "invalid address" },
};

function envelope() {
  return {
    profile: { schoolId: "obhis", schoolSlug: "approved-school", mode: "managed", status: "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", canonicalDomainId: "canonical" },
    domains: [{ id: "canonical", hostname: "school.example", status: "active", canonicalIntent: "canonical" }],
    revision: { id: "revision", state: "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", publishedAt: 1_700_000_000_000, fields, routeSeo: {} },
    assets: [],
    links: { application: { version: "1", schoolSlug: "approved-school", href: "https://apply.example/s/approved-school", availability: "open", intakeSlug: null, opensAt: null, closesAt: null } },
  };
}

describe("obhis-v1", () => {
  test("is a compiled registered renderer with the exact code-owned routes", () => {
    expect(getRenderer("obhis-v1", "1")).toBe(obhisRenderer);
    expect(obhisRenderer.routes.map((route) => route.path)).toEqual(["/", "/about", "/programmes", "/admissions", "/school-life", "/visit", "/contact", "/policies", "/policies/[policySlug]"]);
    expect(obhisRenderer.routes.some((route) => route.path === "/apply")).toBe(false);
  });

  test("accepts only bounded semantic fields and omits malformed contact data", () => {
    const data = obhisRenderer.validateRendererData(validationInput());
    expect(data).toMatchObject({ identity: { displayName: "Approved School" }, programmes: [{ slug: "early-years" }], contact: {} });
    expect(data.contact.email).toBeUndefined();
    expect(obhisRenderer.validateRendererData({ school, fields: {} })).toBeNull();
  });

  test("renders the B0 application href verbatim without historic claims or a portal fallback", () => {
    const data = obhisRenderer.validateRendererData(validationInput());
    const markup = renderToStaticMarkup(obhisRenderer.render({
      school, assets: {},
      links: { application: envelope().links.application }, seo: {}, publication: { revisionId: "revision", publishedAt: 1_700_000_000_000 },
      request: { routeKey: "home", canonicalUrl: "https://school.example/", preview: false, params: {}, pathPrefix: "" }, rendererData: data,
    }));
    expect(markup).toContain('href="https://apply.example/s/approved-school"');
    expect(markup).not.toContain("₦5,000");
    expect(markup).not.toContain("Family portal");
    expect(markup).not.toContain("Obhis Heritage Academy");
    expect(markup).not.toContain('href="/visit"');
  });

  test("uses approved responsive asset derivatives with reserved dimensions", () => {
    const responsiveFields = { ...fields, "home.hero.asset": { kind: "asset_ref", assetId: "hero" } };
    const data = obhisRenderer.validateRendererData({ school, fields: responsiveFields });
    const markup = renderToStaticMarkup(obhisRenderer.render({
      school, assets: { hero: { id: "hero", kind: "hero", url: "https://assets.example/hero-1200.webp", altText: "Approved campus view", decorative: false, width: 1200, height: 1500, responsiveSources: [{ url: "https://assets.example/hero-640.webp", width: 640 }, { url: "https://assets.example/hero-1200.webp", width: 1200 }] } },
      links: { application: envelope().links.application }, seo: {}, publication: { revisionId: "revision", publishedAt: 1 }, request: { routeKey: "home", canonicalUrl: "https://school.example/", preview: false, params: {}, pathPrefix: "" }, rendererData: data,
    }));
    expect(markup).toContain("hero-640.webp");
    expect(markup).toContain('width="1200"');
  });

  test("uses only an approved tenant favicon and never depends on a global app icon", async () => {
    const site = envelope();
    site.assets = [{ id: "favicon", kind: "favicon", url: "https://assets.example/favicon.png", decorative: true, rightsStatus: "approved", status: "published" }];
    const page = await resolveSitePage({ hostname: "school.example", source: { loadPublished: async () => site } });
    expect(buildPageMetadata(page).icons).toMatchObject({ icon: [{ url: "https://assets.example/favicon.png" }] });
  });

  test("keeps preview navigation scoped to its authorized preview path and shows a watermark", () => {
    const previewFields = { ...fields, "visit.lead": { kind: "text", value: "Approved visit information." } };
    const data = obhisRenderer.validateRendererData({ school, fields: previewFields });
    const markup = renderToStaticMarkup(obhisRenderer.render({
      school, assets: {},
      links: { application: envelope().links.application }, seo: {}, publication: { revisionId: "draft", publishedAt: 0 },
      request: { routeKey: "home", canonicalUrl: "https://preview.example/", preview: true, params: {}, pathPrefix: "/__preview/opaque-token" }, rendererData: data,
    }));
    expect(markup).toContain("Draft preview — not public");
    expect(markup).toContain('href="/__preview/opaque-token/visit"');
  });

  test("resolves canonical dynamic policy paths and emits only declared sitemap paths", async () => {
    const source = { loadPublished: async () => envelope() };
    const page = await resolveSitePage({ hostname: "school.example", slugParts: ["policies", "family-guide"], source });
    expect(page.context).toMatchObject({ request: { routeKey: "policy-detail", canonicalUrl: "http://school.example/policies/family-guide", params: { policySlug: "family-guide" } }, links: { application: { href: "https://apply.example/s/approved-school" } } });
    const sitemap = await buildSitemapEntries("school.example", source);
    expect(sitemap.map((entry) => entry.url)).toContain("http://school.example/policies/family-guide");
    const unavailable = envelope();
    unavailable.revision.fields = { "identity.displayName": fields["identity.displayName"] };
    const unavailableSitemap = await buildSitemapEntries("school.example", { loadPublished: async () => unavailable });
    expect(unavailableSitemap.map((entry) => entry.url)).toEqual(["http://school.example/"]);
    expect(await resolveSitePage({ hostname: "school.example", slugParts: ["admissions"], source: { loadPublished: async () => unavailable } })).toBeNull();
  });
});
