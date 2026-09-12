import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { cleanupUploadIntentRef, beginHttpUploadRef, recordHttpUploadStorageRef, failHttpUploadRef } from "../refs";
import { sha256Hex } from "../shared";
import { storageClaimedOnlyBy } from "../../academic/assetStorageBoundary";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const guardianIdentityRef = makeFunctionReference<"mutation">("functions/admissions/guardian:getOrCreateIdentity");
const requestUploadRef = makeFunctionReference<"mutation">("functions/admissions/documents:requestUploadIntent");
const finalizeUploadRef = makeFunctionReference<"mutation">("functions/admissions/documents:finalizeUpload");
const ownAccessRef = makeFunctionReference<"mutation">("functions/admissions/documents:getOwnAccess");

const pdfBytes = new TextEncoder().encode("%PDF-1.7\nsecure admissions document");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Storage School", slug: "storage-school", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other", status: "active", createdAt: now, updatedAt: now });
    const rateVersionId = await ctx.db.insert("commercialRateVersions", { code: "test", name: "Test", version: 1, effectiveFrom: now - 1, rate: { currency: "NGN", perStudentMinor: 0, setupMinor: 0, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly", proration: "daily" }, createdAt: now });
    const entitlement = { allowances: [{ meterType: "storage_bytes" as const, baseUnits: 1_000_000, graceUnits: 0 }], warningPercent: 75, criticalPercent: 90, hardStopPercent: 100, maxFileSizeBytes: 1_000_000, maxPagesPerOperation: 20, profiles: [] };
    const entitlementVersionId = await ctx.db.insert("usageEntitlementVersions", { code: "test", name: "Test", version: 1, effectiveFrom: now - 1, entitlement, createdAt: now });
    const contractId = await ctx.db.insert("commercialContracts", { schoolId, rateVersionId, rate: { currency: "NGN", perStudentMinor: 0, setupMinor: 0, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly", proration: "daily" }, code: "test", version: 1, effectiveFrom: now - 1, effectiveTo: now + 1_000_000, setupHandling: "waived", setupReason: "test", createdAt: now });
    const cycleId = await ctx.db.insert("usageCycles", { schoolId, contractId, entitlementVersionId, code: "test", version: 1, entitlement, startAt: now - 1, endAt: now + 1_000_000, status: "active", createdAt: now });
    await ctx.db.insert("usageMeterAllocations", { schoolId, cycleId, meterType: "storage_bytes", allocatedUnits: 1_000_000, consumedUnits: 0, activeStorageBytes: 0, trashStorageBytes: 0, tempStorageBytes: 0, reservedUnits: 0, resetCadence: "termly", lastResetAt: now, updatedAt: now });
    const guardianId = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: "test|document-owner", betterAuthUserId: "document-owner", normalizedEmail: "owner@example.test", emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now });
    const otherGuardianId = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: "test|document-other", betterAuthUserId: "document-other", normalizedEmail: "other@example.test", emailVerifiedAt: now, status: "active", createdAt: now, updatedAt: now });
    const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now });
    const intakeId = await ctx.db.insert("admissionsIntakes", { schoolId, programmeId, slug: "2026", name: "2026", cycleLabel: "2026", opensAt: now - 1, closesAt: now + 100_000, status: "open", createdAt: now, updatedAt: now });
    const formVersionId = await ctx.db.insert("admissionsFormVersions", { schoolId, programmeId, intakeId, version: 1, schemaVersion: "1", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    const requirementId = await ctx.db.insert("admissionsDocumentRequirements", { schoolId, formVersionId, requirementKey: "birth-certificate", category: "identity", label: "Birth certificate", requiredMode: "required", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 2, sensitivity: "highly_sensitive", purpose: "Age evidence", order: 1, createdAt: now, updatedAt: now });
    const declarationVersionId = await ctx.db.insert("admissionsDeclarationVersions", { schoolId, programmeId, version: 1, title: "Declaration", body: "Text", bodyDigest: "digest", purpose: "attestation", status: "published", publishedAt: now, createdAt: now, updatedAt: now });
    const productId = await ctx.db.insert("admissionsProducts", { schoolId, intakeId, slug: "slot", name: "Slot", slotCount: 1, status: "active", createdAt: now, updatedAt: now });
    const priceId = await ctx.db.insert("admissionsProductPrices", { schoolId, productId, version: 1, amountMinor: 1, currency: "NGN", refundPolicyKey: "none", feeDisclosure: "fee", effectiveFrom: now - 1, status: "published", createdAt: now, updatedAt: now });
    const purchaseId = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId, guardianId, productId, priceId, provider: "paystack", providerMode: "test", reference: "adm_docs", idempotencyKey: "docs", amountMinor: 1, currency: "NGN", feeDisclosureSnapshot: "fee", state: "paid", verifiedAt: now, createdAt: now, updatedAt: now });
    const entitlementId = await ctx.db.insert("admissionsEntitlements", { schoolId, guardianId, productId, intakeId, sourcePurchaseAttemptId: purchaseId, state: "reserved", reservedAt: now, createdAt: now, updatedAt: now });
    const applicationId = await ctx.db.insert("admissionsApplications", { schoolId, guardianId, entitlementId, programmeId, intakeId, productId, priceId, formVersionId, declarationVersionId, publicId: "docs-app", state: "draft", currentRevision: 0, draftVersion: 0, createdAt: now, updatedAt: now });
    await ctx.db.patch(entitlementId, { applicationId });
    const otherEntitlementId = await ctx.db.insert("admissionsEntitlements", { schoolId: otherSchoolId, guardianId: otherGuardianId, productId, intakeId, sourcePurchaseAttemptId: purchaseId, state: "reserved", reservedAt: now, createdAt: now, updatedAt: now });
    const otherApplicationId = await ctx.db.insert("admissionsApplications", { schoolId: otherSchoolId, guardianId: otherGuardianId, entitlementId: otherEntitlementId, programmeId, intakeId, productId, priceId, formVersionId, declarationVersionId, publicId: "other-app", state: "draft", currentRevision: 0, draftVersion: 0, createdAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, guardianId, applicationId, otherApplicationId, requirementId };
  });
  return {
    t,
    owner: t.withIdentity({ tokenIdentifier: "test|document-owner", subject: "document-owner", issuer: "test", email: "owner@example.test", emailVerified: true }),
    other: t.withIdentity({ tokenIdentifier: "test|document-other", subject: "document-other", issuer: "test", email: "other@example.test", emailVerified: true }),
    ...ids,
  };
}

it("binds upload intents to guardian, school, application, requirement, token, type, size, hash, and expiry", async () => {
  const f = await fixture();
  const hash = await sha256Hex(pdfBytes);
  await expect(f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "wrong.exe", contentType: "application/octet-stream", size: pdfBytes.byteLength, sha256: hash })).rejects.toThrow("Unsupported");
  await expect(f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "large.pdf", contentType: "application/pdf", size: 100_001, sha256: hash })).rejects.toThrow("type and size");
  await expect(f.other.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "cross.pdf", contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash })).rejects.toThrow("not found");

  const intent = await f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "birth.pdf", contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash }) as { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadPath: string };
  expect(intent.uploadPath).toBe("/admissions/document-upload");
  expect(JSON.stringify(intent)).not.toContain("storageId");
  await expect(f.other.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-other-0001" })).rejects.toThrow("not found");
  await expect(f.owner.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: `${intent.uploadToken}x`, uploadAttemptId: "attempt-wrong-0001" })).rejects.toThrow("not found");
  const reservation = await f.t.run((ctx) => ctx.db.query("usageQuotaReservations").withIndex("by_school", (q) => q.eq("schoolId", f.schoolId)).unique());
  expect(reservation).toMatchObject({ status: "reserved", unitsReserved: pdfBytes.byteLength });

  await f.t.run((ctx) => ctx.db.patch(intent.uploadIntentId, { expiresAt: Date.now() - 1 }));
  await expect(f.owner.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-expired-001" })).rejects.toThrow("no longer available");
});

it("commits measured quota once on finalize and releases abandoned bytes only after storage deletion", async () => {
  const f = await fixture();
  const hash = await sha256Hex(pdfBytes);
  const request = async (name: string) => await f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: name, contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash }) as { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string };

  const intent = await request("committed.pdf");
  await f.owner.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-commit-001" });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([pdfBytes], { type: "application/pdf" })));
  await f.owner.mutation(recordHttpUploadStorageRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-commit-001", storageId });
  const document = await f.owner.mutation(finalizeUploadRef, { uploadIntentId: intent.uploadIntentId });
  expect(await f.owner.mutation(finalizeUploadRef, { uploadIntentId: intent.uploadIntentId })).toMatchObject({ documentKey: document.documentKey, replayed: true });
  const storedDocument = await f.t.run((ctx) => ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", document.documentKey)).unique());
  if (!storedDocument) throw new Error("finalized document missing");
  expect(await f.t.run((ctx) => storageClaimedOnlyBy(ctx, storageId, { purpose: "admissionsDocument", ownerId: String(storedDocument._id) }))).toBe(true);
  let allocation = await f.t.run((ctx) => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes")).unique());
  expect(allocation).toMatchObject({ consumedUnits: pdfBytes.byteLength, activeStorageBytes: pdfBytes.byteLength, reservedUnits: 0 });

  const abandoned = await request("abandoned.pdf");
  await f.owner.mutation(beginHttpUploadRef, { uploadIntentId: abandoned.uploadIntentId, uploadToken: abandoned.uploadToken, uploadAttemptId: "attempt-abandon-01" });
  const abandonedStorageId = await f.t.run((ctx) => ctx.storage.store(new Blob([pdfBytes], { type: "application/pdf" })));
  await f.owner.mutation(recordHttpUploadStorageRef, { uploadIntentId: abandoned.uploadIntentId, uploadToken: abandoned.uploadToken, uploadAttemptId: "attempt-abandon-01", storageId: abandonedStorageId });
  await f.t.run((ctx) => ctx.db.patch(abandoned.uploadIntentId, { expiresAt: Date.now() - 1 }));
  await f.t.mutation(cleanupUploadIntentRef, { uploadIntentId: abandoned.uploadIntentId });
  expect(await f.t.run((ctx) => ctx.storage.get(abandonedStorageId))).toBeNull();
  allocation = await f.t.run((ctx) => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes")).unique());
  expect(allocation).toMatchObject({ consumedUnits: pdfBytes.byteLength, reservedUnits: 0 });
  await f.t.mutation(cleanupUploadIntentRef, { uploadIntentId: abandoned.uploadIntentId });
  expect(await f.t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
});

it("allows only requested document corrections and atomically supersedes one-for-one replacements", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.requirementId, { maxFiles: 1 });
    const application = await ctx.db.get(f.applicationId);
    if (!application) throw new Error("application missing");
    await ctx.db.insert("admissionsDocumentRequirements", { schoolId: f.schoolId, formVersionId: application.formVersionId, requirementKey: "unrequested", category: "identity", label: "Unrequested", requiredMode: "optional", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 1, sensitivity: "personal", purpose: "Supporting evidence", order: 2, createdAt: Date.now(), updatedAt: Date.now() });
  });
  const hash = await sha256Hex(pdfBytes);
  const store = async (fileName: string) => {
    const intent = await f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName, contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash });
    const attemptId = `attempt-${fileName.replace(/[^a-z]/g, "")}`;
    await f.owner.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: attemptId });
    const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([pdfBytes], { type: "application/pdf" })));
    await f.owner.mutation(recordHttpUploadStorageRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: attemptId, storageId });
    return await f.owner.mutation(finalizeUploadRef, { uploadIntentId: intent.uploadIntentId });
  };
  const first = await store("first.pdf");
  const unrequestedId = await f.t.run(async (ctx) => {
    const application = await ctx.db.get(f.applicationId);
    if (!application) throw new Error("application missing");
    return await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q) => q.eq("formVersionId", application.formVersionId).eq("requirementKey", "unrequested")).unique();
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.applicationId, { state: "changes_requested", updatedAt: Date.now() });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: f.schoolId, applicationId: f.applicationId, eventType: "changes_requested", visibility: "guardian", reasonCode: "REPLACE", message: "Replace the document", metadataJson: JSON.stringify({ fieldKeys: [], requirementIds: [String(f.requirementId)] }), createdAt: Date.now() });
  });
  if (unrequestedId) await expect(f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: unrequestedId._id, fileName: "wrong.pdf", contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash })).rejects.toThrow("requested document corrections");
  const replacement = await store("replacement.pdf");
  const rows = await f.t.run((ctx) => ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", f.applicationId).eq("requirementId", f.requirementId)).collect());
  expect(rows.find((row) => row.documentKey === first.documentKey)).toMatchObject({ state: "superseded" });
  expect(rows.find((row) => row.documentKey === replacement.documentKey)).toMatchObject({ state: "uploaded", version: 2 });
}, 15_000);

it("requires fresh current auth claims for sensitive download and audits denied and granted checks", async () => {
  const f = await fixture();
  const hash = await sha256Hex(pdfBytes);
  const intent = await f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "sensitive.pdf", contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash });
  await f.owner.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-sensitive-01" });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([pdfBytes], { type: "application/pdf" })));
  await f.owner.mutation(recordHttpUploadStorageRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-sensitive-01", storageId });
  const document = await f.owner.mutation(finalizeUploadRef, { uploadIntentId: intent.uploadIntentId });
  expect(await f.owner.mutation(ownAccessRef, { documentKey: document.documentKey, action: "download" })).toMatchObject({ status: "unavailable" });
  const fresh = f.t.withIdentity({ tokenIdentifier: "test|document-owner", subject: "document-owner", issuer: "test", email: "owner@example.test", emailVerified: true, auth_time: Math.floor(Date.now() / 1000) });
  expect(await fresh.mutation(ownAccessRef, { documentKey: document.documentKey, action: "download" })).toMatchObject({ status: "available", documentKey: document.documentKey });
  const audits = await f.t.run(async (ctx) => {
    const row = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", document.documentKey)).unique();
    if (!row) throw new Error("document missing");
    return await ctx.db.query("admissionsDocumentAccessAudits").withIndex("by_document_and_created_at", (q) => q.eq("documentId", row._id)).collect();
  });
  expect(audits.map((audit) => audit.outcome)).toEqual(["denied", "granted"]);
});

it("rejects stored MIME, size, and hash mismatches and releases failed reservations", async () => {
  const f = await fixture();
  const hash = await sha256Hex(pdfBytes);
  const intent = await f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "mismatch.pdf", contentType: "application/pdf", size: pdfBytes.byteLength, sha256: hash }) as { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string };
  await f.owner.mutation(beginHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-mismatch-1" });
  const wrongSize = await f.t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(pdfBytes.byteLength - 1)], { type: "application/pdf" })));
  await expect(f.owner.mutation(recordHttpUploadStorageRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-mismatch-1", storageId: wrongSize })).rejects.toThrow("metadata");
  await f.t.run((ctx) => ctx.storage.delete(wrongSize));
  await f.t.mutation(failHttpUploadRef, { uploadIntentId: intent.uploadIntentId, uploadToken: intent.uploadToken, uploadAttemptId: "attempt-mismatch-1", failureReason: "measured mismatch" });
  expect(await f.t.run((ctx) => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes")).unique())).toMatchObject({ consumedUnits: 0, reservedUnits: 0 });

  const hashIntent = await f.owner.mutation(requestUploadRef, { applicationId: f.applicationId, requirementId: f.requirementId, fileName: "hash.pdf", contentType: "application/pdf", size: pdfBytes.byteLength, sha256: "0".repeat(64) }) as { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string };
  await f.owner.mutation(beginHttpUploadRef, { uploadIntentId: hashIntent.uploadIntentId, uploadToken: hashIntent.uploadToken, uploadAttemptId: "attempt-hash-0001" });
  const wrongHash = await f.t.run((ctx) => ctx.storage.store(new Blob([pdfBytes], { type: "application/pdf" })));
  await expect(f.owner.mutation(recordHttpUploadStorageRef, { uploadIntentId: hashIntent.uploadIntentId, uploadToken: hashIntent.uploadToken, uploadAttemptId: "attempt-hash-0001", storageId: wrongHash })).rejects.toThrow("metadata");
});
