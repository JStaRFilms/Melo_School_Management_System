import { describe, expect, test } from "vitest";
import { normalizeHostname } from "@/core/domain";
import { invalidatePublishedSiteCache, loadSite } from "@/core/content";
import { buildApplicationRedirectHref, getPublicLinkIntegration } from "@/core/links";
import { getRenderer } from "@/core/renderers/registry";
import { buildRobotsMetadata, buildSitemapEntries, buildStructuredData, resolveSitePage } from "@/core/site";
import { getLegacyEnvelopeForHostname } from "@/renderers/legacy-template/fixtures";

const hostname = "greenfield.schoolos.localhost";
const clone = (value) => structuredClone(value);
const source = (value) => ({ loadPublished: async () => value });

describe("B4 shared site core", () => {
  test("normalizes hostnames and resolves only active, ready compatibility domains", async () => {
    expect(normalizeHostname("GREENFIELD.SCHOOLOS.LOCALHOST.:3005")).toBe(hostname);
    const result = await loadSite({ hostname, source: { loadPublished: async (host) => getLegacyEnvelopeForHostname(host) } });
    expect(result.status).toBe("available");
    const inactive = await loadSite({ hostname: "legacy-heights.schoolos.localhost", source: { loadPublished: async (host) => getLegacyEnvelopeForHostname(host) } });
    expect(inactive).toMatchObject({ status: "unavailable", reason: "unknown_host" });
  });

  test("issues a canonical target only for an active declared alias", async () => {
    const result = await loadSite({ hostname: "greenfield.localhost", source: { loadPublished: async (host) => getLegacyEnvelopeForHostname(host) } });
    expect(result).toMatchObject({ status: "available", redirectToHostname: hostname });
    const invalidAlias = clone(getLegacyEnvelopeForHostname(hostname));
    invalidAlias.domains.push({ id: "invalid-alias", hostname: "invalid-alias.localhost", status: "active", canonicalIntent: "canonical" });
    expect(await loadSite({ hostname: "invalid-alias.localhost", source: source(invalidAlias) })).toMatchObject({ status: "unavailable", reason: "inactive_domain" });
  });

  test("fails closed for unknown hosts, unpublished revisions, and unauthorized previews", async () => {
    expect(await loadSite({ hostname: "unknown.example", source: { loadPublished: async () => null } })).toMatchObject({ status: "unavailable", reason: "unknown_host" });
    const draft = clone(getLegacyEnvelopeForHostname(hostname));
    draft.revision.state = "draft";
    expect(await loadSite({ hostname, source: source(draft) })).toMatchObject({ status: "unavailable", reason: "unpublished" });
    expect(await loadSite({ hostname, previewToken: "opaque", source: source(draft) })).toMatchObject({ status: "unavailable", reason: "unauthorized_preview" });
    draft.preview = { authorized: true, expiresAt: Date.now() + 60_000 };
    draft.profile.status = "draft";
    draft.domains.find((domain) => domain.hostname === hostname).status = "verification_pending";
    expect(await loadSite({ hostname, previewToken: "opaque", source: source(draft) })).toMatchObject({ status: "available", preview: true });
    const invalidState = clone(getLegacyEnvelopeForHostname(hostname));
    invalidState.revision.state = "not-published";
    expect(await loadSite({ hostname, source: source(invalidState) })).toMatchObject({ status: "unavailable", reason: "unknown_host" });
    const wrongLink = clone(getLegacyEnvelopeForHostname(hostname));
    wrongLink.links.application.schoolSlug = "another-school";
    expect(await loadSite({ hostname, source: source(wrongLink) })).toMatchObject({ status: "unavailable", reason: "unknown_host" });
    const missingPublication = clone(getLegacyEnvelopeForHostname(hostname));
    delete missingPublication.revision.publishedAt;
    expect(await loadSite({ hostname, source: source(missingPublication) })).toMatchObject({ status: "unavailable", reason: "invalid_content" });
  });

  test("caches an immutable published revision by school and revision, then supports invalidation", async () => {
    const site = clone(getLegacyEnvelopeForHostname(hostname)); let calls = 0;
    const cachedSource = { loadPublished: async () => { calls += 1; return site; } };
    await loadSite({ hostname, source: cachedSource }); await loadSite({ hostname, source: cachedSource });
    expect(calls).toBe(1);
    invalidatePublishedSiteCache(site.profile.schoolId);
    await loadSite({ hostname, source: cachedSource });
    expect(calls).toBe(2);
  });

  test("uses the compile-time registry and does not fall back on unknown renderers", async () => {
    expect(getRenderer("legacy-template", "1")).not.toBeNull();
    expect(getRenderer("missing-renderer", "1")).toBeNull();
    const invalid = clone(getLegacyEnvelopeForHostname(hostname));
    invalid.profile.rendererKey = "missing-renderer";
    invalid.revision.rendererKey = "missing-renderer";
    expect(await resolveSitePage({ hostname, source: source(invalid) })).toBeNull();
  });

  test("generates canonical robots and sitemap from publication time", async () => {
    const site = clone(getLegacyEnvelopeForHostname(hostname));
    site.revision.publishedAt = 1_700_000_000_000;
    const loaded = await loadSite({ hostname, source: source(site) });
    expect(buildRobotsMetadata(loaded)).toMatchObject({ sitemap: `http://${hostname}/sitemap.xml` });
    const sitemap = await buildSitemapEntries(hostname, source(site));
    expect(sitemap[0]).toMatchObject({ url: `http://${hostname}/`, lastModified: new Date(1_700_000_000_000) });
    site.revision.fields["identity.displayName"] = { kind: "text", value: "Safe </script> name" };
    const page = await resolveSitePage({ hostname, source: source(site) });
    expect(buildStructuredData(page)).toContain("Safe \\u003c/script> name");
  });

  test("uses the B0 application href verbatim and rejects unavailable or open redirects", () => {
    const link = { version: "1", schoolSlug: "greenfield-preparatory", href: "https://apply.example/s/greenfield-preparatory/i/2027", availability: "open", intakeSlug: "2027", opensAt: null, closesAt: null };
    expect(buildApplicationRedirectHref(link, new URL("https://school.example/apply?source=managed_site&campaign=spring&returnTo=https://evil.example"))).toBe("https://apply.example/s/greenfield-preparatory/i/2027?source=managed_site&campaign=spring");
    expect(buildApplicationRedirectHref({ ...link, availability: "closed" }, new URL("https://school.example/apply"))).toBeNull();
    expect(getPublicLinkIntegration({ mode: "external", application: link }).application.href).toBe(link.href);
    expect(getPublicLinkIntegration({ mode: "none", application: link }).application.href).toBe(link.href);
  });
});
