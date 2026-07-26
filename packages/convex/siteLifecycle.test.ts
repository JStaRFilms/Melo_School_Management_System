/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { FunctionReference } from "convex/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const siteApi = api as unknown as { functions: { foundation: {
  siteLifecycle: {
    bootstrapManagedSite: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; rendererKey: string; rendererSchemaVersion: string; approvalEvidenceIds: Id<"schoolApprovalEvidence">[] }, Id<"schoolSiteProfiles">>;
    saveDraft: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; expectedDraftVersion: number; content: { fields: { fieldId: string; value: { kind: "text"; value: string } }[]; routeSeo: { routeId: string; title: string; description: string }[] }; approvalEvidenceIds: Id<"schoolApprovalEvidence">[] }, Id<"schoolSiteRevisions">>;
    publishDraft: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; expectedDraftVersion: number }, Id<"schoolSiteRevisions">>;
    issuePreviewCapability: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; revisionId: Id<"schoolSiteRevisions">; hostname: string; lifetimeMs: number }, { tokenId: Id<"schoolSitePreviewTokens">; previewToken: string; expiresAt: number }>;
    revokePreviewCapability: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; tokenId: Id<"schoolSitePreviewTokens"> }, null>;
  };
  siteDomains: {
    requestDomain: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; hostname: string; kind: "custom_domain"; ownership: "school_managed_dns" }, Id<"schoolDomains">>;
    beginDomainVerification: FunctionReference<"mutation", "public", { schoolId: Id<"schools">; domainId: Id<"schoolDomains"> }, { verificationToken: string }>;
  };
  siteProjections: { getPublishedProjection: FunctionReference<"query", "public", { hostname: string }, unknown>; getPreviewProjection: FunctionReference<"query", "public", { hostname: string; tokenHash: string }, unknown> };
} } };
const internalSiteApi = internal as unknown as { functions: { foundation: { siteDomains: {
  advanceDomainLifecycleInternal: FunctionReference<"mutation", "internal", { domainId: Id<"schoolDomains">; nextStatus: "verified" | "routing_pending" | "certificate_pending" | "ready" | "active"; verificationToken?: string }, null>;
  setCanonicalDomain: FunctionReference<"mutation", "internal", { schoolId: Id<"schools">; domainId: Id<"schoolDomains"> }, null>;
} } } };

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function fixture(t: ReturnType<typeof convexTest>, slug = "alpha") {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: slug, slug, status: "active", createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: `${slug}-auth`, authTokenIdentifier: `issuer|${slug}`, name: slug, email: `${slug}@example.test`, role: "admin", createdAt: now, updatedAt: now });
    for (const capability of ["settings.manage", "site.publish.standard", "site.publish.sensitive", "site.preview", "site.domain.request", "site.revert"] as const) await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability, scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now });
    return { schoolId, userId, identity: { subject: `${slug}-auth`, tokenIdentifier: `issuer|${slug}`, issuer: "issuer" } };
  });
}

async function makeActiveDomain(t: ReturnType<typeof convexTest>, identity: { subject: string; tokenIdentifier: string; issuer: string }, schoolId: Id<"schools">, hostname: string) {
  const domainId = await t.withIdentity(identity).mutation(siteApi.functions.foundation.siteDomains.requestDomain, { schoolId, hostname, kind: "custom_domain", ownership: "school_managed_dns" });
  const proof = await t.withIdentity(identity).mutation(siteApi.functions.foundation.siteDomains.beginDomainVerification, { schoolId, domainId });
  await t.mutation(internalSiteApi.functions.foundation.siteDomains.advanceDomainLifecycleInternal, { domainId, nextStatus: "verified", verificationToken: proof.verificationToken });
  for (const nextStatus of ["routing_pending", "certificate_pending", "ready", "active"] as const) await t.mutation(internalSiteApi.functions.foundation.siteDomains.advanceDomainLifecycleInternal, { domainId, nextStatus });
  return domainId;
}

describe("B4/B5 managed publication controls", () => {
  test("bootstraps a managed initial draft and enforces the bounded domain lifecycle, tenant hostname ownership, and one canonical host", async () => {
    const t = convexTest(schema, modules); const first = await fixture(t, "first"); const second = await fixture(t, "second");
    await t.withIdentity(first.identity).mutation(siteApi.functions.foundation.siteLifecycle.bootstrapManagedSite, { schoolId: first.schoolId, rendererKey: "obhis-v1", rendererSchemaVersion: "1", approvalEvidenceIds: [] });
    await t.withIdentity(second.identity).mutation(siteApi.functions.foundation.siteLifecycle.bootstrapManagedSite, { schoolId: second.schoolId, rendererKey: "obhis-v1", rendererSchemaVersion: "1", approvalEvidenceIds: [] });
    const firstDomain = await makeActiveDomain(t, first.identity, first.schoolId, "first.example.test");
    await t.mutation(internalSiteApi.functions.foundation.siteDomains.setCanonicalDomain, { schoolId: first.schoolId, domainId: firstDomain });
    await expect(t.withIdentity(second.identity).mutation(siteApi.functions.foundation.siteDomains.requestDomain, { schoolId: second.schoolId, hostname: "FIRST.example.test.", kind: "custom_domain", ownership: "school_managed_dns" })).rejects.toThrow("Hostname is already claimed");
    await expect(t.withIdentity(first.identity).mutation(siteApi.functions.foundation.siteDomains.requestDomain, { schoolId: second.schoolId, hostname: "cross-tenant.example.test", kind: "custom_domain", ownership: "school_managed_dns" })).rejects.toThrow("Not found or access denied");
    const profile = await t.run((ctx) => ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", first.schoolId)).unique());
    expect(profile).toMatchObject({ activePublicDomainCount: 1, canonicalDomainId: firstDomain, draftRevisionId: expect.any(String) });
  });

  test("publishes only approved renderer fields with exact evidence and projects an immutable revision", async () => {
    const t = convexTest(schema, modules); const school = await fixture(t); const domainId = await (async () => {
      await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.bootstrapManagedSite, { schoolId: school.schoolId, rendererKey: "obhis-v1", rendererSchemaVersion: "1", approvalEvidenceIds: [] });
      return await makeActiveDomain(t, school.identity, school.schoolId, "alpha.example.test");
    })();
    await t.mutation(internalSiteApi.functions.foundation.siteDomains.setCanonicalDomain, { schoolId: school.schoolId, domainId });
    const content = { fields: [{ fieldId: "identity.displayName", value: { kind: "text" as const, value: "Approved school" } }], routeSeo: ["home", "about", "programmes", "admissions", "school-life", "visit", "contact", "policy-index", "policy-detail"].map((routeId) => ({ routeId, title: `${routeId} title`, description: `${routeId} description` })) };
    const now = Date.now();
    const evidenceIds = await t.run(async (ctx) => {
      const ids: Id<"schoolApprovalEvidence">[] = [];
      ids.push(await ctx.db.insert("schoolApprovalEvidence", { schoolId: school.schoolId, approvalClass: "identity", subjectType: "site_field", subjectKey: "identity.displayName", evidenceReference: "test", approvedValueDigest: await hash(JSON.stringify(content.fields[0]!.value)), approvedByUserId: school.userId, approvalProvenance: "accountable_school_approver", approvedAt: now, createdAt: now }));
      for (const seo of content.routeSeo) ids.push(await ctx.db.insert("schoolApprovalEvidence", { schoolId: school.schoolId, approvalClass: "standard", subjectType: "site_route_seo", subjectKey: seo.routeId, evidenceReference: "test", approvedValueDigest: await hash(JSON.stringify({ title: seo.title, description: seo.description, shareAssetId: null })), approvedByUserId: school.userId, approvalProvenance: "accountable_school_approver", approvedAt: now, createdAt: now }));
      return ids;
    });
    const profile = await t.run((ctx) => ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", school.schoolId)).unique());
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.saveDraft, { schoolId: school.schoolId, expectedDraftVersion: 1, content, approvalEvidenceIds: evidenceIds });
    // Identity publication is sensitive: a standard publisher cannot bypass the
    // separate sensitive-public capability, even with valid evidence.
    await t.run(async (ctx) => { const grants = await ctx.db.query("schoolCapabilityGrants").withIndex("by_school_and_user", (q) => q.eq("schoolId", school.schoolId).eq("userId", school.userId)).take(20); const grant = grants.find((item) => item.capability === "site.publish.sensitive"); await ctx.db.patch(grant!._id, { revokedAt: Date.now() }); });
    await expect(t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.publishDraft, { schoolId: school.schoolId, expectedDraftVersion: 2 })).rejects.toThrow("Not found or access denied");
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: school.schoolId, userId: school.userId, capability: "site.publish.sensitive", scope: "school", grantedByUserId: school.userId, reason: "test", isBreakGlass: false, createdAt: Date.now() }));
    const publishedId = await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.publishDraft, { schoolId: school.schoolId, expectedDraftVersion: 2 });
    expect(publishedId).not.toBe(profile?.draftRevisionId);
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPublishedProjection, { hostname: "alpha.example.test" })).resolves.toMatchObject({ revision: { id: publishedId, state: "published" } });
    await t.run(async (ctx) => { const revision = await ctx.db.get(publishedId); expect(revision?.content.fields[0]?.value).toEqual(content.fields[0]?.value); });
  });

  test("rejects a field asset that lacks tenant-scoped rights evidence, approved purpose/channel, and field-use eligibility", async () => {
    const t = convexTest(schema, modules); const school = await fixture(t, "assets");
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.bootstrapManagedSite, { schoolId: school.schoolId, rendererKey: "obhis-v1", rendererSchemaVersion: "1", approvalEvidenceIds: [] });
    const domainId = await makeActiveDomain(t, school.identity, school.schoolId, "assets.example.test");
    await t.mutation(internalSiteApi.functions.foundation.siteDomains.setCanonicalDomain, { schoolId: school.schoolId, domainId });
    const now = Date.now();
    const assetId = await t.run(async (ctx) => { const storageId = await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" })); return await ctx.db.insert("schoolSiteAssets", { schoolId: school.schoolId, storageId, kind: "hero", fileName: "hero.jpg", mediaType: "image/jpeg", byteSize: 1, checksum: "checksum", decorative: false, rightsStatus: "pending", status: "draft", createdAt: now, updatedAt: now }); });
    const content = { fields: [{ fieldId: "identity.displayName", value: { kind: "text", value: "Approved school" } }, { fieldId: "home.hero.asset", value: { kind: "asset_ref", assetId } }], routeSeo: ["home", "about", "programmes", "admissions", "school-life", "visit", "contact", "policy-index", "policy-detail"].map((routeId) => ({ routeId, title: `${routeId} title`, description: `${routeId} description` })) };
    const evidenceIds = await t.run(async (ctx) => {
      const ids: Id<"schoolApprovalEvidence">[] = [];
      for (const field of content.fields) ids.push(await ctx.db.insert("schoolApprovalEvidence", { schoolId: school.schoolId, approvalClass: field.fieldId.startsWith("identity") ? "identity" : "standard", subjectType: "site_field", subjectKey: field.fieldId, evidenceReference: "test", approvedValueDigest: await hash(JSON.stringify(field.value)), approvedByUserId: school.userId, approvalProvenance: "accountable_school_approver", approvedAt: now, createdAt: now }));
      for (const seo of content.routeSeo) ids.push(await ctx.db.insert("schoolApprovalEvidence", { schoolId: school.schoolId, approvalClass: "standard", subjectType: "site_route_seo", subjectKey: seo.routeId, evidenceReference: "test", approvedValueDigest: await hash(JSON.stringify({ title: seo.title, description: seo.description, shareAssetId: null })), approvedByUserId: school.userId, approvalProvenance: "accountable_school_approver", approvedAt: now, createdAt: now }));
      return ids;
    });
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.saveDraft, { schoolId: school.schoolId, expectedDraftVersion: 1, content: content as never, approvalEvidenceIds: evidenceIds });
    await expect(t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.publishDraft, { schoolId: school.schoolId, expectedDraftVersion: 2 })).rejects.toThrow("Current accountable exact approval evidence is required for publication");
  });

  test("keeps semantic lists separate from typed OBHIS gallery asset lists and separates editors from publishers", async () => {
    const t = convexTest(schema, modules); const school = await fixture(t, "lists");
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.bootstrapManagedSite, { schoolId: school.schoolId, rendererKey: "obhis-v1", rendererSchemaVersion: "1", approvalEvidenceIds: [] });
    const malformed = { fields: [{ fieldId: "schoolLife.gallery", value: { kind: "string_list", value: ["not-an-asset"] } }], routeSeo: [] };
    await expect(t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.saveDraft, { schoolId: school.schoolId, expectedDraftVersion: 1, content: malformed as never, approvalEvidenceIds: [] })).rejects.toThrow("Content field is not allowed");
    const publisher = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { schoolId: school.schoolId, authId: "publisher-auth", authTokenIdentifier: "issuer|publisher", name: "publisher", email: "publisher@example.test", role: "teacher", createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.insert("schoolCapabilityGrants", { schoolId: school.schoolId, userId, capability: "site.publish.standard", scope: "school", grantedByUserId: school.userId, reason: "test", isBreakGlass: false, createdAt: Date.now() });
      return { subject: "publisher-auth", tokenIdentifier: "issuer|publisher", issuer: "issuer" };
    });
    const minimal = { fields: [], routeSeo: [] };
    await expect(t.withIdentity(publisher).mutation(siteApi.functions.foundation.siteLifecycle.saveDraft, { schoolId: school.schoolId, expectedDraftVersion: 1, content: minimal as never, approvalEvidenceIds: [] })).rejects.toThrow("Not found or access denied");
  });

  test("preview capabilities are server-generated, host/revision-bound, expire or revoke fail-closed, and leave audit evidence", async () => {
    const t = convexTest(schema, modules); const school = await fixture(t, "preview");
    const profileId = await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.bootstrapManagedSite, { schoolId: school.schoolId, rendererKey: "obhis-v1", rendererSchemaVersion: "1", approvalEvidenceIds: [] });
    expect(profileId).toBeTruthy();
    await makeActiveDomain(t, school.identity, school.schoolId, "preview.example.test");
    const content = { fields: [{ fieldId: "identity.displayName", value: { kind: "text", value: "Preview school" } }], routeSeo: ["home", "about", "programmes", "admissions", "school-life", "visit", "contact", "policy-index", "policy-detail"].map((routeId) => ({ routeId, title: `${routeId} title`, description: `${routeId} description` })) };
    const evidenceIds = await t.run(async (ctx) => {
      const now = Date.now(); const ids: Id<"schoolApprovalEvidence">[] = [];
      for (const field of content.fields) ids.push(await ctx.db.insert("schoolApprovalEvidence", { schoolId: school.schoolId, approvalClass: "identity", subjectType: "site_field", subjectKey: field.fieldId, evidenceReference: "test", approvedValueDigest: await hash(JSON.stringify(field.value)), approvedByUserId: school.userId, approvalProvenance: "accountable_school_approver", approvedAt: now, createdAt: now }));
      for (const seo of content.routeSeo) ids.push(await ctx.db.insert("schoolApprovalEvidence", { schoolId: school.schoolId, approvalClass: "standard", subjectType: "site_route_seo", subjectKey: seo.routeId, evidenceReference: "test", approvedValueDigest: await hash(JSON.stringify({ title: seo.title, description: seo.description, shareAssetId: null })), approvedByUserId: school.userId, approvalProvenance: "accountable_school_approver", approvedAt: now, createdAt: now }));
      return ids;
    });
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.saveDraft, { schoolId: school.schoolId, expectedDraftVersion: 1, content: content as never, approvalEvidenceIds: evidenceIds });
    const profile = await t.run((ctx) => ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", school.schoolId)).unique());
    const issued = await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.issuePreviewCapability, { schoolId: school.schoolId, revisionId: profile!.draftRevisionId!, hostname: "preview.example.test", lifetimeMs: 60_000 });
    const tokenHash = await hash(issued.previewToken);
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: "other.example.test", tokenHash })).resolves.toBeNull();
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: "preview.example.test", tokenHash })).resolves.toMatchObject({ preview: { authorized: true } });
    // Saving even identical semantic content advances the draft version and
    // actively revokes its prior capability; the projection rechecks both.
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.saveDraft, { schoolId: school.schoolId, expectedDraftVersion: 2, content: content as never, approvalEvidenceIds: evidenceIds });
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: "preview.example.test", tokenHash })).resolves.toBeNull();
    await t.run(async (ctx) => { await ctx.db.patch(issued.tokenId, { expiresAt: Date.now() - 1 }); });
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: "preview.example.test", tokenHash })).resolves.toBeNull();
    const revocable = await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.issuePreviewCapability, { schoolId: school.schoolId, revisionId: profile!.draftRevisionId!, hostname: "preview.example.test", lifetimeMs: 60_000 });
    const revocableHash = await hash(revocable.previewToken);
    await t.run(async (ctx) => { const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", "preview.example.test")).unique(); await ctx.db.patch(domain!._id, { status: "suspended" }); });
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: "preview.example.test", tokenHash: revocableHash })).resolves.toBeNull();
    await t.run(async (ctx) => { const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", "preview.example.test")).unique(); await ctx.db.patch(domain!._id, { status: "active" }); });
    await t.withIdentity(school.identity).mutation(siteApi.functions.foundation.siteLifecycle.revokePreviewCapability, { schoolId: school.schoolId, tokenId: revocable.tokenId });
    await expect(t.query(siteApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: "preview.example.test", tokenHash: revocableHash })).resolves.toBeNull();
    const events = await t.run((ctx) => ctx.db.query("schoolSiteAuditEvents").withIndex("by_school_and_created_at", (q) => q.eq("schoolId", school.schoolId)).collect());
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining(["previewed", "preview_revoked"]));
  });
});
