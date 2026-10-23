import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../../schema";
import type { Doc } from "../../_generated/dataModel";
import { publicAtTime, assetAtTime } from "./public";
import { approvedAsset, assetSubject, contentCanonical, fieldValueDigest, sha256 } from "./shared";
import { observeReads, queryHandler } from "../academic/__tests__/readMetrics";

const modules = Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts"))
  .map(([path, load]) => [path.replace(/^\.\.\/\.\.\//, "./"), load]));
const readPage = queryHandler(publicAtTime);
const readAsset = queryHandler(assetAtTime);
const now = 1_800_000_000_000;
const projectId = "prj_1234567890123456";
const hostname = "canonical.synthetic.edu";
const expiresAt = now + 86_400_000;
afterEach(() => { vi.unstubAllEnvs(); });
const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

async function fixture() {
  vi.stubEnv("SITES_VERCEL_PROJECT_ID", projectId);
  vi.stubEnv("SITES_VERCEL_API_TOKEN", "synthetic-provider-token-long-enough");
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Synthetic School", slug: "site-read-test", status: "active", createdAt: now, updatedAt: now });
    const foreignId = await ctx.db.insert("schools", { name: "Foreign", slug: "site-read-foreign", status: "active", createdAt: now, updatedAt: now });
    const publisher = await ctx.db.insert("users", { schoolId, name: "Publisher", email: "publisher@example.test", authId: "publisher", role: "staff", createdAt: now, updatedAt: now });
    const reviewer = await ctx.db.insert("users", { schoolId, name: "Reviewer", email: "reviewer@example.test", authId: "reviewer", role: "staff", createdAt: now, updatedAt: now });
    const evidence = { schoolId, approvedByUserId: reviewer, approvedAt: now, createdAt: now, expiresAt };
    const bytes = new TextEncoder().encode("synthetic image bytes");
    const storageId = await ctx.storage.store(new Blob([bytes], { type: "image/png" }));
    const assets = [];
    for (const kind of ["hero", "social_share", "social_share"] as const) {
      const assetId = await ctx.db.insert("schoolSiteAssets", { schoolId, storageId, kind, fileName: "synthetic.png", mediaType: "image/png", byteSize: bytes.length, checksum: await sha256(bytes), decorative: true,
        rightsStatus: "approved", rightsExpiresAt: expiresAt, childApplicability: "contains_children", uploadProvenance: "website_direct_upload_v1", status: "published", createdAt: now, updatedAt: now });
      const asset = await ctx.db.get(assetId);
      if (!asset) throw Error("Missing synthetic asset");
      const subjectKey = assetSubject(asset);
      const rightsId = await ctx.db.insert("schoolApprovalEvidence", { ...evidence, subjectKey, subjectType: "site_asset_rights", approvalClass: "privacy", evidenceReference: "Synthetic rights" });
      const classificationId = await ctx.db.insert("schoolApprovalEvidence", { ...evidence, subjectKey, subjectType: "site_asset_child_applicability", approvalClass: "privacy", evidenceReference: "contains_children: Synthetic classification" });
      const consentId = await ctx.db.insert("schoolApprovalEvidence", { ...evidence, subjectKey, subjectType: "site_asset_child_consent", approvalClass: "privacy", evidenceReference: "Synthetic consent" });
      await ctx.db.patch(assetId, { approvalEvidenceId: rightsId, childConsentEvidenceId: consentId });
      assets.push({ assetId, kind, rightsId, classificationId, consentId });
    }
    const content = { fields: [
      { fieldId: "school_name", value: { kind: "text", value: "Synthetic School" } },
      { fieldId: "intro", value: { kind: "text", value: "Hello" } },
      { fieldId: "hero_image", value: { kind: "asset_ref", assetId: assets[0].assetId } },
    ], routeSeo: [
      { routeId: "home", title: "Synthetic School", shareAssetId: assets[1].assetId },
      { routeId: "about", shareAssetId: assets[2].assetId },
    ] } satisfies Doc<"schoolSiteRevisions">["content"];
    const digest = await sha256(fieldValueDigest(content.fields[0].value));
    const identityId = await ctx.db.insert("schoolApprovalEvidence", { ...evidence, subjectKey: `v1:school-core-synthetic-v1:1:school_name:${digest}`, subjectType: "site_content", approvalClass: "identity", evidenceReference: "Synthetic identity" });
    const revisionId = await ctx.db.insert("schoolSiteRevisions", { schoolId, revisionNumber: 1, state: "published", rendererKey: "school-core-synthetic-v1", rendererSchemaVersion: "1", content, contentDigest: await sha256(contentCanonical(content)), approvalEvidenceIds: [identityId], expectedDraftVersion: 1, publishedAt: now, publishedByUserId: publisher, createdAt: now, updatedAt: now });
    const domainId = await ctx.db.insert("schoolDomains", { schoolId, hostname, surface: "public", kind: "custom_domain", status: "active", canonicalIntent: "canonical", ownership: "school_managed_dns", verificationExpiresAt: expiresAt, verificationGeneration: 1, verificationTokenHash: "synthetic-hash",
      ownershipObservation: { generation: 1, tokenHash: "synthetic-hash", observedAt: now },
      providerRoutingObservation: { generation: 1, observedAt: now, projectId, projectDomainVerified: true, configuredBy: "CNAME", misconfigured: false },
      tlsObservation: { generation: 1, observedAt: now, leafFingerprintSha256: "a".repeat(64), leafNotAfter: now + 172_800_000, deploymentProbeMatched: true }, createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolSiteProfiles", { schoolId, mode: "managed", status: "published", rendererKey: "school-core-synthetic-v1", rendererSchemaVersion: "1", publishedRevisionId: revisionId, canonicalDomainId: domainId, createdAt: now, updatedAt: now });
    return { schoolId, foreignId, publisher, assets, domainId };
  });
  return { t, ...ids };
}

it("reuses publication-validated assets without changing public DTOs or the asset contract", async () => {
  const f = await fixture();
  const pageArgs = { hostname, routeId: "home", now };
  const assetArgs = { hostname, assetId: f.assets[0].assetId, now };
  const page = async (legacy: boolean) => f.t.run(async (ctx) => {
    const observed = observeReads(ctx.db);
    const reader = { ...ctx, db: observed.db };
    const result = await readPage(reader, pageArgs);
    // Reproduce the old post-validation rereads, rather than pretending to run an old binary.
    if (legacy) for (const asset of f.assets) await approvedAsset(reader, f.schoolId, asset.assetId, asset.kind, now, f.publisher);
    return { result, metrics: observed.metrics };
  });
  const before = await page(true);
  const after = await page(false);
  expect(after.result).toEqual(before.result);
  expect(after.result.status).toBe("available");
  expect(before.metrics.documents - after.metrics.documents).toBe(15);
  expect(JSON.stringify(after.result)).not.toMatch(/storageId|evidenceReference|approvedByUserId/);
  const access = async (legacy: boolean) => f.t.run(async (ctx) => {
    const observed = observeReads(ctx.db);
    const reader = { ...ctx, db: observed.db };
    const result = await readAsset(reader, assetArgs);
    if (legacy) await approvedAsset(reader, f.schoolId, f.assets[0].assetId, "hero", now, f.publisher);
    return { result, metrics: observed.metrics };
  });
  const assetBefore = await access(true);
  const assetAfter = await access(false);
  expect(assetAfter.result).toEqual(assetBefore.result);
  expect(assetAfter.result).toHaveProperty("mediaType", "image/png");
  expect(assetBefore.metrics.documents - assetAfter.metrics.documents).toBe(5);
  console.info("sites synthetic legacy-equivalent rereads and JSON-byte proxies", JSON.stringify({
    page: { before: before.metrics, after: after.metrics, responseBytes: jsonBytes(after.result) },
    asset: { before: assetBefore.metrics, after: assetAfter.metrics, responseBytes: jsonBytes(assetAfter.result) },
  }));
});

it("rechecks revocation, consent, expiry, tenant ownership, kind and domain freshness on subsequent calls", async () => {
  const f = await fixture();
  const asset = f.assets[0];
  const check = (at = now) => f.t.run(async (ctx) => ({
    page: await readPage(ctx, { hostname, routeId: "home", now: at }),
    asset: await readAsset(ctx, { hostname, assetId: asset.assetId, now: at }),
  }));
  expect((await check()).page.status).toBe("available");
  const denied = { page: { status: "unavailable" }, asset: null };
  for (const evidenceId of [asset.rightsId, asset.classificationId, asset.consentId]) {
    await f.t.run((ctx) => ctx.db.patch(evidenceId, { revokedAt: now }));
    expect(await check()).toEqual(denied);
    await f.t.run((ctx) => ctx.db.patch(evidenceId, { revokedAt: undefined }));
  }
  await f.t.run((ctx) => ctx.db.patch(asset.rightsId, { expiresAt: now + 1 }));
  await f.t.run((ctx) => ctx.db.patch(asset.assetId, { rightsExpiresAt: now + 1 }));
  expect(await check(now + 2)).toEqual(denied);
  await f.t.run((ctx) => ctx.db.patch(asset.rightsId, { expiresAt }));
  await f.t.run((ctx) => ctx.db.patch(asset.assetId, { rightsExpiresAt: expiresAt, schoolId: f.foreignId }));
  expect(await check()).toEqual(denied);
  await f.t.run((ctx) => ctx.db.patch(asset.assetId, { schoolId: f.schoolId, kind: "logo" }));
  expect(await check()).toEqual(denied);
  await f.t.run((ctx) => ctx.db.patch(asset.assetId, { kind: "hero" }));
  expect((await check()).page.status).toBe("available");
  expect(await check(now + 15 * 60_000)).toEqual(denied);
  await f.t.run((ctx) => ctx.db.patch(f.domainId, { status: "suspended" }));
  expect(await check()).toEqual(denied);
});
