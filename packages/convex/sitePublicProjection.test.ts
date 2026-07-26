/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import schema from "./schema";

const siteProjectionApi = api as unknown as { functions: { foundation: { siteProjections: {
  getPublishedProjection: FunctionReference<"query", "public", { hostname: string }, unknown>;
} } } };

const modules = import.meta.glob("./**/*.ts");

async function insertPublishedSite(t: ReturnType<typeof convexTest>, input: { slug: string; hostname: string; alias?: string }) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: input.slug, slug: input.slug, status: "active", createdAt: now, updatedAt: now });
    const canonicalDomainId = await ctx.db.insert("schoolDomains", { schoolId, hostname: input.hostname, surface: "public", kind: "custom_domain", status: "active", canonicalIntent: "canonical", ownership: "school_managed_dns", createdAt: now, updatedAt: now });
    if (input.alias) await ctx.db.insert("schoolDomains", { schoolId, hostname: input.alias, surface: "public", kind: "custom_domain", status: "active", canonicalIntent: "redirect", canonicalDomainId, ownership: "school_managed_dns", createdAt: now, updatedAt: now });
    const revisionId = await ctx.db.insert("schoolSiteRevisions", { schoolId, revisionNumber: 1, state: "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", content: { fields: [{ fieldId: "identity.displayName", value: { kind: "text", value: "Approved school" } }], routeSeo: [] }, contentDigest: "fixture", approvalEvidenceIds: [], expectedDraftVersion: 0, publishedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolSiteProfiles", { schoolId, mode: "managed", status: "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", publishedRevisionId: revisionId, canonicalDomainId, createdAt: now, updatedAt: now });
    return { schoolId, revisionId };
  });
}

describe("B4 B0 public-site projections", () => {
  test("projects only the immutable published revision for its hostname and active alias", async () => {
    const t = convexTest(schema, modules);
    const previousOrigin = process.env.APPLICATION_ORIGIN;
    process.env.APPLICATION_ORIGIN = "https://apply.example.test";
    try {
      const first = await insertPublishedSite(t, { slug: "first", hostname: "first.example.test", alias: "www.first.example.test" });
      await insertPublishedSite(t, { slug: "second", hostname: "second.example.test" });
      const canonical = await t.query(siteProjectionApi.functions.foundation.siteProjections.getPublishedProjection, { hostname: "first.example.test" });
      expect(canonical).toMatchObject({ profile: { schoolId: first.schoolId, schoolSlug: "first" }, revision: { id: first.revisionId, state: "published" } });
      const alias = await t.query(siteProjectionApi.functions.foundation.siteProjections.getPublishedProjection, { hostname: "www.first.example.test" });
      expect(alias?.domains.map((domain) => domain.hostname)).toEqual(expect.arrayContaining(["first.example.test", "www.first.example.test"]));
      expect(await t.query(siteProjectionApi.functions.foundation.siteProjections.getPublishedProjection, { hostname: "second.example.test" })).toMatchObject({ profile: { schoolSlug: "second" } });
      expect(await t.query(siteProjectionApi.functions.foundation.siteProjections.getPublishedProjection, { hostname: "unknown.example.test" })).toBeNull();
    } finally {
      if (previousOrigin === undefined) delete process.env.APPLICATION_ORIGIN;
      else process.env.APPLICATION_ORIGIN = previousOrigin;
    }
  });
});
