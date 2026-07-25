import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getRenderer } from "@/core/renderers/registry";
import { buildSitemapEntries, resolveSitePage } from "@/core/site";
import { obhisRenderer } from "@/renderers/obhis-v1/definition";

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
    const data = obhisRenderer.validateRendererData(fields);
    expect(data).toMatchObject({ identity: { displayName: "Approved School" }, programmes: [{ slug: "early-years" }], contact: {} });
    expect(data.contact.email).toBeUndefined();
    expect(obhisRenderer.validateRendererData({})).toBeNull();
  });

  test("renders the B0 application href verbatim without historic claims or a portal fallback", () => {
    const data = obhisRenderer.validateRendererData(fields);
    const markup = renderToStaticMarkup(obhisRenderer.render({
      school: { id: "obhis", slug: "approved-school", displayName: "Approved School" }, fields, assets: {},
      links: { application: envelope().links.application }, seo: {}, publication: { revisionId: "revision", publishedAt: 1_700_000_000_000 },
      request: { routeKey: "home", canonicalUrl: "https://school.example/", preview: false, params: {} }, rendererData: data,
    }));
    expect(markup).toContain('href="https://apply.example/s/approved-school"');
    expect(markup).not.toContain("₦5,000");
    expect(markup).not.toContain("Family portal");
    expect(markup).not.toContain("Obhis Heritage Academy");
  });

  test("resolves canonical dynamic policy paths and emits only declared sitemap paths", async () => {
    const source = { loadPublished: async () => envelope() };
    const page = await resolveSitePage({ hostname: "school.example", slugParts: ["policies", "family-guide"], source });
    expect(page.context).toMatchObject({ request: { routeKey: "policy-detail", canonicalUrl: "http://school.example/policies/family-guide", params: { policySlug: "family-guide" } }, links: { application: { href: "https://apply.example/s/approved-school" } } });
    const sitemap = await buildSitemapEntries("school.example", source);
    expect(sitemap.map((entry) => entry.url)).toContain("http://school.example/policies/family-guide");
  });
});
