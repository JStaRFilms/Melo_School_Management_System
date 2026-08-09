/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { subject: "campaign-editor", tokenIdentifier: "issuer|campaign-editor", issuer: "issuer" };

async function fixture(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Campaign School", slug: "campaign-school", status: "active", createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Campaign Editor", email: "editor@example.test", role: "admin", createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.catalogue.manage", scope: "school", grantedByUserId: userId, reason: "campaign setup", isBreakGlass: false, createdAt: now });
    return { schoolId, userId };
  });
}

function configuration(now: number) {
  return {
    programme: { slug: "primary-2027", name: "Primary 2027", description: "Primary entry" },
    intake: { slug: "primary-2027", name: "Primary 2027", cycleLabel: "2027", opensAt: now + 1_000, closesAt: now + 10_000 },
    product: { slug: "primary-2027", name: "Application slot" },
    form: { schemaVersion: "1" },
    declaration: { title: "Guardian declaration", body: "I confirm this application is accurate.", purpose: "service" },
    fields: [{ fieldKey: "support-needs", sectionKey: "support", kind: "textarea", label: "Support needs", requiredMode: "optional" as const, dataClass: "personal" as const, validationJson: "{}", order: 0 }],
    requirements: [{ requirementKey: "birth-cert", category: "identity", label: "Birth certificate", requiredMode: "required" as const, acceptedMimeTypes: ["application/pdf"], maxBytes: 1_000_000, maxFiles: 1, sensitivity: "child_confidential" as const, purpose: "Identity confirmation", order: 0 }],
  };
}

describe("atomic admissions campaign settings", () => {
  test("creates a complete draft once and durably replays the same operation", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const args = { schoolId, operationKey: "campaign-create-1", configuration: configuration(Date.now()) };
    const first = await t.withIdentity(identity).mutation(api.functions.admissions.settings.createDraftCampaign, args);
    const replay = await t.withIdentity(identity).mutation(api.functions.admissions.settings.createDraftCampaign, args);
    expect(first).toMatchObject({ published: false, replayed: false });
    expect(replay).toMatchObject({ ...first, replayed: true });
    expect(await t.run((ctx) => ctx.db.query("admissionsProgrammes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2))).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("admissionsIntakes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2))).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("admissionsProducts").withIndex("by_school_and_intake", (q) => q.eq("schoolId", schoolId).eq("intakeId", first.intakeId)).take(2))).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("admissionsCampaignOperations").withIndex("by_school_and_intake", (q) => q.eq("schoolId", schoolId).eq("intakeId", first.intakeId)).take(2))).toHaveLength(1);
  });

  test("rejects invalid configuration before any campaign row is persisted", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const invalid = configuration(Date.now()); invalid.fields[0].kind = "script";
    await expect(t.withIdentity(identity).mutation(api.functions.admissions.settings.createDraftCampaign, { schoolId, operationKey: "campaign-invalid", configuration: invalid })).rejects.toThrow("Invalid field");
    expect(await t.run((ctx) => ctx.db.query("admissionsProgrammes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(1))).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("admissionsCampaignOperations").take(1))).toEqual([]);
  });

  test("requires publication capability and replaces published evidence with new immutable versions", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); const created = await t.withIdentity(identity).mutation(api.functions.admissions.settings.createDraftCampaign, { schoolId, operationKey: "campaign-draft", configuration: configuration(Date.now()) });
    await expect(t.withIdentity(identity).mutation(api.functions.admissions.settings.replaceDraftCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "campaign-publish-denied", configuration: configuration(Date.now()), publish: true })).rejects.toThrow("Not found or access denied");
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "campaign publication", isBreakGlass: false, createdAt: Date.now() }));
    const published = await t.withIdentity(identity).mutation(api.functions.admissions.settings.replaceDraftCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "campaign-publish", configuration: configuration(Date.now()), publish: true });
    expect(published).toMatchObject({ published: true, replayed: false });
    expect(await t.run((ctx) => ctx.db.get(created.formVersionId))).toMatchObject({ status: "draft" });
    expect(await t.run((ctx) => ctx.db.get(published.formVersionId))).toMatchObject({ status: "published" });
    expect(await t.withIdentity(identity).query(api.functions.admissions.settings.listCampaignRecovery, { schoolId })).toEqual([]);
  });
});
