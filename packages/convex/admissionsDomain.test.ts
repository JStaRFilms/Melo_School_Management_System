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

  test("keeps partial drafts independent, makes exact saves no-ops, and rejects stale writers", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const field = await t.run((ctx) => ctx.db.insert("admissionsFormFields", { schoolId: ids.schoolA, formVersionId: ids.form, fieldKey: "future-section", sectionKey: "future", kind: "text", label: "Future section", requiredMode: "required", dataClass: "personal", validationJson: "{}", order: 1, status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    const saveCore = (expectedVersion: number) => t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion, firstName: "Partial", lastName: "Draft", dateOfBirth: 1 });
    const saveContact = (expectedVersion: number) => t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveContact, { applicationId: application.applicationId, expectedVersion, contactKey: "primary-guardian", kind: "guardian", fullName: "Guardian Name", relationship: "Parent", isApplicantGuardian: true, isPrimary: true });
    expect(await saveCore(1)).toBe(2);
    expect(await saveContact(2)).toBe(3);
    expect(await t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ state: "draft", draftVersion: 3 });
    expect(await t.run((ctx) => ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application.applicationId)).unique())).toMatchObject({ firstName: "Partial" });
    expect(await t.run((ctx) => ctx.db.query("admissionsApplicationContacts").withIndex("by_application_and_contact_key", (q) => q.eq("applicationId", application.applicationId).eq("contactKey", "primary-guardian")).unique())).toMatchObject({ fullName: "Guardian Name" });
    expect(await saveCore(3)).toBe(3);
    expect(await saveContact(3)).toBe(3);
    expect(await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: field, expectedVersion: 3, valueType: "text", serializedValue: "saved" })).toBe(4);
    expect(await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: field, expectedVersion: 4, valueType: "text", serializedValue: "saved" })).toBe(4);
    expect(await t.run((ctx) => ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application.applicationId).eq("fieldKey", "future-section")).unique())).toMatchObject({ valueVersion: 1 });
    await expect(saveContact(3)).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    expect(await t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ draftVersion: 4 });
  });

  test("cross-tenant staff and document access are denied", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    await expect(t.withIdentity({ subject: "staff", tokenIdentifier: "issuer|staff", issuer: "issuer" }).query((api as any).functions.admissions.staff.listQueue, { schoolId: ids.schoolB, intakeId: ids.intake })).resolves.toEqual([]);
    await expect(t.withIdentity({ subject: "other", tokenIdentifier: "issuer|other", issuer: "issuer", email: "other@example.test" }).mutation((api as any).functions.admissions.documents.getOwnAccess, { documentKey: "missing", action: "view" })).rejects.toThrow("Verification required");
  });

  test("real scoped grants do not cross tenants or unlock sensitive documents", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const staleStaffIdentity = { subject: "scoped", tokenIdentifier: "issuer|scoped", issuer: "issuer", auth_time: Math.floor((Date.now() - 10 * 60_000) / 1_000) };
    const freshStaffIdentity = { ...staleStaffIdentity, auth_time: Math.floor(Date.now() / 1_000) };
    const staff = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolB, authId: staleStaffIdentity.subject, authTokenIdentifier: staleStaffIdentity.tokenIdentifier, name: "Scoped", email: "scoped@example.test", role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolB, userId: staff, capability: "applications.view_basic", scope: "school", grantedByUserId: staff, reason: "other tenant", isBreakGlass: false, createdAt: Date.now() }));
    await expect(t.withIdentity(freshStaffIdentity).query((api as any).functions.admissions.staff.getApplicationDetail, { applicationId: application.applicationId })).rejects.toThrow("Not found or access denied");
    await t.run(async (ctx) => { await ctx.db.patch(staff, { schoolId: ids.schoolA, updatedAt: Date.now() }); await ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: staff, capability: "documents.review", scope: "intake", intakeId: ids.intake, grantedByUserId: staff, reason: "document metadata only", isBreakGlass: false, createdAt: Date.now() }); });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["identity"], { type: "image/jpeg" })));
    await t.run((ctx) => ctx.db.insert("admissionsDocuments", { schoolId: ids.schoolA, applicationId: application.applicationId, category: "identity", documentKey: "doc_sensitive", storageId, fileName: "identity.jpg", mimeType: "image/jpeg", byteSize: 8, sha256: "digest", version: 1, state: "uploaded", sensitivity: "highly_sensitive", uploadedByGuardianId: ids.guardian, retentionHold: false, createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(freshStaffIdentity).mutation((api as any).functions.admissions.staff.getDocumentAccess, { documentKey: "doc_sensitive", action: "view", reason: "Review identity evidence" })).rejects.toThrow("Not found or access denied");
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: staff, capability: "applications.view_sensitive", scope: "intake", intakeId: ids.intake, grantedByUserId: staff, reason: "restricted document review", isBreakGlass: false, createdAt: Date.now() }));
    await expect(t.withIdentity(staleStaffIdentity).mutation((api as any).functions.admissions.staff.getDocumentAccess, { documentKey: "doc_sensitive", action: "view", reason: "Review identity evidence" })).resolves.toEqual({ status: "unavailable", documentKey: "doc_sensitive" });
    await expect(t.withIdentity(freshStaffIdentity).mutation((api as any).functions.admissions.staff.getDocumentAccess, { documentKey: "doc_sensitive", action: "view", reason: "Review identity evidence" })).resolves.toMatchObject({ status: "available", documentKey: "doc_sensitive" });
  });

  test("staff detail is snapshot-backed, redacted by default, and sensitive reveal is fresh-auth audited", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const field = await t.run((ctx) => ctx.db.insert("admissionsFormFields", { schoolId: ids.schoolA, formVersionId: ids.form, fieldKey: "medical-note", sectionKey: "support", kind: "text", label: "Medical note", requiredMode: "optional", dataClass: "highly_sensitive", purpose: "support", validationJson: "{}", order: 1, status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    let version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Snapshot", lastName: "Applicant", dateOfBirth: 1 });
    version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: field, expectedVersion: version, valueType: "text", serializedValue: "private diagnosis" });
    await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: application.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: true });
    const staleIdentity = { subject: "reviewer", tokenIdentifier: "issuer|reviewer", issuer: "issuer", auth_time: Math.floor((Date.now() - 10 * 60_000) / 1000) };
    const freshIdentity = { ...staleIdentity, auth_time: Math.floor(Date.now() / 1000) };
    const reviewer = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: staleIdentity.subject, authTokenIdentifier: staleIdentity.tokenIdentifier, name: "Reviewer", email: "reviewer@example.test", role: "teacher", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run(async (ctx) => { for (const capability of ["applications.view_basic", "applications.view_sensitive"] as const) await ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: reviewer, capability, scope: "intake", intakeId: ids.intake, grantedByUserId: reviewer, reason: "review", isBreakGlass: false, createdAt: Date.now() }); });
    const basic = await t.withIdentity(staleIdentity).query((api as any).functions.admissions.staff.getApplicationDetail, { applicationId: application.applicationId });
    expect(basic.profile).toMatchObject({ firstName: "Snapshot", lastName: "Applicant" });
    expect(basic.answers).toEqual([expect.objectContaining({ key: "medical-note", value: null, redacted: true })]);
    await expect(t.withIdentity(staleIdentity).mutation((api as any).functions.admissions.staff.revealSensitiveApplicationDetail, { applicationId: application.applicationId, reason: "Review support requirements" })).rejects.toThrow("fresh authentication");
    const revealed = await t.withIdentity(freshIdentity).mutation((api as any).functions.admissions.staff.revealSensitiveApplicationDetail, { applicationId: application.applicationId, reason: "Review support requirements" });
    expect(revealed.answers).toEqual([expect.objectContaining({ value: "private diagnosis", redacted: false })]);
    expect(await t.run((ctx) => ctx.db.query("admissionsAuditEvents").withIndex("by_application_and_created_at", (q) => q.eq("applicationId", application.applicationId)).order("desc").take(10))).toEqual(expect.arrayContaining([expect.objectContaining({ action: "application.sensitive_detail_viewed" })]));
  });

  test("returns only the declared audit pagination contract", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const identity = { subject: "auditor", tokenIdentifier: "issuer|auditor", issuer: "issuer" };
    const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Auditor", email: "auditor@example.test", role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability: "audit.view", scope: "intake", intakeId: ids.intake, grantedByUserId: user, reason: "admissions audit", isBreakGlass: false, createdAt: Date.now() }));

    const result = await t.withIdentity(identity).query((api as any).functions.admissions.staff.getAuditPage, { applicationId: application.applicationId, paginationOpts: { numItems: 20, cursor: null } });
    expect(result.page.length).toBeGreaterThan(0);
    expect(Object.keys(result).sort()).toEqual(["continueCursor", "isDone", "page"]);
  });

  test("sensitive detail reveal is denied without the exact capability", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const identity = { subject: "basic", tokenIdentifier: "issuer|basic", issuer: "issuer", auth_time: Math.floor(Date.now() / 1000) };
    const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Basic", email: "basic@example.test", role: "teacher", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability: "applications.view_basic", scope: "school", grantedByUserId: user, reason: "basic only", isBreakGlass: false, createdAt: Date.now() }));
    await expect(t.withIdentity(identity).mutation((api as any).functions.admissions.staff.revealSensitiveApplicationDetail, { applicationId: application.applicationId, reason: "Review sensitive answers" })).rejects.toThrow("Not found or access denied");
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
    await expect(t.withIdentity(staff).mutation((api as any).functions.admissions.conversions.executeAcceptedConversion, args)).rejects.toThrow("CONVERSION_RESOLUTION_REQUIRED");
    await t.withIdentity(staff).mutation((api as any).functions.admissions.conversions.resolveConversion, { applicationId: application.applicationId, parentMode: "create", familyMode: "create", studentMode: "create", reason: "Create distinct records for this accepted child" });
    const first = await t.withIdentity(staff).mutation((api as any).functions.admissions.conversions.executeAcceptedConversion, args);
    const replay = await t.withIdentity(staff).mutation((api as any).functions.admissions.conversions.executeAcceptedConversion, args);
    expect(replay.replayed).toBe(true); expect(replay.studentId).toBe(first.studentId);
    expect(await t.run((ctx) => ctx.db.query("students").withIndex("by_school_and_admission_number", (q) => q.eq("schoolId", ids.schoolA).eq("admissionNumber", "ADM-1")).take(2))).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", first.conversionId).eq("eventKey", "portal_onboarding")).take(2))).toHaveLength(1);
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

  test("rejects invalid configured choices before persisting an answer", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const field = await t.run((ctx) => ctx.db.insert("admissionsFormFields", { schoolId: ids.schoolA, formVersionId: ids.form, fieldKey: "entry_choice", sectionKey: "child", kind: "select", label: "Entry", requiredMode: "required", dataClass: "personal", validationJson: JSON.stringify({ choices: ["day", "board"] }), order: 1, status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: field, expectedVersion: 1, valueType: "select", serializedValue: "invalid" })).rejects.toThrow("ANSWER_INVALID");
  });

  test("a finance hold blocks submission until explicitly released", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Child", lastName: "One", dateOfBirth: 1 });
    const staff = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: "hold", authTokenIdentifier: "issuer|hold", name: "Hold", email: "hold@example.test", role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run((ctx) => ctx.db.insert("admissionsFinanceHolds", { schoolId: ids.schoolA, applicationId: application.applicationId, state: "active", reasonCode: "payment_review", createdByUserId: staff, createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: application.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: true })).rejects.toThrow("FINANCE_HOLD");
  });

  test("settings drafts are school-scoped and sensitive fields need an extra grant", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const staff = { subject: "catalogue", tokenIdentifier: "issuer|catalogue", issuer: "issuer" };
    const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: staff.subject, authTokenIdentifier: staff.tokenIdentifier, name: "Catalogue", email: "catalogue@example.test", role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability: "admissions.catalogue.manage", scope: "school", grantedByUserId: user, reason: "test", isBreakGlass: false, createdAt: Date.now() }));
    const draft = await t.withIdentity(staff).mutation((api as any).functions.admissions.settings.createDraftForm, { schoolId: ids.schoolA, programmeId: ids.programme, intakeId: ids.intake, schemaVersion: "2" });
    await expect(t.withIdentity(staff).mutation((api as any).functions.admissions.settings.addDraftField, { formVersionId: draft, fieldKey: "medical", sectionKey: "support", kind: "text", label: "Medical", requiredMode: "optional", dataClass: "highly_sensitive", purpose: "safety", validationJson: "{}", order: 1 })).rejects.toThrow("Not found or access denied");
    await expect(t.withIdentity(staff).mutation((api as any).functions.admissions.settings.addDraftField, { formVersionId: draft, fieldKey: "bad-kind", sectionKey: "support", kind: "script", label: "Bad", requiredMode: "optional", dataClass: "personal", validationJson: JSON.stringify({ callback: "unsafe" }), order: 2 })).rejects.toThrow("Field kind is invalid");
    const declaration = await t.withIdentity(staff).mutation((api as any).functions.admissions.settings.createDeclaration, { schoolId: ids.schoolA, programmeId: ids.programme, version: 2, title: "New declaration", body: "Draft only", purpose: "service" });
    expect(await t.run((ctx) => ctx.db.get(declaration))).toMatchObject({ status: "draft" });
  });

  test("separates catalogue editing from publication review and controls", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const createStaff = async (name: string, capabilities: Array<"admissions.catalogue.manage" | "admissions.publish">) => {
      const identity = { subject: name, tokenIdentifier: `issuer|${name}`, issuer: "issuer" };
      const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name, email: `${name}@example.test`, role: "admin", createdAt: Date.now(), updatedAt: Date.now() }));
      await t.run(async (ctx) => { for (const capability of capabilities) await ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability, scope: "school", grantedByUserId: user, reason: "settings access test", isBreakGlass: false, createdAt: Date.now() }); });
      return identity;
    };
    const editor = await createStaff("editor", ["admissions.catalogue.manage"]);
    const publisher = await createStaff("publisher-only", ["admissions.publish"]);
    const combined = await createStaff("combined", ["admissions.catalogue.manage", "admissions.publish"]);
    const denied = await createStaff("denied", []);
    const getCatalogue = (api as any).functions.admissions.settings.getCatalogue;
    const getPublicationReview = (api as any).functions.admissions.settings.getPublicationReview;
    const setProgrammeStatus = (api as any).functions.admissions.settings.setProgrammeStatus;

    await expect(t.withIdentity(editor).query(getCatalogue, { schoolId: ids.schoolA })).resolves.toMatchObject({ programmes: [expect.objectContaining({ id: ids.programme })] });
    await expect(t.withIdentity(editor).query(getPublicationReview, { schoolId: ids.schoolA })).rejects.toThrow("Not found or access denied");
    await expect(t.withIdentity(editor).mutation(setProgrammeStatus, { programmeId: ids.programme, status: "closed" })).rejects.toThrow("Not found or access denied");

    await expect(t.withIdentity(publisher).query(getCatalogue, { schoolId: ids.schoolA })).rejects.toThrow("Not found or access denied");
    await expect(t.withIdentity(publisher).query(getPublicationReview, { schoolId: ids.schoolA })).resolves.toMatchObject({ programmes: [expect.objectContaining({ id: ids.programme })] });
    await expect(t.withIdentity(publisher).query(getPublicationReview, { schoolId: ids.schoolB })).rejects.toThrow("Not found or access denied");
    await expect(t.withIdentity(publisher).mutation(setProgrammeStatus, { programmeId: ids.programme, status: "closed" })).resolves.toBeNull();

    await expect(t.withIdentity(combined).query(getCatalogue, { schoolId: ids.schoolA })).resolves.toBeTruthy();
    await expect(t.withIdentity(combined).query(getPublicationReview, { schoolId: ids.schoolA })).resolves.toBeTruthy();
    await expect(t.withIdentity(denied).query(getCatalogue, { schoolId: ids.schoolA })).rejects.toThrow("Not found or access denied");
    await expect(t.withIdentity(denied).query(getPublicationReview, { schoolId: ids.schoolA })).rejects.toThrow("Not found or access denied");
  });

  test("sensitive form publication rechecks privacy evidence expiry", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const identity = { subject: "publisher", tokenIdentifier: "issuer|publisher", issuer: "issuer" };
    const user = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Publisher", email: "publisher@example.test", role: "teacher", createdAt: Date.now(), updatedAt: Date.now() }));
    await t.run(async (ctx) => { for (const capability of ["admissions.catalogue.manage", "admissions.publish", "admissions.sensitive.configure"] as const) await ctx.db.insert("schoolCapabilityGrants", { schoolId: ids.schoolA, userId: user, capability, scope: "school", grantedByUserId: user, reason: "publication test", isBreakGlass: false, createdAt: Date.now() }); });
    const draft = await t.withIdentity(identity).mutation((api as any).functions.admissions.settings.createDraftForm, { schoolId: ids.schoolA, programmeId: ids.programme, intakeId: ids.intake, schemaVersion: "privacy-gate" });
    const evidence = await t.run((ctx) => ctx.db.insert("schoolApprovalEvidence", { schoolId: ids.schoolA, approvalClass: "privacy", subjectType: "admissions_field", subjectKey: "medical-history", evidenceReference: "privacy-ticket", approvedByUserId: user, approvedAt: Date.now() - 1_000, expiresAt: Date.now() + 60_000, createdAt: Date.now() }));
    await t.withIdentity(identity).mutation((api as any).functions.admissions.settings.addDraftField, { formVersionId: draft, fieldKey: "medical-history", sectionKey: "support", kind: "textarea", label: "Medical history", requiredMode: "optional", dataClass: "highly_sensitive", purpose: "support planning", retentionPolicyKey: "admissions-v1", audience: "admissions-reviewers", approvalEvidenceId: evidence, validationJson: "{}", order: 1 });
    await t.run((ctx) => ctx.db.patch(evidence, { expiresAt: Date.now() - 1 }));
    await expect(t.withIdentity(identity).mutation((api as any).functions.admissions.settings.publishForm, { formVersionId: draft })).rejects.toThrow("Sensitive configuration approval is unavailable");
  });

  test("verified refund voids the entitlement and places a durable finance hold on a consumed application", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const paid = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId: paid.entitlementId });
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Child", lastName: "One", dateOfBirth: 1 });
    await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: application.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: true });
    const reversal = await t.run((ctx) => ctx.db.insert("admissionsPaymentEvents", { schoolId: ids.schoolA, purchaseAttemptId: ids.attempt, provider: "paystack", providerMode: "test", providerEventId: "refund-1", eventType: "charge.refund", bodyDigest: "refund", signatureValid: true, processingStatus: "verified", receivedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() }));
    await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: reversal });
    expect(await t.run((ctx) => ctx.db.get(paid.entitlementId))).toMatchObject({ state: "refunded" });
    expect(await t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ financeBlockedReason: "PAYMENT_REFUNDED" });
    expect(await t.run((ctx) => ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application.applicationId).eq("state", "active")).unique())).toBeTruthy();
  });

  test("rejects unlisted change-request answers and non-applicable conditional answers", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const controlling = await t.run((ctx) => ctx.db.insert("admissionsFormFields", { schoolId: ids.schoolA, formVersionId: ids.form, fieldKey: "support-needed", sectionKey: "support", kind: "select", label: "Support", requiredMode: "optional", dataClass: "personal", validationJson: JSON.stringify({ choices: ["yes", "no"] }), order: 1, status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    const conditional = await t.run((ctx) => ctx.db.insert("admissionsFormFields", { schoolId: ids.schoolA, formVersionId: ids.form, fieldKey: "support-detail", sectionKey: "support", kind: "text", label: "Detail", requiredMode: "conditional", dataClass: "personal", validationJson: "{}", conditionalRuleJson: JSON.stringify({ fieldKey: "support-needed", equals: "yes" }), order: 2, status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: conditional, expectedVersion: 1, valueType: "text", serializedValue: "not applicable" })).rejects.toThrow("ANSWER_NOT_APPLICABLE");
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: controlling, expectedVersion: 1, valueType: "select", serializedValue: "no" });
    await t.run((ctx) => ctx.db.patch(application.applicationId, { state: "changes_requested", changeRequestFieldKeys: ["support-needed"], changeRequestRequirementKeys: [], updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: conditional, expectedVersion: version, valueType: "text", serializedValue: "still blocked" })).rejects.toThrow("ANSWER_NOT_APPLICABLE");
  });

  test("change requests lock unrelated core fields", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Child", lastName: "Locked", dateOfBirth: 1 });
    await t.run((ctx) => ctx.db.patch(application.applicationId, { state: "changes_requested", changeRequestCoreKeys: ["firstName"], changeRequestFieldKeys: [], changeRequestRequirementKeys: [], updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: version, firstName: "Allowed", lastName: "Changed illegally", dateOfBirth: 1 })).rejects.toThrow("CORE_FIELD_LOCKED");
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: version, firstName: "Allowed", lastName: "Locked", dateOfBirth: 1 })).resolves.toBe(version + 1);
  });

  test("rejects client serialization type spoofing", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const field = await t.run((ctx) => ctx.db.insert("admissionsFormFields", { schoolId: ids.schoolA, formVersionId: ids.form, fieldKey: "age", sectionKey: "child", kind: "number", label: "Age", requiredMode: "optional", dataClass: "personal", validationJson: JSON.stringify({ min: 1 }), order: 1, status: "active", createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application.applicationId, formFieldId: field, expectedVersion: 1, valueType: "text", serializedValue: "not-a-number" })).rejects.toThrow("ANSWER_INVALID");
  });

  test("rejected required documents cannot satisfy submission", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const requirement = await t.run((ctx) => ctx.db.insert("admissionsDocumentRequirements", { schoolId: ids.schoolA, formVersionId: ids.form, requirementKey: "identity", category: "identity", label: "Identity", requiredMode: "required", acceptedMimeTypes: ["image/jpeg"], maxBytes: 100, maxFiles: 1, sensitivity: "highly_sensitive", purpose: "identity", order: 1, createdAt: Date.now(), updatedAt: Date.now() }));
    const { entitlementId } = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    const application = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.createOrResume, { entitlementId });
    const version = await t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.saveCoreSection, { applicationId: application.applicationId, expectedVersion: 1, firstName: "Child", lastName: "One", dateOfBirth: 1 });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "image/jpeg" })));
    await t.run((ctx) => ctx.db.insert("admissionsDocuments", { schoolId: ids.schoolA, applicationId: application.applicationId, requirementId: requirement, category: "identity", documentKey: "doc_rejected", storageId, fileName: "id.jpg", mimeType: "image/jpeg", byteSize: 1, sha256: "digest", version: 1, state: "rejected", sensitivity: "highly_sensitive", uploadedByGuardianId: ids.guardian, retentionHold: false, createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(t.withIdentity(guardianIdentity).mutation((api as any).functions.admissions.applications.submit, { applicationId: application.applicationId, expectedVersion: version, signerName: "Guardian", signerRelationship: "Parent", declarationVersion: 1, declarationAccepted: true })).rejects.toThrow("APPLICATION_INCOMPLETE");
  });

  test("reversal before fulfilment is durable and replay-safe", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const reversal = await t.run((ctx) => ctx.db.insert("admissionsPaymentEvents", { schoolId: ids.schoolA, purchaseAttemptId: ids.attempt, provider: "paystack", providerMode: "test", providerEventId: "reverse-before-paid", eventType: "charge.reversed", bodyDigest: "reverse", signatureValid: true, processingStatus: "verified", receivedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() }));
    expect(await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: reversal })).toEqual({ entitlementId: null, replayed: false });
    expect(await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: reversal })).toEqual({ entitlementId: null, replayed: true });
    expect(await t.run((ctx) => ctx.db.get(ids.attempt))).toMatchObject({ state: "reversed" });
  });

  test("a delayed success cannot resurrect a reversed attempt", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const reversal = await t.run((ctx) => ctx.db.insert("admissionsPaymentEvents", { schoolId: ids.schoolA, purchaseAttemptId: ids.attempt, provider: "paystack", providerMode: "test", providerEventId: "reverse-first", eventType: "charge.reversed", bodyDigest: "reverse", signatureValid: true, processingStatus: "verified", receivedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() }));
    await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: reversal });
    const delayed = await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    expect(delayed).toEqual({ entitlementId: null, replayed: true });
    expect(await t.run((ctx) => ctx.db.get(ids.attempt))).toMatchObject({ state: "reversed" });
    expect(await t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", ids.attempt)).take(2))).toEqual([]);
  });

  test("refund remains terminal across repeated mixed-order payment events", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    const refund = await t.run((ctx) => ctx.db.insert("admissionsPaymentEvents", { schoolId: ids.schoolA, purchaseAttemptId: ids.attempt, provider: "paystack", providerMode: "test", providerEventId: "refund-first", eventType: "refund.processed", bodyDigest: "refund", signatureValid: true, processingStatus: "verified", receivedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() }));
    const pending = await t.run((ctx) => ctx.db.insert("admissionsPaymentEvents", { schoolId: ids.schoolA, purchaseAttemptId: ids.attempt, provider: "paystack", providerMode: "test", providerEventId: "pending-late", eventType: "charge.pending", bodyDigest: "pending", signatureValid: true, processingStatus: "verified", receivedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() }));
    await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: refund });
    await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: pending });
    await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    await t.mutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: ids.event });
    expect(await t.run((ctx) => ctx.db.get(ids.attempt))).toMatchObject({ state: "refunded" });
    expect(await t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", ids.attempt)).take(2))).toEqual([]);
  });

  test("owned receipt state remains truthful after a terminal finance event", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t);
    await t.run((ctx) => ctx.db.patch(ids.attempt, { state: "chargeback", updatedAt: Date.now() }));
    const receipt = await t.withIdentity(guardianIdentity).action((api as any).functions.admissions.payments.verifyReturn, { attemptId: ids.attempt });
    expect(receipt).toEqual({ state: "chargeback", entitlementId: null });
  });

  test("Better Auth verification evidence unlocks a newly created guardian without client input", async () => {
    const t = convexTest(schema, modules);
    const identity = { subject: "verified", tokenIdentifier: "issuer|verified", issuer: "issuer", email: "verified@example.test", emailVerified: true };
    const result = await t.withIdentity(identity).mutation((api as any).functions.admissions.guardian.getOrCreateIdentity, {});
    expect(result.verificationRequired).toBe(false);
    expect(await t.run((ctx) => ctx.db.get(result.guardianId))).toMatchObject({ normalizedEmail: "verified@example.test", status: "active" });
  });

  test("the explicit localhost development flag unlocks an unverified test guardian", async () => {
    const priorFlag = process.env.ADMISSIONS_DEV_AUTO_VERIFY_GUARDIANS;
    const priorOrigin = process.env.APPLICATION_ORIGIN;
    process.env.ADMISSIONS_DEV_AUTO_VERIFY_GUARDIANS = "true";
    process.env.APPLICATION_ORIGIN = "http://localhost:3004";
    try {
      const t = convexTest(schema, modules);
      const identity = { subject: "local", tokenIdentifier: "issuer|local", issuer: "issuer", email: "local@example.test", emailVerified: false };
      const result = await t.withIdentity(identity).mutation((api as any).functions.admissions.guardian.getOrCreateIdentity, {});
      expect(result.verificationRequired).toBe(false);
      expect(await t.run((ctx) => ctx.db.get(result.guardianId))).toMatchObject({ normalizedEmail: "local@example.test", status: "active", emailVerifiedAt: expect.any(Number) });
    } finally {
      if (priorFlag === undefined) delete process.env.ADMISSIONS_DEV_AUTO_VERIFY_GUARDIANS;
      else process.env.ADMISSIONS_DEV_AUTO_VERIFY_GUARDIANS = priorFlag;
      if (priorOrigin === undefined) delete process.env.APPLICATION_ORIGIN;
      else process.env.APPLICATION_ORIGIN = priorOrigin;
    }
  });

  test("scheduled recovery makes stale conversion and outbox leases retryable without duplicating records", async () => {
    const t = convexTest(schema, modules); const ids = await fixture(t); const old = Date.now() - 60 * 60 * 1000;
    const entitlement = await t.run((ctx) => ctx.db.insert("admissionsEntitlements", { schoolId: ids.schoolA, guardianId: ids.guardian, productId: ids.product, intakeId: ids.intake, sourcePurchaseAttemptId: ids.attempt, state: "consumed", createdAt: old, updatedAt: old }));
    const application = await t.run((ctx) => ctx.db.insert("admissionsApplications", { schoolId: ids.schoolA, guardianId: ids.guardian, entitlementId: entitlement, programmeId: ids.programme, intakeId: ids.intake, productId: ids.product, priceId: ids.price, formVersionId: ids.form, declarationVersionId: ids.declaration, publicId: "recovery-app", state: "accepted", currentRevision: 1, draftVersion: 1, createdAt: old, updatedAt: old }));
    // Build the recovery-only fixture directly; no canonical student is created.
    const staff = await t.run((ctx) => ctx.db.insert("users", { schoolId: ids.schoolA, authId: "recovery-staff", name: "Recovery Staff", email: "recovery@example.test", role: "admin", createdAt: old, updatedAt: old }));
    const decision = await t.run((ctx) => ctx.db.insert("admissionsDecisions", { schoolId: ids.schoolA, applicationId: application, version: 1, state: "accepted", reasonCode: "approved", decidedBy: staff, decidedAt: old, createdAt: old }));
    const snapshot = await t.run((ctx) => ctx.db.insert("admissionsSubmissionSnapshots", { schoolId: ids.schoolA, applicationId: application, revision: 1, formVersionId: ids.form, declarationVersionId: ids.declaration, productPriceId: ids.price, requirementsDigest: "r", canonicalDigest: "c", signerGuardianId: ids.guardian, signerName: "Guardian", signerRelationship: "Parent", submittedAt: old, declarationAcceptedAt: old, createdAt: old }));
    const conversion = await t.run((ctx) => ctx.db.insert("admissionsConversions", { schoolId: ids.schoolA, applicationId: application, acceptedDecisionId: decision, snapshotId: snapshot, idempotencyKey: "recover", state: "running", leaseOwner: "dead-worker", leaseExpiresAt: old, attemptCount: 1, createdAt: old, updatedAt: old }));
    const outbox = await t.run((ctx) => ctx.db.insert("admissionsCommunicationOutbox", { schoolId: ids.schoolA, applicationId: application, conversionId: conversion, eventKey: "portal_onboarding", recipientGuardianId: ids.guardian, channel: "email", templateKey: "portal", templateVersion: "1", state: "sending", nextAttemptAt: old, createdAt: old, updatedAt: old }));
    const result = await t.mutation((internal as any).functions.admissions.recovery.sweep, { now: Date.now(), staleAfterMs: 60_000 });
    expect(result).toEqual({ conversionsRecovered: 1, outboxRecovered: 1 });
    expect(await t.run((ctx) => ctx.db.get(conversion))).toMatchObject({ state: "failed_retryable", errorCode: "STALE_LEASE" });
    expect(await t.run((ctx) => ctx.db.get(outbox))).toMatchObject({ state: "pending" });
    expect(await t.run((ctx) => ctx.db.query("students").take(1))).toEqual([]);
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
