import { convexTest } from "convex-test";
import { encode } from "fast-png";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import type { SiteAccessRole } from "./accessContract";

const modules = {
  "./functions/foundation/auth.ts": () => import("../foundation/auth"),
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts"))
    .map(([path, load]) => [path.replace(/^\.\.\/\.\.\//, "./"), load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts"))
    .map(([path, load]) => [path.replace("./", "./functions/sites/"), load])),
};
const identity = (name: string) => ({ subject: name, tokenIdentifier: `test|${name}`, issuer: "test" });
const content = { fields: [
  { fieldId: "school_name", value: { kind: "text" as const, value: "Synthetic School" } },
  { fieldId: "intro", value: { kind: "text" as const, value: "A fictional school." } },
], routeSeo: [] };

afterEach(() => { vi.unstubAllEnvs(); });

async function fixture() {
  vi.stubEnv("SITES_ALLOW_ACCESS_PROVISIONING", "enabled");
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Synthetic School", slug: "synthetic", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "other", status: "active", createdAt: now, updatedAt: now });
    const users: Record<string, Id<"users">> = {};
    for (const name of ["editor", "reviewer", "publisher", "operator", "admin", "parent", "other"]) {
      users[name] = await ctx.db.insert("users", {
        schoolId: name === "other" ? otherSchoolId : schoolId,
        authId: name, authTokenIdentifier: `test|${name}`, name, email: `${name}@example.test`,
        role: name === "parent" ? "parent" : name === "admin" ? "admin" : "staff",
        createdAt: now, updatedAt: now,
      });
    }
    const operatorId = await ctx.db.insert("platformAdmins", { authId: "operator", authTokenIdentifier: "test|operator", name: "Operator", email: "operator@example.test", isActive: true, createdAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, users, operatorId };
  });
  const operator = t.withIdentity(identity("operator"));
  await operator.mutation(api.functions.sites.profiles.provisionProfile, { schoolId: ids.schoolId, rendererKey: "school-core-synthetic-v1", rendererSchemaVersion: "1" });
  const request = (userId: Id<"users">, role: SiteAccessRole) => ({
    operation: "provision" as const, schoolId: ids.schoolId, confirmation: "synthetic",
    reason: "Approved synthetic site setup", userId, role, sensitivePublishing: false, expiresAt: Date.now() + 60_000,
  });
  return { t, ...ids, operator, request,
    editor: t.withIdentity(identity("editor")), reviewer: t.withIdentity(identity("reviewer")), publisher: t.withIdentity(identity("publisher")),
  };
}

describe("explicit website access setup", () => {
  test("defaults off and requires a real active operator, including internal entry points", async () => {
    const f = await fixture();
    const request = f.request(f.users.editor, "editor");
    delete process.env.SITES_ALLOW_ACCESS_PROVISIONING;
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request })).rejects.toThrow();
    vi.stubEnv("SITES_ALLOW_ACCESS_PROVISIONING", "enabled");
    await expect(f.t.action(api.functions.sites.access.configureAccess, { request })).rejects.toThrow();
    await expect(f.t.withIdentity(identity("admin")).action(api.functions.sites.access.configureAccess, { request })).rejects.toThrow();
    const { operation: _, ...args } = request;
    await expect(f.t.mutation(internal.functions.sites.access.provision, args)).rejects.toThrow();
    await f.t.run(ctx => ctx.db.patch(f.operatorId, { isActive: false }));
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("schoolCapabilityGrants").take(20))).toHaveLength(0);
  });

  test("rejects unsafe recipients, school state and setup confirmations without partial grants", async () => {
    const f = await fixture();
    for (const userId of [f.users.other, f.users.parent, f.users.operator]) {
      await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(userId, "editor") })).rejects.toThrow();
    }
    for (const change of [
      { confirmation: "other" }, { reason: "short" }, { reason: "<unsafe reason>" },
      { expiresAt: Date.now() - 1 }, { expiresAt: Number.POSITIVE_INFINITY }, { expiresAt: Date.now() + 31 * 86400_000 },
      { sensitivePublishing: true },
    ]) {
      await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: { ...f.request(f.users.editor, "editor"), ...change } })).rejects.toThrow();
    }
    await f.t.run(ctx => ctx.db.patch(f.users.editor, { isArchived: true }));
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "editor") })).rejects.toThrow();
    await f.t.run(ctx => ctx.db.patch(f.users.editor, { isArchived: false, authTokenIdentifier: undefined }));
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "editor") })).rejects.toThrow();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.users.editor, { authTokenIdentifier: "test|editor" });
      await ctx.db.patch(f.schoolId, { status: "suspended" });
    });
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "editor") })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("schoolCapabilityGrants").take(20))).toHaveLength(0);
  });

  test("creates exact expiring packages with truthful provenance and no renewal or self-escalation", async () => {
    const f = await fixture();
    for (const role of ["editor", "reviewer", "publisher"] as const) {
      await f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users[role], role) });
    }
    const grants = await f.t.run(ctx => ctx.db.query("schoolCapabilityGrants").take(20));
    expect(grants).toHaveLength(9);
    for (const grant of grants) {
      expect(grant).toMatchObject({ scope: "school", provisioningSource: "site_operator", grantedByPlatformAdminId: f.operatorId, isBreakGlass: true });
      expect(grant).not.toHaveProperty("grantedByUserId");
      expect(grant.expiresAt).toBeGreaterThan(Date.now());
      expect(["grants.manage", "site.domain.request", "site.revert", "site.publish.sensitive"]).not.toContain(grant.capability);
      expect(grant.capability.startsWith("admissions.")).toBe(false);
    }
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "editor") })).rejects.toThrow();
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.reviewer, "publisher") })).rejects.toThrow();
    await expect(f.editor.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "publisher") })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("schoolCapabilityGrants").take(20))).toEqual(grants);
    const audit = await f.t.run(ctx => ctx.db.query("schoolSiteAuditEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(20));
    expect(audit.filter(row => row.eventType === "grant_changed")).toHaveLength(3);
  });

  test("domain requester can request exact same-school hosts without content or provider privileges", async () => {
    const f = await fixture();
    const request = f.request(f.users.admin, "domain_requester");
    await expect(f.operator.action(api.functions.sites.access.configureAccess, {
      request: { ...request, sensitivePublishing: true },
    })).rejects.toThrow();
    await f.operator.action(api.functions.sites.access.configureAccess, { request });
    const requester = f.t.withIdentity(identity("admin"));
    const viewer = await requester.query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: f.schoolId });
    expect(viewer.capabilities.map(grant => grant.capability)).toEqual(["site.domain.request"]);
    const domain = await requester.mutation(api.functions.sites.domains.requestDomain, {
      schoolId: f.schoolId, hostname: "canonical.synthetic.edu", canonicalIntent: "canonical",
    });
    expect(domain.hostname).toBe("canonical.synthetic.edu");
    const view = await requester.action(api.functions.sites.management.schoolView, { schoolId: f.schoolId });
    expect(view).toMatchObject({ canEdit: false, canRequestDomain: true, draft: null });
    expect(view.domains).toHaveLength(1);
    await expect(requester.mutation(api.functions.sites.domains.requestDomain, {
      schoolId: f.otherSchoolId, hostname: "other.synthetic.edu", canonicalIntent: "canonical",
    })).rejects.toThrow();
    await expect(requester.mutation(api.functions.sites.content.saveDraft, {
      schoolId: f.schoolId, content, expectedDraftVersion: 0,
    })).rejects.toThrow();
    await expect(requester.action(api.functions.sites.evidence.getFieldCandidate, {
      schoolId: f.schoolId, fieldId: "school_name",
    })).rejects.toThrow();
    await expect(requester.mutation(api.functions.sites.content.publishDraft, {
      schoolId: f.schoolId, expectedDraftVersion: 0,
    })).rejects.toThrow();
    await expect(requester.mutation(api.functions.sites.domains.activateDomain, {
      domainId: domain.domainId,
    })).rejects.toThrow();
  });

  test("rejects duplicate school identities instead of treating two rows as independent reviewers", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const user = await ctx.db.get(f.users.editor);
      if (!user) throw new Error("Missing fixture editor");
      await ctx.db.insert("users", { schoolId: f.schoolId, authId: user.authId, authTokenIdentifier: user.authTokenIdentifier,
        name: "Duplicate editor", email: "duplicate@example.test", role: "staff", createdAt: Date.now(), updatedAt: Date.now() });
    });
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "reviewer") })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("schoolCapabilityGrants").take(20))).toHaveLength(0);
  });

  test("editor uploads and saves; independent reviewer approves; sensitive publication requires explicit opt-in", async () => {
    const f = await fixture();
    for (const role of ["editor", "reviewer", "publisher"] as const) {
      await f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users[role], role) });
    }
    const pixel = new Uint8Array(encode({ width: 1, height: 1, channels: 4, depth: 8, data: new Uint8Array([10, 20, 30, 255]) }));
    const upload = await f.editor.fetch("/sites/asset-upload", { method: "POST", headers: {
      "content-length": String(pixel.length), "content-type": "image/png", "x-site-school": f.schoolId,
      "x-site-kind": "hero", "x-site-filename": "synthetic.png", "x-site-alt": "Fictional test pixel",
    }, body: pixel });
    expect(upload.status).toBe(201);
    const asset = await f.t.run(async ctx => {
      const rows = await ctx.db.query("schoolSiteAssets").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(2);
      if (rows.length !== 1) throw new Error("Expected one fixture upload");
      return rows[0];
    });
    const draft = { ...content, fields: [...content.fields, { fieldId: "hero_image", value: { kind: "asset_ref" as const, assetId: asset._id } }] };
    await f.editor.mutation(api.functions.sites.content.saveDraft, { schoolId: f.schoolId, content: draft, expectedDraftVersion: 0 });
    await expect(f.editor.action(api.functions.sites.evidence.getFieldCandidate, { schoolId: f.schoolId, fieldId: "school_name" })).rejects.toThrow();
    const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate, { schoolId: f.schoolId, fieldId: "school_name" });
    const base = { schoolId: f.schoolId, evidenceReference: "Independently reviewed synthetic source", expiresAt: Date.now() + 120_000, confirmed: true };
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate, { ...base, candidate: { kind: "field", fieldId: "school_name", expectedDigest: candidate.digest } });
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate, { ...base, candidate: { kind: "asset_rights", assetId: asset._id, expectedChecksum: asset.checksum } });
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate, { ...base, candidate: { kind: "asset_child_applicability", assetId: asset._id, expectedChecksum: asset.checksum, classification: "no_children" } });
    const publishArgs = { schoolId: f.schoolId, expectedDraftVersion: 1 };
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft, publishArgs)).rejects.toThrow();
    await expect(f.reviewer.mutation(api.functions.sites.content.publishDraft, publishArgs)).rejects.toThrow();
    await expect(f.publisher.mutation(api.functions.sites.content.publishDraft, publishArgs)).rejects.toThrow();
    const publisherGrants = await f.t.run(ctx => ctx.db.query("schoolCapabilityGrants").withIndex("by_school_and_user", q => q.eq("schoolId", f.schoolId).eq("userId", f.users.publisher)).take(20));
    for (const grant of publisherGrants) {
      await f.operator.action(api.functions.sites.access.configureAccess, { request: { operation: "revoke", schoolId: f.schoolId, confirmation: "synthetic", reason: "Replace approved publisher package", grantId: grant._id } });
    }
    await f.operator.action(api.functions.sites.access.configureAccess, { request: { ...f.request(f.users.publisher, "publisher"), sensitivePublishing: true } });
    const published = await f.publisher.mutation(api.functions.sites.content.publishDraft, publishArgs);
    expect(await f.t.run(ctx => ctx.db.get(published.publishedId))).toMatchObject({ state: "published", publishedByUserId: f.users.publisher });
  });

  test("expiry and exact operational revocation close access without altering legacy grants", async () => {
    const f = await fixture();
    const result = await f.operator.action(api.functions.sites.access.configureAccess, { request: f.request(f.users.editor, "editor") });
    if (!("grantIds" in result)) throw new Error("Expected provision result");
    const legacyId = await f.t.run(ctx => ctx.db.insert("schoolCapabilityGrants", {
      schoolId: f.schoolId, userId: f.users.other, capability: "audit.view", scope: "school",
      grantedByUserId: f.users.reviewer, reason: "Existing synthetic grant", isBreakGlass: false, createdAt: Date.now(),
    }));
    const revoke = (grantId: Id<"schoolCapabilityGrants">) => ({ operation: "revoke" as const, schoolId: f.schoolId, confirmation: "synthetic", reason: "Approved synthetic access removal", grantId });
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: revoke(legacyId) })).rejects.toThrow();
    await expect(f.operator.action(api.functions.sites.access.configureAccess, { request: { ...revoke(result.grantIds[0]), schoolId: f.otherSchoolId, confirmation: "other" } })).rejects.toThrow();
    const editGrant = await f.t.run(async ctx => {
      const grants = await Promise.all(result.grantIds.map(id => ctx.db.get(id)));
      return grants.find(grant => grant?.capability === "settings.manage");
    });
    if (!editGrant) throw new Error("Missing editor grant");
    await f.t.run(ctx => ctx.db.patch(editGrant._id, { expiresAt: Date.now() - 1 }));
    await expect(f.editor.mutation(api.functions.sites.content.saveDraft, { schoolId: f.schoolId, content, expectedDraftVersion: 0 })).rejects.toThrow();
    expect(await f.operator.action(api.functions.sites.access.configureAccess, { request: revoke(editGrant._id) })).toEqual({ revoked: true });
    const revoked = await f.t.run(ctx => ctx.db.get(editGrant._id));
    expect(revoked).toMatchObject({ grantedByPlatformAdminId: f.operatorId, revokedByPlatformAdminId: f.operatorId });
    expect(await f.operator.action(api.functions.sites.access.configureAccess, { request: revoke(editGrant._id) })).toEqual({ revoked: false });
    expect(await f.t.run(ctx => ctx.db.get(editGrant._id))).toEqual(revoked);
    expect(await f.t.run(ctx => ctx.db.get(legacyId))).not.toHaveProperty("revokedAt");
  });
});
