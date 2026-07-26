/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const siteProjectionApi = api as unknown as { functions: { foundation: { siteProjections: { getPublishedProjection: FunctionReference<"query", "public", { hostname: string }, unknown> } } } };

describe("public publication projection integrity", () => {
  test("fails closed for manually synthesized published rows without a lifecycle manifest and accountable evidence", async () => {
    const t = convexTest(schema, modules); const now = Date.now();
    const schoolId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Synthetic", slug: "synthetic", status: "active", createdAt: now, updatedAt: now });
      const domainId = await ctx.db.insert("schoolDomains", { schoolId, hostname: "synthetic.example.test", surface: "public", kind: "custom_domain", status: "active", canonicalIntent: "canonical", ownership: "school_managed_dns", createdAt: now, updatedAt: now });
      const revisionId = await ctx.db.insert("schoolSiteRevisions", { schoolId, revisionNumber: 1, state: "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", content: { fields: [], routeSeo: [] }, contentDigest: "forged", approvalEvidenceIds: [], expectedDraftVersion: 0, publishedAt: now, createdAt: now, updatedAt: now });
      await ctx.db.insert("schoolSiteProfiles", { schoolId, mode: "managed", status: "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", publishedRevisionId: revisionId, canonicalDomainId: domainId, activePublicDomainCount: 1, createdAt: now, updatedAt: now });
      return schoolId;
    });
    expect(schoolId).toBeTruthy();
    expect(await t.query(siteProjectionApi.functions.foundation.siteProjections.getPublishedProjection, { hostname: "synthetic.example.test" })).toBeNull();
  });
});
