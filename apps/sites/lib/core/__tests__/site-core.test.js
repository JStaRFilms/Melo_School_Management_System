import { describe, expect, test } from "vitest";
import { normalizeHostname } from "@/core/domain";
import { loadSite } from "@/core/content";
import { buildApplicationRedirectHref, getPublicLinkIntegration } from "@/core/links";
import { getRenderer } from "@/core/renderers/registry";
import { buildPageMetadata, buildRobotsMetadata, buildSiteManifest, buildSitemapEntries, buildStructuredData, resolveSitePage } from "@/core/site";
import { previewTokenFromPath } from "@/core/preview";
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

  test("authorizes active-alias previews without emitting a canonical redirect", async () => {
    const preview = clone(getLegacyEnvelopeForHostname(hostname));
    preview.preview = { authorized: true, expiresAt: Date.now() + 60_000 };
    const result = await loadSite({ hostname: "greenfield.localhost", previewToken: "opaque", source: source(preview) });
    expect(result).toMatchObject({ status: "available", preview: true, canonicalDomain: { hostname: "greenfield.localhost" } });
    expect(result.redirectToHostname).toBeUndefined();
    expect(previewTokenFromPath("/__preview/opaque/visit")).toBe("opaque");
  });

  test("fetches current publication and application availability on every public request", async () => {
    const open = clone(getLegacyEnvelopeForHostname(hostname)); const closed = clone(open); closed.links.application.availability = "closed";
    let calls = 0; const currentSource = { loadPublished: async () => (++calls === 1 ? open : closed) };
    expect((await loadSite({ hostname, source: currentSource })).site.links.application.availability).toBe("unavailable");
    expect((await loadSite({ hostname, source: currentSource })).site.links.application.availability).toBe("closed");
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
    expect(buildStructuredData(page)).not.toContain("</script>");
  });

  test("preserves legacy presentation metadata through its compatibility renderer only", async () => {
    const page = await resolveSitePage({ hostname, slugParts: ["about"], source: { loadPublished: async (host) => getLegacyEnvelopeForHostname(host) } });
    expect(buildPageMetadata(page)).toMatchObject({ applicationName: "Greenfield Preparatory School", title: "About — Greenfield Preparatory School" });
    expect(buildSiteManifest(page.load)).toMatchObject({ name: "Greenfield Preparatory School", short_name: "Greenfield" });
    const graph = JSON.parse(buildStructuredData(page))["@graph"];
    expect(graph[0]).toMatchObject({ "@type": "WebSite", url: `http://${hostname}/` });
    expect(graph[1]).toMatchObject({ "@type": "EducationalOrganization", email: "hello@greenfieldprep.example" });
    expect(buildPageMetadata(page).icons).toBeDefined();
  });

  test("uses the B0 application href verbatim and rejects unavailable or open redirects", () => {
    const link = { version: "1", schoolSlug: "greenfield-preparatory", href: "https://apply.example/s/greenfield-preparatory/i/2027", availability: "open", intakeSlug: "2027", opensAt: null, closesAt: null };
    expect(buildApplicationRedirectHref(link, new URL("https://school.example/apply?source=managed_site&campaign=spring&returnTo=https://evil.example"))).toBe("https://apply.example/s/greenfield-preparatory/i/2027?source=managed_site&campaign=spring");
    expect(buildApplicationRedirectHref({ ...link, availability: "closed" }, new URL("https://school.example/apply"))).toBeNull();
    expect(getPublicLinkIntegration({ mode: "external", application: link }).application.href).toBe(link.href);
    expect(getPublicLinkIntegration({ mode: "none", application: link }).application.href).toBe(link.href);
  });
});
