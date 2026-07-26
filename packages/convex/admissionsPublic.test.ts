/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const owner = { subject: "owner", tokenIdentifier: "issuer|owner", issuer: "issuer", email: "owner@example.test" };
const other = { subject: "other", tokenIdentifier: "issuer|other", issuer: "issuer", email: "other@example.test" };

async function publicFixture(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const schoolA = await ctx.db.insert("schools", { name: "School A", slug: "school-a", status: "active", createdAt: now, updatedAt: now });
    const schoolB = await ctx.db.insert("schools", { name: "School B", slug: "school-b", status: "active", createdAt: now, updatedAt: now });
    const guardian = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: owner.tokenIdentifier, betterAuthUserId: owner.subject, normalizedEmail: owner.email, emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: other.tokenIdentifier, betterAuthUserId: other.subject, normalizedEmail: other.email, emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now });
    const programme = await ctx.db.insert("admissionsProgrammes", { schoolId: schoolA, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now });
    const intake = await ctx.db.insert("admissionsIntakes", { schoolId: schoolA, programmeId: programme, slug: "entry", name: "Entry", cycleLabel: "2027", opensAt: now - 1, closesAt: now + 100000, status: "open", createdAt: now, updatedAt: now });
    const product = await ctx.db.insert("admissionsProducts", { schoolId: schoolA, intakeId: intake, slug: "application", name: "Application", slotCount: 1, status: "active", createdAt: now, updatedAt: now });
    const price = await ctx.db.insert("admissionsProductPrices", { schoolId: schoolA, productId: product, version: 1, amountMinor: 1000, currency: "NGN", refundPolicyKey: "approved", feeDisclosure: "Approved disclosure", effectiveFrom: now - 1, status: "published", createdAt: now, updatedAt: now });
    const form = await ctx.db.insert("admissionsFormVersions", { schoolId: schoolA, programmeId: programme, intakeId: intake, version: 1, schemaVersion: "1", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsFormVersions", { schoolId: schoolA, programmeId: programme, intakeId: intake, version: 2, schemaVersion: "2", status: "draft", createdAt: now, updatedAt: now });
    const field = await ctx.db.insert("admissionsFormFields", { schoolId: schoolA, formVersionId: form, fieldKey: "child_name", sectionKey: "child", kind: "text", label: "Child name", requiredMode: "required", dataClass: "child_confidential", validationJson: "{}", order: 1, status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsFormFields", { schoolId: schoolA, formVersionId: form, fieldKey: "retired", sectionKey: "child", kind: "text", label: "Retired", requiredMode: "optional", dataClass: "personal", validationJson: "{}", order: 2, status: "retired", createdAt: now, updatedAt: now });
    const requirement = await ctx.db.insert("admissionsDocumentRequirements", { schoolId: schoolA, formVersionId: form, requirementKey: "photo", category: "photo", label: "Photo", requiredMode: "optional", acceptedMimeTypes: ["image/jpeg"], maxBytes: 1000, maxFiles: 1, sensitivity: "child_confidential", purpose: "Published purpose", order: 1, createdAt: now, updatedAt: now });
    const declaration = await ctx.db.insert("admissionsDeclarationVersions", { schoolId: schoolA, programmeId: programme, version: 1, title: "Declaration", body: "Published declaration", bodyDigest: "digest", purpose: "Service", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsDeclarationVersions", { schoolId: schoolA, programmeId: programme, version: 2, title: "Draft", body: "Private draft", bodyDigest: "draft", purpose: "Private", status: "draft", createdAt: now, updatedAt: now });
    const attempt = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId: schoolA, guardianId: guardian, productId: product, priceId: price, provider: "paystack", providerMode: "test", reference: "adm_public_fixture", idempotencyKey: "public-fixture", amountMinor: 1000, currency: "NGN", feeDisclosureSnapshot: "Approved disclosure", state: "paid", createdAt: now, updatedAt: now });
    const entitlement = await ctx.db.insert("admissionsEntitlements", { schoolId: schoolA, guardianId: guardian, productId: product, intakeId: intake, sourcePurchaseAttemptId: attempt, state: "reserved", createdAt: now, updatedAt: now });
    const application = await ctx.db.insert("admissionsApplications", { schoolId: schoolA, guardianId: guardian, entitlementId: entitlement, programmeId: programme, intakeId: intake, productId: product, priceId: price, formVersionId: form, declarationVersionId: declaration, publicId: "app_public_reference", state: "changes_requested", currentRevision: 1, draftVersion: 2, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsApplicantProfiles", { schoolId: schoolA, applicationId: application, firstName: "Child", lastName: "Name", dateOfBirth: 1, normalizedName: "child name", createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsApplicationAnswers", { schoolId: schoolA, applicationId: application, formFieldId: field, fieldKey: "child_name", valueType: "text", serializedValue: "Child", dataClass: "child_confidential", valueVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: schoolA, applicationId: application, eventType: "changes_requested", visibility: "guardian", message: "Please update this item", createdAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: schoolA, applicationId: application, eventType: "internal_note", visibility: "staff", message: "Staff only", metadataJson: "private", createdAt: now });
    return { schoolA, schoolB, programme, intake, product, form, requirement, application };
  });
}

describe("B1 public admissions bootstrap", () => {
  test("denies unpublished, closed, and disabled offerings without configuration", async () => {
    const t = convexTest(schema, modules); const ids = await publicFixture(t);
    await t.run((ctx) => ctx.db.patch(ids.intake, { status: "closed", updatedAt: Date.now() }));
    await expect(t.query((api as any).functions.admissions.public.getEntry, { schoolSlug: "school-a", intakeSlug: "entry" })).resolves.toMatchObject({ availability: "closed", offering: null });
    await expect(t.query((api as any).functions.admissions.public.getPublishedConfiguration, { schoolSlug: "school-a", intakeSlug: "entry" })).resolves.toEqual({ availability: "closed", fields: [], requirements: [], declaration: null });
    await t.run(async (ctx) => { await ctx.db.patch(ids.intake, { status: "open", updatedAt: Date.now() }); await ctx.db.patch(ids.product, { status: "paused", updatedAt: Date.now() }); });
    await expect(t.query((api as any).functions.admissions.public.getEntry, { schoolSlug: "school-a", intakeSlug: "entry" })).resolves.toMatchObject({ availability: "unavailable", offering: null });
  });

  test("projects only published active configuration with no private identifiers", async () => {
    const t = convexTest(schema, modules); await publicFixture(t);
    const config = await t.query((api as any).functions.admissions.public.getPublishedConfiguration, { schoolSlug: "school-a", intakeSlug: "entry" });
    expect(config.fields.map((field: any) => field.key)).toEqual(["child_name"]);
    expect(config.requirements.map((requirement: any) => requirement.key)).toEqual(["photo"]);
    expect(config.declaration).toMatchObject({ title: "Declaration", body: "Published declaration" });
    expect(JSON.stringify(config)).not.toMatch(/_id|formVersionId|requirementId|storageId|Private draft|Retired/);
  });

  test("creates public payment attempts with server-selected provider settings", async () => {
    const t = convexTest(schema, modules); await publicFixture(t);
    const attempt = await t.withIdentity(owner).mutation((api as any).functions.admissions.public.createAttemptForOffering, { schoolSlug: "school-a", intakeSlug: "entry", idempotencyKey: "checkout-1" });
    expect(attempt).toMatchObject({ state: "created", amountMinor: 1000, currency: "NGN" });
    expect(await t.run((ctx) => ctx.db.query("admissionsPurchaseAttempts").withIndex("by_reference", (q) => q.eq("reference", attempt.reference)).unique())).toMatchObject({ provider: "paystack", providerMode: "test" });
  });

  test("isolates school slugs and requires guardian ownership for public references", async () => {
    const t = convexTest(schema, modules); await publicFixture(t);
    await expect(t.withIdentity(owner).query((api as any).functions.admissions.public.getGuardianApplication, { schoolSlug: "school-b", publicReference: "app_public_reference" })).rejects.toThrow("Not found or access denied");
    await expect(t.withIdentity(other).query((api as any).functions.admissions.public.getGuardianApplication, { schoolSlug: "school-a", publicReference: "app_public_reference" })).rejects.toThrow("Not found or access denied");
  });

  test("returns only guardian-safe application data and allowed actions", async () => {
    const t = convexTest(schema, modules); await publicFixture(t);
    const application = await t.withIdentity(owner).query((api as any).functions.admissions.public.getGuardianApplication, { schoolSlug: "school-a", publicReference: "app_public_reference" });
    expect(application.allowedActions).toEqual(["save", "upload", "submit"]);
    expect(application.messages).toEqual([expect.objectContaining({ message: "Please update this item" })]);
    expect(JSON.stringify(application)).not.toMatch(/Staff only|metadataJson|actorUserId|applicationId|storageId/);
  });
});
