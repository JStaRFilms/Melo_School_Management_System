/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const guardianIdentity = { subject: "guardian", tokenIdentifier: "issuer|guardian", issuer: "issuer", email: "guardian@example.test" };

async function fixture(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const schoolA = await ctx.db.insert("schools", { name: "A", slug: "a", status: "active", createdAt: now, updatedAt: now });
    const schoolB = await ctx.db.insert("schools", { name: "B", slug: "b", status: "active", createdAt: now, updatedAt: now });
    const guardian = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: guardianIdentity.tokenIdentifier, betterAuthUserId: guardianIdentity.subject, normalizedEmail: guardianIdentity.email, emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now });
    const programme = await ctx.db.insert("admissionsProgrammes", { schoolId: schoolA, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now });
    const intake = await ctx.db.insert("admissionsIntakes", { schoolId: schoolA, programmeId: programme, slug: "entry", name: "Entry", cycleLabel: "2027", opensAt: now - 1, closesAt: now + 100000, status: "open", createdAt: now, updatedAt: now });
    const form = await ctx.db.insert("admissionsFormVersions", { schoolId: schoolA, programmeId: programme, intakeId: intake, version: 1, schemaVersion: "1", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    const declaration = await ctx.db.insert("admissionsDeclarationVersions", { schoolId: schoolA, programmeId: programme, version: 1, title: "Declaration", body: "Text", bodyDigest: "digest", purpose: "service", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    const product = await ctx.db.insert("admissionsProducts", { schoolId: schoolA, intakeId: intake, slug: "application", name: "Application", slotCount: 1, status: "active", createdAt: now, updatedAt: now });
    const price = await ctx.db.insert("admissionsProductPrices", { schoolId: schoolA, productId: product, version: 1, amountMinor: 1000, currency: "NGN", refundPolicyKey: "approved", feeDisclosure: "approved", effectiveFrom: now - 1, status: "published", createdAt: now, updatedAt: now });
    const attempt = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId: schoolA, guardianId: guardian, productId: product, priceId: price, provider: "paystack", providerMode: "test", reference: "adm_test", idempotencyKey: "fixture", amountMinor: 1000, currency: "NGN", feeDisclosureSnapshot: "approved", state: "verification_pending", createdAt: now, updatedAt: now });
    const event = await ctx.db.insert("admissionsPaymentEvents", { schoolId: schoolA, purchaseAttemptId: attempt, provider: "paystack", providerMode: "test", providerEventId: "evt", eventType: "charge.success", bodyDigest: "digest", signatureValid: true, processingStatus: "verified", receivedAt: now, createdAt: now, updatedAt: now });
    return { schoolA, schoolB, guardian, programme, intake, form, declaration, product, price, attempt, event };
  });
}

describe("B1 admissions domain", () => {
  test("payment replay creates one entitlement and no student", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const first = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const second = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    expect(first.entitlementId).toBe(second.entitlementId); expect(second.replayed).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("students").take(1))).toEqual([]);
  });

  test("one entitlement produces at most one application and snapshot remains immutable", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const create = (api as any).functions.admissions.applications.createOrResume;
    const first = await t.withIdentity(guardianIdentity).mutation(create, { entitlementId });
    const second = await t.withIdentity(guardianIdentity).mutation(create, { entitlementId }); expect(second.applicationId).toBe(first.applicationId);
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: first.applicationId, expectedVersion: 1, firstName: "Child", lastName: "One", dateOfBirth: 1 });
    await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: first.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: true });
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: first.applicationId, expectedVersion: version + 1, firstName: "Changed", lastName: "One", dateOfBirth: 1 })).rejects.toThrow("APPLICATION_LOCKED");
    const snapshots = await t.run((ctx) => ctx.db.query("admissionsSubmissionSnapshots").withIndex("by_application_and_revision", (q) => q.eq("applicationId", first.applicationId)).take(2)); expect(snapshots).toHaveLength(1);
  });

  test("cross-tenant staff and document access are denied", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    await expect(t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff", issuer: "issuer" }).query((api as any).functions.admissions.staff.listQueue, { schoolId: ids.schoolB, intakeId: ids.intake })).resolves.toEqual([]);
    await expect(t.withIdentity({ subject: "other", tokenIdentifier: "issuer|other", issuer: "issuer", email: "other@example.test" }).mutation((api as any).functions.admissions.documents.getOwnAccess, { documentKey: "missing", action: "view" })).rejects.toThrow("Verification required");
  });

  test("document ownership denies a different verified guardian", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "image/jpeg" })));
    const documentId = await t.run((ctx) => ctx.db.insert("admissionsDocuments", { schoolId: ids.schoolA, applicationId: application.applicationId, category: "photo", documentKey: "doc_private", storageId, fileName: "private.jpg", mimeType: "image/jpeg", byteSize: 1, sha256: "digest", version: 1, state: "uploaded", sensitivity: "child_confidential", uploadedByGuardianId: ids.guardian, retentionHold: false, createdAt: Date.now(), updatedAt: Date.now() }));
    void documentId;
    const other = { subject: "other", tokenIdentifier: "issuer|other", issuer: "issuer", email: "other@example.test" };
    await t.run((ctx) => ctx.db.insert("admissionsGuardians", { authTokenIdentifier: other.tokenIdentifier, betterAuthUserId: other.subject, normalizedEmail: other.email, emailVerifiedAt: Date.now(), status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(other).mutation((api as any).functions.admissions.documents.getOwnAccess, { documentKey: "doc_private", action: "view" })).resolves.toEqual({ status: "unavailable", documentKey: "doc_private" });
  });

  test("accepted conversion is replay-safe and creates one canonical student", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Child", lastName: "One", dateOfBirth: 1 });
    await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: application.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: true });
    const staff = { subject: "staff", tokenIdentifier: "issuer|staff", issuer: "issuer" };
    const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: staff.subject, authTokenIdentifier: staff.tokenIdentifier, name: "Staff", email: "staff@example.test", role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run(async (ctx) => { for (const capability of ["decisions.record", "conversions.execute"] as const) await ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability, scope: "school", grantedByUserId: user, reason: "test", isBreakGlass: false, createdAt: Date.now() }); });
    await t.withIdentity(staff).mutation((api as any).functions.admissions.staff.recordDecision, { applicationId: application.applicationId, state: "accepted", reasonCode: "approved", guardianMessage: "accepted" });
    const classId = await t.run((ctx) => ctx.db.insert("classes", { schoolId: ids.schoolA, name: "P1", level: "P1", createdAt: Date.now(), updatedAt: Date.now() }));
    const args = { applicationId: application.applicationId, classId, admissionNumber: "ADM-1", idempotencyKey: "convert-1" };
    const first = await t.withIdentity(staff).mutation((api as any).functions.admissions.conversions.executeAcceptedConversion, args);
    const replay = await t.withIdentity(staff).mutation((api as any).functions.admissions.conversions.executeAcceptedConversion, args);
    expect(replay.replayed).toBe(true); expect(replay.studentId).toBe(first.studentId);
    expect(await t.run((ctx) => ctx.db.query("students").withIndex("by_school_and_admission_number", (q) => q.eq("schoolId", ids.schoolA).eq("admissionNumber", "ADM-1")).take(2))).toHaveLength(1);
  });

  test("submission requires the displayed declaration to be affirmatively accepted", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Child", lastName: "One", dateOfBirth: 1 });
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: application.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: false })).rejects.toThrow("DECLARATION_ACCEPTANCE_REQUIRED");
  });

  test("an application keeps the paid attempt price after a later price change", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    await t.run((ctx) => ctx.db.insert("admissionsProductPrices", { schoolId: ids.schoolA, productId: ids.product, version: 2, amountMinor: 2000, currency: "NGN", refundPolicyKey: "approved", feeDisclosure: "new", effectiveFrom: Date.now(), status: "published", createdAt: Date.now(), updatedAt: Date.now() }));
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    expect(await t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ priceId: ids.price });
  });

  test("illegal decision state is rejected", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: "staff", authTokenIdentifier: "issuer|staff", name: "Staff", email: "staff@example.test", role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability: "decisions.record", scope: "school", grantedByUserId: user, reason: "test", isBreakGlass: false, createdAt: Date.now() }));
    const entitlement = await t.run((ctx) => ctx.db.insert("admissionsEntitlements", { schoolId: ids.schoolA, guardianId: ids.guardian, productId: ids.product, intakeId: ids.intake, sourcePurchaseAttemptId: ids.attempt, state: "reserved", createdAt: Date.now(), updatedAt: Date.now() }));
    const application = await t.run((ctx) => ctx.db.insert("admissionsApplications", { schoolId: ids.schoolA, guardianId: ids.guardian, entitlementId: entitlement, programmeId: ids.programme, intakeId: ids.intake, productId: ids.product, priceId: ids.price, formVersionId: ids.form, declarationVersionId: ids.declaration, publicId: "app", state: "draft", currentRevision: 0, draftVersion: 1, createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff", issuer: "issuer" }).mutation((api as any).functions.admissions.staff.recordDecision, { applicationId: application, state: "accepted", reasonCode: "approved", guardianMessage: "message" })).rejects.toThrow("Invalid decision transition");
  });
});
