import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { internal } from "../../../_generated/api";
import { seedReviewedTenantOperatorWithCapabilities } from "../../academic/__tests__/securityFixtures";
import { ADMISSIONS_UPLOAD_OPERATION, DAY_MS, sha256Hex } from "../shared";
import { processConversionRef, processRetentionCleanupRef } from "../refs";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const conversionRef = makeFunctionReference<"mutation">("functions/admissions/conversion:executeAcceptedConversion");
const setPolicyRef = makeFunctionReference<"mutation">("functions/admissions/retention:setPolicy");
const getPolicyRef = makeFunctionReference<"query">("functions/admissions/retention:getPolicy");
const archiveRef = makeFunctionReference<"mutation">("functions/admissions/retention:archiveDocumentManually");
const deleteRef = makeFunctionReference<"mutation">("functions/admissions/retention:deleteDocumentManually");

type BaseIds = {
  schoolId: Id<"schools">;
  otherSchoolId: Id<"schools">;
  classId: Id<"classes">;
  guardianId: Id<"admissionsGuardians">;
  applicationId: Id<"admissionsApplications">;
  photoDocumentId: Id<"admissionsDocuments">;
  photoDocumentKey: string;
};

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx): Promise<BaseIds> => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Conversion School", slug: "conversion-school", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "conversion-other", status: "active", createdAt: now, updatedAt: now });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "primary", createdAt: now, updatedAt: now });
    const operator = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|conversion-staff", ["enrollment.intakes.manage", "enrollment.decisions.record", "enrollment.admissions.override_number"]);
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|conversion-limited", ["enrollment.intakes.manage", "enrollment.decisions.record"]);
    const guardianId = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: "test|conversion-guardian", betterAuthUserId: "conversion-guardian", normalizedEmail: "conversion.guardian@example.test", emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now });
    const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now });
    const intakeId = await ctx.db.insert("admissionsIntakes", { schoolId, programmeId, slug: "2026", name: "2026", cycleLabel: "2026", targetClassId: classId, opensAt: now - 1, closesAt: now + 100_000, status: "open", createdAt: now, updatedAt: now });
    const formVersionId = await ctx.db.insert("admissionsFormVersions", { schoolId, programmeId, intakeId, version: 1, schemaVersion: "1", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    const declarationVersionId = await ctx.db.insert("admissionsDeclarationVersions", { schoolId, programmeId, version: 1, title: "Declaration", body: "Body", bodyDigest: "digest", purpose: "attestation", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    const productId = await ctx.db.insert("admissionsProducts", { schoolId, intakeId, slug: "slot", name: "Slot", slotCount: 1, status: "active", createdAt: now, updatedAt: now });
    const priceId = await ctx.db.insert("admissionsProductPrices", { schoolId, productId, version: 1, amountMinor: 1, currency: "NGN", refundPolicyKey: "none", feeDisclosure: "fee", effectiveFrom: now - 1, status: "published", createdAt: now, updatedAt: now });
    const purchaseId = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId, guardianId, productId, priceId, provider: "paystack", providerMode: "test", reference: "adm_conversion", idempotencyKey: "conversion", amountMinor: 1, currency: "NGN", feeDisclosureSnapshot: "fee", state: "paid", verifiedAt: now, createdAt: now, updatedAt: now });
    const entitlementId = await ctx.db.insert("admissionsEntitlements", { schoolId, guardianId, productId, intakeId, sourcePurchaseAttemptId: purchaseId, state: "consumed", consumedAt: now, createdAt: now, updatedAt: now });
    const applicationId = await ctx.db.insert("admissionsApplications", { schoolId, guardianId, entitlementId, programmeId, intakeId, productId, priceId, formVersionId, declarationVersionId, publicId: "conversion-app", state: "accepted", currentRevision: 1, draftVersion: 1, terminalOutcomeAt: now, createdAt: now, updatedAt: now });
    await ctx.db.patch(entitlementId, { applicationId });
    await ctx.db.insert("admissionsApplicantProfiles", { schoolId, applicationId, firstName: "Ada", lastName: "Okafor", dateOfBirth: Date.UTC(2018, 1, 1), gender: "Female", normalizedName: "ada okafor", createdAt: now, updatedAt: now });
    const snapshotId = await ctx.db.insert("admissionsSubmissionSnapshots", { schoolId, applicationId, revision: 1, formVersionId, declarationVersionId, productPriceId: priceId, requirementsDigest: "requirements", canonicalDigest: "canonical", signerGuardianId: guardianId, signerName: "Grace Okafor", signerRelationship: "Mother", submittedAt: now, declarationAcceptedAt: now, createdAt: now });
    await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId, snapshotId, itemKey: "profile", kind: "profile", valueType: "json", serializedValue: JSON.stringify({ firstName: "Ada", lastName: "Okafor", middleName: null, dateOfBirth: Date.UTC(2018, 1, 1), gender: "Female", address: null }), dataClass: "child_confidential", createdAt: now });
    await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId, snapshotId, itemKey: "primaryContact", kind: "contact", valueType: "json", serializedValue: JSON.stringify({ fullName: "Grace Okafor", relationship: "Mother", email: "conversion.guardian@example.test", phone: null, address: null }), dataClass: "personal", createdAt: now });
    const decisionId = await ctx.db.insert("admissionsDecisions", { schoolId, applicationId, version: 1, state: "accepted", decidedBy: operator.memberships[0].userId, decidedAt: now, createdAt: now });
    await ctx.db.patch(applicationId, { latestSnapshotId: snapshotId, currentDecisionId: decisionId });
    const photoStorageId = await ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], { type: "image/jpeg" }));
    const photoDocumentKey = "accepted-photo";
    const photoDocumentId = await ctx.db.insert("admissionsDocuments", { schoolId, applicationId, category: "photo", documentKey: photoDocumentKey, storageId: photoStorageId, fileName: "photo.jpg", mimeType: "image/jpeg", byteSize: 4, sha256: "photo-hash", version: 1, state: "accepted", sensitivity: "child_confidential", uploadedByGuardianId: guardianId, retentionHold: false, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId, snapshotId, itemKey: `document:${photoDocumentKey}`, kind: "document_manifest", valueType: "json", serializedValue: JSON.stringify({ documentKey: photoDocumentKey }), dataClass: "child_confidential", createdAt: now });
    const mutableProfile = await ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", applicationId)).unique();
    if (mutableProfile) await ctx.db.patch(mutableProfile._id, { firstName: "Tampered", normalizedName: "tampered okafor" });
    return { schoolId, otherSchoolId, classId, guardianId, applicationId, photoDocumentId, photoDocumentKey };
  });
  return { t, staff: t.withIdentity({ tokenIdentifier: "test|conversion-staff", subject: "conversion-staff", issuer: "test" }), limited: t.withIdentity({ tokenIdentifier: "test|conversion-limited", subject: "conversion-limited", issuer: "test" }), ...ids };
}

it("converts one accepted application transactionally, reuses canonical admission helpers, and queues onboarding after commit", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const args = { schoolId: f.schoolId, applicationId: f.applicationId, idempotencyKey: "conversion-request-001", classId: f.classId, admissionNumber: "ADM/2026/001", familyResolution: { kind: "create" as const }, photoDocumentKey: f.photoDocumentKey };
  const requested = await f.staff.mutation(conversionRef, args);
  expect(requested).toMatchObject({ state: "requested", replayed: false });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const converted = await f.t.run((ctx) => ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", f.applicationId)).unique());
  if (!converted?.studentId || !converted.familyId) throw new Error("conversion did not succeed");
  const replay = await f.staff.mutation(conversionRef, args);
  expect(replay).toMatchObject({ conversionId: converted._id, studentId: converted.studentId, familyId: converted.familyId, admissionNumber: "ADM/2026/001", replayed: true, state: "succeeded" });
  expect(await f.t.run((ctx) => ctx.db.query("students").withIndex("by_source_application", (q) => q.eq("sourceApplicationId", f.applicationId)).unique())).toMatchObject({ _id: converted.studentId, admissionNumber: "ADM/2026/001", familyId: converted.familyId, photoProvenance: "application_upload", photoSourceDocumentId: f.photoDocumentId, photoRetentionHold: true });
  expect(await f.t.run((ctx) => ctx.db.get(converted.studentUserId!))).toMatchObject({ name: "Ada Okafor" });
  expect(await f.t.run((ctx) => ctx.db.query("admissionNumberClaims").withIndex("by_school_number", (q) => q.eq("schoolId", f.schoolId).eq("number", "ADM/2026/001")).unique())).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", f.schoolId)).collect())).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("students").withIndex("by_source_application", (q) => q.eq("sourceApplicationId", f.applicationId)).collect())).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", converted._id).eq("eventKey", "portal_parent_linkage")).unique())).toMatchObject({ state: "sent", recipientGuardianId: f.guardianId });
  vi.useRealTimers();
});

it("requires manual-number override authority under governed numbering", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.insert("admissionNumberPolicies", { schoolId: f.schoolId, pattern: "{SEQ}", schoolCode: "ADM", campusCode: "MAIN", currentSequence: 0, createdAt: Date.now(), updatedAt: Date.now() }));
  await expect(f.limited.mutation(conversionRef, { schoolId: f.schoolId, applicationId: f.applicationId, idempotencyKey: "unauthorized-number", classId: f.classId, admissionNumber: "MANUAL/001", familyResolution: { kind: "create" } })).rejects.toThrow("override_number");
  expect(await f.t.run((ctx) => ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", f.applicationId)).unique())).toBeNull();
});

it("rejects duplicate admission numbers and cross-tenant family resolution without partial canonical writes", async () => {
  const duplicate = await fixture();
  await duplicate.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { schoolId: duplicate.schoolId, authId: "student:duplicate", name: "Existing", email: "existing@student.test", role: "student", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("students", { schoolId: duplicate.schoolId, classId: duplicate.classId, userId, admissionNumber: "DUP/001", createdAt: 1, updatedAt: 1 });
  });
  const duplicateRequest = await duplicate.staff.mutation(conversionRef, { schoolId: duplicate.schoolId, applicationId: duplicate.applicationId, idempotencyKey: "duplicate-request", classId: duplicate.classId, admissionNumber: "DUP/001", familyResolution: { kind: "create" } });
  await duplicate.t.mutation(processConversionRef, { conversionId: duplicateRequest.conversionId });
  expect(await duplicate.t.run((ctx) => ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", duplicate.applicationId)).unique())).toMatchObject({ state: "failed_terminal", errorCode: "CONVERSION_RESOLUTION_REQUIRED" });
  expect(await duplicate.t.run((ctx) => ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", duplicate.schoolId)).collect())).toHaveLength(0);

  const crossTenant = await fixture();
  const foreignFamilyId = await crossTenant.t.run(async (ctx) => {
    const staffUser = await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", crossTenant.schoolId)).first();
    if (!staffUser) throw new Error("staff missing");
    return ctx.db.insert("families", { schoolId: crossTenant.otherSchoolId, name: "Foreign", createdAt: 1, updatedAt: 1, createdBy: staffUser._id, updatedBy: staffUser._id });
  });
  const crossRequest = await crossTenant.staff.mutation(conversionRef, { schoolId: crossTenant.schoolId, applicationId: crossTenant.applicationId, idempotencyKey: "cross-tenant-request", classId: crossTenant.classId, admissionNumber: "ADM/002", familyResolution: { kind: "existing", familyId: foreignFamilyId } });
  await crossTenant.t.mutation(processConversionRef, { conversionId: crossRequest.conversionId });
  expect(await crossTenant.t.run((ctx) => ctx.db.get(crossRequest.conversionId))).toMatchObject({ state: "failed_terminal" });
  expect(await crossTenant.t.run((ctx) => ctx.db.query("users").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", "test|conversion-guardian")).collect())).toHaveLength(0);
});

async function addRetentionDocument(f: Awaited<ReturnType<typeof fixture>>, args: { key: string; applicationId?: Id<"admissionsApplications">; hold?: boolean }) {
  const bytes = new TextEncoder().encode(`retention-${args.key}`);
  const reservationKey = `retention:${args.key}`;
  await f.t.mutation(internal.functions.academic.metering.allocateQuota, { schoolId: f.schoolId, meterType: "storage_bytes", allocatedUnits: 1_000_000 });
  await f.t.mutation(internal.functions.academic.metering.reserveUsageQuota, { schoolId: f.schoolId, meterType: "storage_bytes", unitsRequested: bytes.byteLength, idempotencyKey: reservationKey, operationName: ADMISSIONS_UPLOAD_OPERATION });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "application/pdf" })));
  await f.t.mutation(internal.functions.academic.metering.commitUsageQuota, { schoolId: f.schoolId, meterType: "storage_bytes", idempotencyKey: reservationKey, operationName: ADMISSIONS_UPLOAD_OPERATION, description: "retention test", actualUnits: bytes.byteLength, measurementMetadata: { source: "convex_storage_metadata", measuredAt: Date.now(), reference: args.key } });
  const applicationId = args.applicationId ?? f.applicationId;
  const documentId = await f.t.run((ctx) => ctx.db.insert("admissionsDocuments", { schoolId: f.schoolId, applicationId, category: "supporting", documentKey: args.key, storageId, fileName: `${args.key}.pdf`, mimeType: "application/pdf", byteSize: bytes.byteLength, sha256: "stored", version: 1, state: "uploaded", sensitivity: "child_confidential", retentionHold: args.hold ?? false, quotaReservationKey: reservationKey, storageAccountingInitializedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() }));
  return { documentId, storageId, bytes: bytes.byteLength };
}

it("enforces prospective never/minimum/archive/delete timing, holds, workflow/photo blockers, and idempotent manual/cron cleanup", async () => {
  const f = await fixture();
  expect(await f.staff.query(getPolicyRef, { schoolId: f.schoolId })).toMatchObject({ mode: "never", version: 0 });
  const neverPolicy = await f.staff.mutation(setPolicyRef, { schoolId: f.schoolId, mode: "never", expectedVersion: 0 });
  await expect(f.staff.mutation(setPolicyRef, { schoolId: f.schoolId, mode: "archive", archiveAfterDays: 29, expectedVersion: 1 })).rejects.toThrow("at least 30 days");
  const policy = await f.staff.mutation(setPolicyRef, { schoolId: f.schoolId, mode: "archive", archiveAfterDays: 30, expectedVersion: 1 });
  const terminalAt = Date.now() - 31 * DAY_MS;
  await f.t.run((ctx) => ctx.db.patch(f.applicationId, { state: "rejected", terminalOutcomeAt: terminalAt, retentionPolicyId: policy.policyId, currentDecisionId: undefined }));
  const laterPolicy = await f.staff.mutation(setPolicyRef, { schoolId: f.schoolId, mode: "never", expectedVersion: 2 });
  expect(laterPolicy.version).toBe(3);
  expect(await f.t.run((ctx) => ctx.db.query("admissionsRetentionJobs").withIndex("by_school_and_policy_key", (q) => q.eq("schoolId", f.schoolId).eq("policyKey", "document_cleanup")).unique())).toMatchObject({ policyVersion: "2", state: "running" });
  const clock = vi.spyOn(Date, "now");

  const priorVersionCronDocument = await addRetentionDocument(f, { key: "prior-version-cron" });
  const cronNow = terminalAt + 100 * DAY_MS;
  for (let offset = 0; offset < 3; offset += 1) await f.t.mutation(processRetentionCleanupRef, { now: cronNow + offset * 2, limit: 20 });
  expect(await f.t.run((ctx) => ctx.db.get(priorVersionCronDocument.documentId))).toMatchObject({ state: "archived" });

  const due = await addRetentionDocument(f, { key: "due-document" });
  await expect(f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "due-document", now: terminalAt + 100 * DAY_MS })).rejects.toThrow("Unexpected field");
  clock.mockReturnValue(terminalAt + 31 * DAY_MS);
  const archived = await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "due-document" });
  expect(archived).toMatchObject({ changed: true, state: "archived", blocker: null });
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "due-document" })).toMatchObject({ changed: false, state: "archived", blocker: null });
  clock.mockReturnValue(terminalAt + 60 * DAY_MS);
  expect(await f.staff.mutation(deleteRef, { schoolId: f.schoolId, documentKey: "due-document" })).toMatchObject({ changed: false, blocker: "DELETE_NOT_DUE" });
  clock.mockReturnValue(terminalAt + 62 * DAY_MS);
  const deleted = await f.staff.mutation(deleteRef, { schoolId: f.schoolId, documentKey: "due-document" });
  expect(deleted).toMatchObject({ changed: true, state: "deleted", blocker: null });
  expect(await f.t.run((ctx) => ctx.storage.get(due.storageId))).toBeNull();
  clock.mockReturnValue(terminalAt + 100 * DAY_MS);
  expect(await f.staff.mutation(deleteRef, { schoolId: f.schoolId, documentKey: "due-document" })).toMatchObject({ changed: false, state: "deleted", blocker: null });

  await addRetentionDocument(f, { key: "held-document", hold: true });
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "held-document" })).toMatchObject({ blocker: "LEGAL_OR_RETENTION_HOLD" });
  await addRetentionDocument(f, { key: "workflow-document" });
  const staffUser = await f.t.run((ctx) => ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", f.schoolId)).first());
  if (!staffUser) throw new Error("staff missing");
  await f.t.run((ctx) => ctx.db.insert("admissionsReviewAssignments", { schoolId: f.schoolId, applicationId: f.applicationId, assigneeUserId: staffUser._id, role: "reviewer", state: "assigned", assignedByUserId: staffUser._id, createdAt: Date.now(), updatedAt: Date.now() }));
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "workflow-document" })).toMatchObject({ blocker: "PENDING_WORKFLOW" });

  const [noPolicyApplication, neverPolicyApplication] = await f.t.run(async (ctx) => {
    const original = await ctx.db.get(f.applicationId);
    if (!original) throw new Error("application missing");
    const common = { schoolId: original.schoolId, guardianId: original.guardianId, entitlementId: original.entitlementId, programmeId: original.programmeId, intakeId: original.intakeId, productId: original.productId, priceId: original.priceId, formVersionId: original.formVersionId, declarationVersionId: original.declarationVersionId, state: "rejected" as const, currentRevision: 1, draftVersion: 1, terminalOutcomeAt: terminalAt, createdAt: terminalAt, updatedAt: terminalAt };
    return await Promise.all([
      ctx.db.insert("admissionsApplications", { ...common, publicId: "legacy-no-policy" }),
      ctx.db.insert("admissionsApplications", { ...common, publicId: "prospective-never-policy", retentionPolicyId: neverPolicy.policyId }),
    ]);
  });
  await addRetentionDocument(f, { key: "legacy-document", applicationId: noPolicyApplication });
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "legacy-document" })).toMatchObject({ blocker: "NO_PROSPECTIVE_POLICY" });
  await addRetentionDocument(f, { key: "never-document", applicationId: neverPolicyApplication });
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: "never-document" })).toMatchObject({ blocker: "POLICY_NEVER" });

  const cron = await f.t.mutation(processRetentionCleanupRef, { now: terminalAt + 100 * DAY_MS, limit: 20 });
  expect(cron.inspected).toBeLessThanOrEqual(20);
  const cronReplay = await f.t.mutation(processRetentionCleanupRef, { now: terminalAt + 100 * DAY_MS, limit: 20 });
  expect(cronReplay.inspected).toBeLessThanOrEqual(20);
  clock.mockRestore();
});

it("advances a persisted retention cursor fairly across equally-timestamped blocked documents", async () => {
  const f = await fixture();
  const policy = await f.staff.mutation(setPolicyRef, { schoolId: f.schoolId, mode: "archive", archiveAfterDays: 30, expectedVersion: 0 });
  const terminalAt = Date.now() - 31 * DAY_MS;
  await f.t.run((ctx) => ctx.db.patch(f.applicationId, { state: "rejected", terminalOutcomeAt: terminalAt, retentionPolicyId: policy.policyId, currentDecisionId: undefined }));
  const first = await addRetentionDocument(f, { key: "fair-one", hold: true });
  const second = await addRetentionDocument(f, { key: "fair-two", hold: true });
  await f.t.run(async (ctx) => { await ctx.db.patch(first.documentId, { updatedAt: 1 }); await ctx.db.patch(second.documentId, { updatedAt: 1 }); });
  const now = terminalAt + 100 * DAY_MS;
  expect(await f.t.mutation(processRetentionCleanupRef, { now, limit: 1 })).toMatchObject({ inspected: 1, blocked: 1 });
  expect(await f.t.mutation(processRetentionCleanupRef, { now: now + 2, limit: 1 })).toMatchObject({ inspected: 1, blocked: 1 });
  const job = await f.t.run((ctx) => ctx.db.query("admissionsRetentionJobs").withIndex("by_school_and_policy_key", (q) => q.eq("schoolId", f.schoolId).eq("policyKey", "document_cleanup")).order("desc").first());
  expect(job?.cursor).toContain("creationTime");
});

it("blocks accepted-document retention before conversion and while selected student-photo provenance remains", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const policy = await f.staff.mutation(setPolicyRef, { schoolId: f.schoolId, mode: "archive", archiveAfterDays: 30, expectedVersion: 0 });
  const terminalAt = Date.now() - 31 * DAY_MS;
  await f.t.run((ctx) => ctx.db.patch(f.applicationId, { terminalOutcomeAt: terminalAt, retentionPolicyId: policy.policyId }));
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: f.photoDocumentKey })).toMatchObject({ blocker: "APPLICATION_NOT_TERMINAL" });
  const converted = await f.staff.mutation(conversionRef, { schoolId: f.schoolId, applicationId: f.applicationId, idempotencyKey: "photo-retention-conversion", classId: f.classId, admissionNumber: "PHOTO/001", familyResolution: { kind: "create" }, photoDocumentKey: f.photoDocumentKey });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run((ctx) => ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", converted.conversionId).eq("eventKey", "portal_parent_linkage")).unique())).toMatchObject({ state: "sent" });
  expect(await f.staff.mutation(archiveRef, { schoolId: f.schoolId, documentKey: f.photoDocumentKey })).toMatchObject({ blocker: "STUDENT_PHOTO_SOURCE" });
  vi.useRealTimers();
});
