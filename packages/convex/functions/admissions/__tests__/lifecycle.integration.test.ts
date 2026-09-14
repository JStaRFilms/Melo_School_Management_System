import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { internal } from "../../../_generated/api";
import { seedReviewedTenantOperatorWithCapabilities } from "../../academic/__tests__/securityFixtures";
import { listCampaignsRef, listGuardianWorkspaceBySlugRef, listPublishedOfferingsRef, recordVerifiedPaymentRef } from "../refs";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const rateLimiterModules = import.meta.glob("../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts");

const guardianIdentityRef = makeFunctionReference<"mutation", Record<string, never>, { guardianId: Id<"admissionsGuardians">; normalizedEmail: string; emailVerifiedAt: number }>("functions/admissions/guardian:getOrCreateIdentity");
const createCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:createCampaignDraft");
const approveCampaignPriceTermsRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:approveCampaignPriceTerms");
const approveCampaignPublicationRequirementsRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:approveCampaignPublicationRequirements");
const publishCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:publishCampaign");
const closeCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:closeCampaign");
const replacementCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:createReplacementDraft");
const editCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:editCampaignDraft");
const offeringRef = makeFunctionReference<"query">("functions/admissions/catalogue:getPublishedOffering");
const createAttemptRef = makeFunctionReference<"mutation">("functions/admissions/payments:createAttempt");
const initializeAttemptRef = makeFunctionReference<"action">("functions/admissions/payments:initializeAttempt");
const verifyReturnRef = makeFunctionReference<"action">("functions/admissions/payments:verifyReturn");
const createApplicationRef = makeFunctionReference<"mutation">("functions/admissions/applications:createOrResume");
const saveDraftRef = makeFunctionReference<"mutation">("functions/admissions/applications:saveDraft");
const getDraftRef = makeFunctionReference<"query">("functions/admissions/applications:getDraft");
const submitRef = makeFunctionReference<"mutation">("functions/admissions/applications:submit");
const getApplicationDetailRef = makeFunctionReference<"query">("functions/admissions/staff:getApplicationDetail");
const revealSensitiveApplicationDetailRef = makeFunctionReference<"mutation">("functions/admissions/staff:revealSensitiveApplicationDetail");
const startReviewRef = makeFunctionReference<"mutation">("functions/admissions/staff:startReview");
const requestChangesRef = makeFunctionReference<"mutation">("functions/admissions/staff:requestChanges");
const decisionRef = makeFunctionReference<"mutation">("functions/admissions/staff:recordDecision");
const markReadyRef = makeFunctionReference<"mutation">("functions/admissions/staff:markReadyForDecision");
const evaluationRef = makeFunctionReference<"mutation">("functions/admissions/staff:recordEvaluation");
const reviewStateRef = makeFunctionReference<"query">("functions/admissions/staff:getLatestReviewState");
const resumeWaitlistedRef = makeFunctionReference<"mutation">("functions/admissions/staff:resumeWaitlisted");
const reopenDecisionRef = makeFunctionReference<"mutation">("functions/admissions/staff:reopenDecision");
const documentReviewRef = makeFunctionReference<"mutation">("functions/admissions/staff:recordDocumentReview");
const documentAccessRef = makeFunctionReference<"mutation">("functions/admissions/staff:getDocumentAccess");
const consumeStaffDocumentAccessGrantRef = makeFunctionReference<"mutation">("functions/admissions/staff:consumeDocumentAccessGrant");
const workflowRef = makeFunctionReference<"query">("functions/admissions/staff:getApplicationWorkflow");
const conversionWorkflowRef = makeFunctionReference<"query">("functions/admissions/staff:getConversionWorkflow");
const ownedApplicationRef = makeFunctionReference<"query">("functions/admissions/applications:getOwnedApplicationByPublicId");

type CampaignIds = {
  programmeId: Id<"admissionsProgrammes">;
  intakeId: Id<"admissionsIntakes">;
  formVersionId: Id<"admissionsFormVersions">;
  declarationVersionId: Id<"admissionsDeclarationVersions">;
  productId: Id<"admissionsProducts">;
  priceId: Id<"admissionsProductPrices">;
  draftRevision: string;
};

async function fixture() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Admissions School", slug: "admissions-school", status: "active", features: { billing: true, curriculum: true, knowledgeLibrary: true, admissions: true }, createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "other-school", status: "active", createdAt: now, updatedAt: now });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "primary", createdAt: now, updatedAt: now });
    const staff = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|admissions-staff", ["enrollment.intakes.manage", "enrollment.applications.list", "enrollment.applications.view_basic", "enrollment.applications.view_sensitive", "enrollment.documents.review", "enrollment.decisions.record", "enrollment.admissions.override_number", "finance.fee_plans.manage"]);
    const limited = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|limited-staff", ["enrollment.applications.view_basic"]);
    await ctx.db.insert("schoolPaymentProviders", { schoolId, provider: "paystack", mode: "test", isEnabled: true, status: "ready", publicKey: "pk_test", publicKeyMasked: "pk_***", publicKeyFingerprint: "fingerprint", activeSecretMasked: "sk_***", pendingSecretMasked: null, activeSecretId: null, pendingSecretId: null, activeSecretFingerprint: null, pendingSecretFingerprint: null, lastValidatedAt: now, lastValidationMessage: "ready", createdAt: now, updatedAt: now, createdBy: staff.memberships[0].userId, updatedBy: staff.memberships[0].userId });
    return { schoolId, otherSchoolId, classId, staffUserId: staff.memberships[0].userId, limitedUserId: limited.memberships[0].userId };
  });
  const staff = t.withIdentity({ tokenIdentifier: "test|admissions-staff", subject: "admissions-staff", issuer: "test" });
  const freshStaff = t.withIdentity({ tokenIdentifier: "test|admissions-staff", subject: "admissions-staff", issuer: "test", authenticatedAt: Date.now() });
  const limited = t.withIdentity({ tokenIdentifier: "test|limited-staff", subject: "limited-staff", issuer: "test" });
  const guardian = t.withIdentity({ tokenIdentifier: "test|guardian-one", subject: "guardian-one", issuer: "test", email: "guardian@example.test", emailVerified: true });
  const otherGuardian = t.withIdentity({ tokenIdentifier: "test|guardian-two", subject: "guardian-two", issuer: "test", email: "other@example.test", emailVerified: true });
  const campaign = await staff.mutation(createCampaignRef, {
    schoolId: ids.schoolId,
    programmeSlug: "primary",
    programmeName: "Primary",
    intakeSlug: "2026",
    intakeName: "2026 Intake",
    cycleLabel: "2026/27",
    targetClassId: ids.classId,
    opensAt: Date.now() - 10_000,
    closesAt: Date.now() + 1_000_000,
    schemaVersion: "1",
    fields: [{ fieldKey: "reason", sectionKey: "child", kind: "text", label: "Reason", requiredMode: "required", dataClass: "personal", purpose: "Understand the application", validationJson: "{}", order: 1 }],
    requirements: [],
    declarationTitle: "Declaration",
    declarationBody: "I confirm this application is accurate.",
    declarationPurpose: "Application attestation",
    productSlug: "application-slot",
    productName: "Application slot",
    amountMinor: 500_000,
    currency: "NGN",
    refundPolicyKey: "non-refundable",
    feeDisclosure: "Application processing fee",
    effectiveFrom: Date.now() - 10_000,
  }) as CampaignIds;
  const initialDraft = (await staff.query(listCampaignsRef, { schoolId: ids.schoolId, now: Date.now() })).find((item) => item.priceId === campaign.priceId);
  if (!initialDraft) throw new Error("Initial campaign draft missing");
  const priceApproval = await staff.mutation(approveCampaignPriceTermsRef, { schoolId: ids.schoolId, priceId: campaign.priceId, expectedSubjectKey: initialDraft.priceApprovalSubjectKey }) as { approvalEvidenceId: Id<"schoolApprovalEvidence">; subjectKey: string; replayed: boolean };
  expect(priceApproval).toMatchObject({ subjectKey: initialDraft.priceApprovalSubjectKey, replayed: false });
  await staff.mutation(publishCampaignRef, { ...campaign, draftRevision: campaign.draftRevision });
  await guardian.mutation(guardianIdentityRef, {});
  await otherGuardian.mutation(guardianIdentityRef, {});
  return { t, staff, freshStaff, limited, guardian, otherGuardian, campaign, ...ids };
}

async function paidApplication(f: Awaited<ReturnType<typeof fixture>>, key = "purchase-key-1") {
  const attempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: key }) as { attemptId: Id<"admissionsPurchaseAttempts">; reference: string; amountMinor: number; currency: string; replayed: boolean };
  const payment = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: `event-${key}`, eventType: "charge.success", bodyDigest: `digest-${key}`, amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  if (!payment.entitlementId) throw new Error("Expected paid entitlement");
  const application = await f.guardian.mutation(createApplicationRef, { entitlementId: payment.entitlementId }) as { applicationId: Id<"admissionsApplications">; replayed: boolean };
  return { attempt, payment, application };
}

async function addRequiredDocument(f: Awaited<ReturnType<typeof fixture>>, applicationId: Id<"admissionsApplications">, key: string) {
  return await f.t.run(async (ctx) => {
    const now = Date.now();
    const application = await ctx.db.get(applicationId);
    if (!application) throw new Error("Application missing");
    const requirementId = await ctx.db.insert("admissionsDocumentRequirements", { schoolId: f.schoolId, formVersionId: application.formVersionId, requirementKey: key, category: "identity", label: "Identity evidence", requiredMode: "required", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 2, sensitivity: "personal", purpose: "Identity review", order: 2, createdAt: now, updatedAt: now });
    const storageId = await ctx.storage.store(new Blob(["identity evidence"], { type: "application/pdf" }));
    const documentKey = `${key}-v1`;
    await ctx.db.insert("admissionsDocuments", { schoolId: f.schoolId, applicationId, requirementId, category: "identity", documentKey, storageId, fileName: `${key}.pdf`, mimeType: "application/pdf", byteSize: 17, sha256: `${key}-digest`, version: 1, state: "uploaded", sensitivity: "personal", uploadedByGuardianId: application.guardianId, retentionHold: false, createdAt: now, updatedAt: now });
    return { requirementId, documentKey };
  });
}

it("serves the restored UI read models without caller-supplied guardian identity", async () => {
  const f = await fixture();
  const campaigns = await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() });
  expect(campaigns).toHaveLength(1);
  expect(campaigns[0]).toMatchObject({ lifecycle: "published", programmeSlug: "primary", amountMinor: 500_000 });
  const landing = await f.t.query(listPublishedOfferingsRef, { schoolSlug: "admissions-school", now: Date.now() });
  expect(landing).toMatchObject({ available: true, offerings: [{ intakeSlug: "2026", availability: "open", amountMinor: 500_000 }] });
  const attempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "ui-owned-workspace" });
  const payment = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "event-ui-owned-workspace", eventType: "charge.success", bodyDigest: "digest-ui-owned-workspace", amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  if (!payment.entitlementId) throw new Error("Expected paid entitlement");
  const availableWorkspace = await f.guardian.query(listGuardianWorkspaceBySlugRef, { schoolSlug: "admissions-school" });
  expect(availableWorkspace.entitlements).toEqual([expect.objectContaining({ entitlementId: payment.entitlementId, state: "available" })]);
  const application = await f.guardian.mutation(createApplicationRef, { entitlementId: payment.entitlementId });
  const workspace = await f.guardian.query(listGuardianWorkspaceBySlugRef, { schoolSlug: "admissions-school" });
  expect(workspace.applications).toEqual([expect.objectContaining({ applicationId: application.applicationId })]);
  const otherWorkspace = await f.otherGuardian.query(listGuardianWorkspaceBySlugRef, { schoolSlug: "admissions-school" });
  expect(otherWorkspace.applications).toEqual([]);
});

it("keeps admissions unavailable unless the school feature is explicitly enabled", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.schoolId, { features: undefined }));

  await expect(f.t.query(listPublishedOfferingsRef, { schoolSlug: "admissions-school", now: Date.now() })).resolves.toEqual({ available: false });
  await expect(f.t.query(offeringRef, { schoolSlug: "admissions-school", intakeSlug: "2026", now: Date.now() })).resolves.toMatchObject({ available: false, link: { availability: "unavailable" } });
  await expect(f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "disabled-feature" })).rejects.toThrow("unavailable");
});

it("enforces the module boundary on direct staff and guardian writes while preserving paid ownership and settlement recovery", async () => {
  const f = await fixture();
  const paid = await paidApplication(f, "module-paid-application");
  const unsettled = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "module-unsettled" });
  await f.t.run(async (ctx) => {
    const school = await ctx.db.get(f.schoolId);
    if (!school?.features) throw new Error("School features missing");
    await ctx.db.patch(f.schoolId, { features: { ...school.features, admissions: false } });
  });

  await expect(f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() })).rejects.toThrow("Admissions is unavailable");
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: paid.application.applicationId, expectedVersion: 0, mutationKey: "disabled-save", answers: [] })).rejects.toThrow("Admissions is unavailable");
  await expect(f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "disabled-new-attempt" })).rejects.toThrow("unavailable");
  await expect(f.guardian.action(initializeAttemptRef, { reference: unsettled.reference, confirmedTermsDigest: unsettled.terms.termsDigest })).rejects.toThrow("Payment initialization is unavailable");

  await expect(f.guardian.query(getDraftRef, { applicationId: paid.application.applicationId })).resolves.toMatchObject({ state: "draft" });
  await expect(f.guardian.query(listGuardianWorkspaceBySlugRef, { schoolSlug: "admissions-school" })).resolves.toMatchObject({ applications: [expect.objectContaining({ applicationId: paid.application.applicationId })] });
  if (!paid.payment.entitlementId) throw new Error("Paid entitlement missing");
  await expect(f.guardian.mutation(createApplicationRef, { entitlementId: paid.payment.entitlementId })).resolves.toMatchObject({ applicationId: paid.application.applicationId, replayed: true });

  const settled = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: unsettled.attemptId, provider: "paystack", providerMode: "test", providerEventId: "module-disabled-settlement", eventType: "charge.success", bodyDigest: "module-disabled-digest", amountMinor: unsettled.amountMinor, currency: unsettled.currency, receivedAt: Date.now() });
  expect(settled).toMatchObject({ state: "paid", processed: true });
  if (!settled.entitlementId) throw new Error("Settlement entitlement missing");
  await expect(f.guardian.mutation(createApplicationRef, { entitlementId: settled.entitlementId })).resolves.toMatchObject({ replayed: false });
});

it("fails closed instead of adopting one of two unresolved legacy purchase attempts", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const guardian = await ctx.db.query("admissionsGuardians").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", "test|guardian-one")).unique();
    if (!guardian) throw new Error("Guardian missing");
    const now = Date.now();
    const baseAttempt = { schoolId: f.schoolId, guardianId: guardian._id, productId: f.campaign.productId, priceId: f.campaign.priceId, provider: "paystack" as const, providerMode: "test" as const, amountMinor: 500_000, currency: "NGN", feeDisclosureSnapshot: "Application processing fee", state: "verification_pending" as const, createdAt: now, updatedAt: now };
    await ctx.db.insert("admissionsPurchaseAttempts", { ...baseAttempt, reference: "adm_legacy_one", idempotencyKey: "legacy-one" });
    await ctx.db.insert("admissionsPurchaseAttempts", { ...baseAttempt, reference: "adm_legacy_two", idempotencyKey: "legacy-two", createdAt: now + 1, updatedAt: now + 1 });
  });

  await expect(f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "new-client-key" })).rejects.toThrow("PAYMENT_REVIEW_REQUIRED");
  expect(await f.t.run((ctx) => ctx.db.query("admissionsPurchaseGuards").withIndex("by_school_and_guardian_and_product", (q) => q.eq("schoolId", f.schoolId)).take(10))).toEqual([]);
});

it("replays immutable purchase terms and rejects initialization under a different confirmation", async () => {
  const f = await fixture();
  const attempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "immutable-terms-original" });
  await f.t.run((ctx) => ctx.db.patch(f.campaign.priceId, { amountMinor: 600_000, currency: "USD", feeDisclosure: "Changed fee", refundPolicyKey: "changed-policy" }));
  const replay = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "immutable-terms-replay" });
  expect(replay).toMatchObject({ attemptId: attempt.attemptId, replayed: true, terms: { amountMinor: 500_000, currency: "NGN", feeDisclosure: "Application processing fee", refundPolicyKey: "non-refundable", termsDigest: attempt.terms.termsDigest } });
  expect(JSON.stringify(replay.terms)).not.toMatch(/priceId|productId|attemptId/);
  const workspace = await f.guardian.query(listGuardianWorkspaceBySlugRef, { schoolSlug: "admissions-school" });
  expect(workspace.attempts[0]).toMatchObject({ reference: attempt.reference, terms: attempt.terms });
  await expect(f.guardian.action(initializeAttemptRef, { reference: attempt.reference, confirmedTermsDigest: "different-confirmed-terms" })).rejects.toThrow("Confirmed payment terms do not match");
  expect(await f.t.run((ctx) => ctx.db.get(attempt.attemptId))).toMatchObject({ state: "created", refundPolicySnapshot: "non-refundable" });
});

it("component-limits concurrent checkout creation without charging idempotent replays", async () => {
  const f = await fixture();
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
    f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: `rate-attempt-${index}` }),
  ));
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(6);
  const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value as { attemptId: Id<"admissionsPurchaseAttempts"> }] : []);
  expect(new Set(fulfilled.map((attempt) => attempt.attemptId)).size).toBe(1);
  const firstAttempt = fulfilled[0];
  if (!firstAttempt) throw new Error("First checkout attempt was unexpectedly denied");
  await expect(f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "rate-attempt-new-client-key" })).resolves.toMatchObject({ attemptId: firstAttempt.attemptId, replayed: true });
  await expect(f.otherGuardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "other-guardian-attempt" })).resolves.toMatchObject({ replayed: false });
  const attempts = await f.t.run((ctx) => ctx.db.query("admissionsPurchaseAttempts").withIndex("by_school", (q) => q.eq("schoolId", f.schoolId)).take(10));
  expect(attempts.filter((attempt) => attempt.guardianId !== undefined)).toHaveLength(2);
});

it("returns canonical apply links and rejects stale campaign draft overwrites", async () => {
  const f = await fixture();
  const published = (await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() }))[0];
  expect(published.applicationLink).toMatchObject({ version: "1", schoolSlug: "admissions-school", intakeSlug: "2026" });
  expect(published.applicationLink.href).toMatch(/\/s\/admissions-school\/i\/2026$/);
  const replacement = await f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: published.programmeId, intakeId: published.intakeId, productId: published.productId, schemaVersion: published.schemaVersion, fields: published.fields, requirements: published.requirements, declarationTitle: published.declarationTitle, declarationBody: published.declarationBody, declarationPurpose: published.declarationPurpose, amountMinor: published.amountMinor, currency: published.currency, refundPolicyKey: published.refundPolicyKey, feeDisclosure: published.feeDisclosure, effectiveFrom: Date.now() });
  const draft = (await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() })).find((item) => item.lifecycle === "draft");
  if (!draft) throw new Error("replacement draft missing");
  expect(draft.draftRevision).toBe(replacement.draftRevision);
  const editArgs = { schoolId: f.schoolId, programmeId: draft.programmeId, intakeId: draft.intakeId, formVersionId: draft.formVersionId, declarationVersionId: draft.declarationVersionId, productId: draft.productId, priceId: draft.priceId, programmeSlug: draft.programmeSlug, programmeName: "Primary updated", ...(draft.programmeDescription ? { programmeDescription: draft.programmeDescription } : {}), intakeSlug: draft.intakeSlug, intakeName: draft.intakeName, cycleLabel: draft.cycleLabel, opensAt: draft.opensAt, closesAt: draft.closesAt, schemaVersion: draft.schemaVersion, fields: draft.fields, requirements: draft.requirements, declarationTitle: draft.declarationTitle, declarationBody: draft.declarationBody, declarationPurpose: draft.declarationPurpose, productSlug: draft.productSlug, productName: draft.productName, amountMinor: draft.amountMinor, currency: draft.currency, refundPolicyKey: draft.refundPolicyKey, feeDisclosure: draft.feeDisclosure, effectiveFrom: draft.effectiveFrom, expectedDraftRevision: draft.draftRevision };
  const edited = await f.staff.mutation(editCampaignRef, editArgs);
  expect(edited.draftRevision).not.toBe(draft.draftRevision);
  await expect(f.staff.mutation(editCampaignRef, { ...editArgs, programmeName: "Stale overwrite" })).rejects.toThrow("CAMPAIGN_DRAFT_CONFLICT");
  await expect(f.staff.mutation(publishCampaignRef, { programmeId: draft.programmeId, intakeId: draft.intakeId, formVersionId: draft.formVersionId, declarationVersionId: draft.declarationVersionId, productId: draft.productId, priceId: draft.priceId, draftRevision: draft.draftRevision })).rejects.toThrow("CAMPAIGN_DRAFT_CONFLICT");
  const otherDraft = await f.staff.mutation(createCampaignRef, { schoolId: f.schoolId, programmeSlug: "secondary", programmeName: "Secondary", intakeSlug: "2027", intakeName: "2027 Intake", cycleLabel: draft.cycleLabel, opensAt: draft.opensAt, closesAt: draft.closesAt, schemaVersion: draft.schemaVersion, fields: draft.fields, requirements: draft.requirements, declarationTitle: draft.declarationTitle, declarationBody: draft.declarationBody, declarationPurpose: draft.declarationPurpose, productSlug: "secondary-slot", productName: "Secondary slot", amountMinor: draft.amountMinor, currency: draft.currency, refundPolicyKey: draft.refundPolicyKey, feeDisclosure: draft.feeDisclosure, effectiveFrom: draft.effectiveFrom });
  await expect(f.staff.mutation(editCampaignRef, { ...editArgs, priceId: otherDraft.priceId, expectedDraftRevision: edited.draftRevision })).rejects.toThrow("not found");
  expect((await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() })).find((item) => item.formVersionId === draft.formVersionId)?.programmeName).toBe("Primary updated");
});

it("publishes only the immutable campaign projection and deduplicates verified payment, entitlement, and application replays", async () => {
  const f = await fixture();
  const offering = await f.t.query(offeringRef, { schoolSlug: "admissions-school", intakeSlug: "2026", now: Date.now() });
  expect(offering).toMatchObject({ available: true, product: { slug: "application-slot" }, price: { amountMinor: 500_000, currency: "NGN" } });
  expect(JSON.stringify(offering)).not.toContain("storageId");

  const firstAttempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "same-purchase" }) as { attemptId: Id<"admissionsPurchaseAttempts">; reference: string; amountMinor: number; currency: string };
  const replayAttempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "same-purchase" });
  expect(replayAttempt).toMatchObject({ attemptId: firstAttempt.attemptId, reference: firstAttempt.reference, replayed: true });
  const paymentArgs = { schoolId: f.schoolId, purchaseAttemptId: firstAttempt.attemptId, provider: "paystack" as const, providerMode: "test" as const, providerEventId: "provider-event-1", eventType: "charge.success", bodyDigest: "payment-digest", amountMinor: firstAttempt.amountMinor, currency: firstAttempt.currency, receivedAt: Date.now() };
  const paid = await f.t.mutation(recordVerifiedPaymentRef, paymentArgs);
  const paidReplay = await f.t.mutation(recordVerifiedPaymentRef, paymentArgs);
  expect(paid.entitlementId).not.toBeNull();
  expect(paidReplay).toMatchObject({ entitlementId: paid.entitlementId, replayed: true, processed: true });
  expect(await f.t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", firstAttempt.attemptId)).collect())).toHaveLength(1);
  if (!paid.entitlementId) throw new Error("Expected entitlement");
  const application = await f.guardian.mutation(createApplicationRef, { entitlementId: paid.entitlementId });
  const applicationReplay = await f.guardian.mutation(createApplicationRef, { entitlementId: paid.entitlementId });
  expect(applicationReplay).toMatchObject({ applicationId: application.applicationId, replayed: true });
  await expect(f.otherGuardian.mutation(createApplicationRef, { entitlementId: paid.entitlementId })).rejects.toThrow("not found");

  const mismatchAttempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "amount-mismatch" }) as { attemptId: Id<"admissionsPurchaseAttempts"> };
  const mismatch = await f.t.mutation(recordVerifiedPaymentRef, { ...paymentArgs, purchaseAttemptId: mismatchAttempt.attemptId, providerEventId: "provider-event-2", bodyDigest: "other-digest", amountMinor: 1 });
  expect(mismatch).toMatchObject({ entitlementId: null, processed: false });
  expect(await f.t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", mismatchAttempt.attemptId)).unique())).toBeNull();
  const successAfterConflict = await f.t.mutation(recordVerifiedPaymentRef, { ...paymentArgs, purchaseAttemptId: mismatchAttempt.attemptId, providerEventId: "provider-event-after-conflict", bodyDigest: "conflict-success-digest" });
  expect(successAfterConflict).toMatchObject({ state: "manual_attention", entitlementId: null });
  await f.t.run((ctx) => ctx.db.patch(mismatchAttempt.attemptId, { state: "failed", failureCode: "TEST_RESOLVED" }));

  const liveAttempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "live-event-identity" });
  await f.t.run((ctx) => ctx.db.patch(liveAttempt.attemptId, { providerMode: "live" }));
  const livePaid = await f.t.mutation(recordVerifiedPaymentRef, { ...paymentArgs, purchaseAttemptId: liveAttempt.attemptId, providerMode: "live", bodyDigest: "live-payment-digest" });
  expect(livePaid).toMatchObject({ replayed: false, processed: true, state: "paid" });
  expect(livePaid.eventId).not.toBe(paid.eventId);
});

it("publishes replacement form, declaration, and positive price versions without stranding a bound draft", async () => {
  const f = await fixture();
  const oldDraft = await paidApplication(f, "old-bound-draft");
  await f.guardian.mutation(saveDraftRef, { applicationId: oldDraft.application.applicationId, expectedVersion: 0, mutationKey: "old-bound-save", requestedEntryLabel: "Primary 1", profile: { firstName: "Amaka", lastName: "Eze", dateOfBirth: Date.UTC(2019, 2, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Original form" }] });
  await expect(f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: f.campaign.programmeId, intakeId: f.campaign.intakeId, productId: f.campaign.productId, schemaVersion: "2", fields: [{ fieldKey: "bad", sectionKey: "child", kind: "script", label: "Bad", requiredMode: "optional", dataClass: "public", validationJson: "{}", order: 1 }], requirements: [], declarationTitle: "Updated", declarationBody: "Updated declaration", declarationPurpose: "Attestation", amountMinor: 0, currency: "NGN", refundPolicyKey: "current", feeDisclosure: "Current fee", effectiveFrom: Date.now() })).rejects.toThrow();
  const replacement = await f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: f.campaign.programmeId, intakeId: f.campaign.intakeId, productId: f.campaign.productId, schemaVersion: "2", fields: [{ fieldKey: "reason", sectionKey: "child", kind: "textarea", label: "Reason", requiredMode: "required", dataClass: "personal", purpose: "Understand the application", validationJson: JSON.stringify({ maxLength: 500 }), order: 1 }], requirements: [{ requirementKey: "birth-certificate", category: "identity", label: "Birth certificate", requiredMode: "required", acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5_000_000, maxFiles: 1, sensitivity: "personal", purpose: "Verify the applicant's identity", order: 1 }], declarationTitle: "Updated", declarationBody: "Updated declaration", declarationPurpose: "Attestation", amountMinor: 600_000, currency: "NGN", refundPolicyKey: "current", feeDisclosure: "Current fee", effectiveFrom: Date.now() - 1 });
  await f.t.run(async (ctx) => {
    const requirement = await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q) => q.eq("formVersionId", replacement.formVersionId).eq("requirementKey", "birth-certificate")).unique();
    expect(requirement).toMatchObject({ sensitivity: "highly_sensitive" });
    if (requirement) await ctx.db.patch(requirement._id, { requiredMode: "optional", sensitivity: "personal" });
  });
  await expect(f.staff.mutation(publishCampaignRef, replacement)).rejects.toThrow("approval evidence");
  const replacementDraft = (await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() })).find((item) => item.priceId === replacement.priceId);
  if (!replacementDraft) throw new Error("Replacement campaign draft missing");
  expect(replacementDraft.requirements[0]).toMatchObject({ category: "identity", requiredMode: "optional", sensitivity: "personal" });
  await expect(f.limited.mutation(approveCampaignPriceTermsRef, { schoolId: f.schoolId, priceId: replacement.priceId, expectedSubjectKey: replacementDraft.priceApprovalSubjectKey })).rejects.toThrow("FORBIDDEN");
  await expect(f.staff.mutation(approveCampaignPriceTermsRef, { schoolId: f.schoolId, priceId: replacement.priceId, expectedSubjectKey: `${replacementDraft.priceApprovalSubjectKey}-stale` })).rejects.toThrow("CAMPAIGN_PRICE_CHANGED");
  const approval = await f.staff.mutation(approveCampaignPriceTermsRef, { schoolId: f.schoolId, priceId: replacement.priceId, expectedSubjectKey: replacementDraft.priceApprovalSubjectKey });
  expect(approval).toMatchObject({ replayed: false, subjectKey: replacementDraft.priceApprovalSubjectKey });
  await expect(f.staff.mutation(approveCampaignPriceTermsRef, { schoolId: f.schoolId, priceId: replacement.priceId, expectedSubjectKey: replacementDraft.priceApprovalSubjectKey })).resolves.toMatchObject({ replayed: true });
  await expect(f.staff.mutation(approveCampaignPublicationRequirementsRef, replacement)).resolves.toMatchObject({ approvedCount: 1, replayedCount: 1 });
  await expect(f.staff.mutation(approveCampaignPublicationRequirementsRef, replacement)).resolves.toMatchObject({ approvedCount: 0, replayedCount: 2 });
  await f.staff.mutation(publishCampaignRef, replacement);
  const offering = await f.t.query(offeringRef, { schoolSlug: "admissions-school", intakeSlug: "2026", now: Date.now() });
  expect(offering).toMatchObject({ available: true, link: { version: "1", availability: "open" }, form: { schemaVersion: "2" }, price: { amountMinor: 600_000 }, declaration: { title: "Updated", version: 2 } });
  expect(await f.t.run((ctx) => ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", f.campaign.intakeId).eq("status", "published")).collect())).toHaveLength(1);
  const submitted = await f.guardian.mutation(submitRef, { applicationId: oldDraft.application.applicationId, expectedVersion: 1, submissionKey: "old-bound-submit", signerName: "Ngozi Eze", signerRelationship: "Guardian", declarationAccepted: true });
  expect(await f.t.run((ctx) => ctx.db.get(submitted.snapshotId))).toMatchObject({ formVersionId: f.campaign.formVersionId, declarationVersionId: f.campaign.declarationVersionId, productPriceId: f.campaign.priceId });
  expect(await f.t.run((ctx) => ctx.db.get(oldDraft.application.applicationId))).toMatchObject({ formVersionId: f.campaign.formVersionId, declarationVersionId: f.campaign.declarationVersionId, priceId: f.campaign.priceId });
});

it("rejects school-wide intake and product slug collisions before they can break public resolvers", async () => {
  const f = await fixture();
  const base = { schoolId: f.schoolId, programmeSlug: "secondary", programmeName: "Secondary", intakeSlug: "2026", intakeName: "Another intake", cycleLabel: "2026/27", opensAt: Date.now() - 1, closesAt: Date.now() + 100_000, schemaVersion: "1", fields: [], requirements: [], declarationTitle: "Declaration", declarationBody: "I confirm", declarationPurpose: "Attestation", productSlug: "another-slot", productName: "Another slot", amountMinor: 500_000, currency: "NGN", refundPolicyKey: "none", feeDisclosure: "Application fee", effectiveFrom: Date.now() - 1 };
  await expect(f.staff.mutation(createCampaignRef, base)).rejects.toThrow("Intake slug");
  await expect(f.staff.mutation(createCampaignRef, { ...base, intakeSlug: "2027", productSlug: "application-slot" })).rejects.toThrow("Product slug");
});

it("lists later programme intakes without rereading a school-wide prefix", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const now = Date.now();
    for (let programmeIndex = 0; programmeIndex < 6; programmeIndex += 1) {
      const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId: f.schoolId, slug: `aux-${programmeIndex}`, name: `Auxiliary ${programmeIndex}`, status: "draft", createdAt: now + programmeIndex, updatedAt: now + programmeIndex });
      for (let intakeIndex = 0; intakeIndex < 10; intakeIndex += 1) await ctx.db.insert("admissionsIntakes", { schoolId: f.schoolId, programmeId, slug: `aux-${programmeIndex}-${intakeIndex}`, name: `Auxiliary ${programmeIndex}-${intakeIndex}`, cycleLabel: "2026", opensAt: now, closesAt: now + 100_000, status: "draft", createdAt: now + intakeIndex, updatedAt: now + intakeIndex });
    }
  });
  await f.staff.mutation(createCampaignRef, { schoolId: f.schoolId, programmeSlug: "later-programme", programmeName: "Later programme", intakeSlug: "later-intake", intakeName: "Later intake", cycleLabel: "2027", opensAt: Date.now(), closesAt: Date.now() + 100_000, schemaVersion: "1", fields: [], requirements: [], declarationTitle: "Declaration", declarationBody: "I confirm", declarationPurpose: "Attestation", productSlug: "later-product", productName: "Later product", amountMinor: 500_000, currency: "NGN", refundPolicyKey: "none", feeDisclosure: "Application fee", effectiveFrom: Date.now() });
  const campaigns = await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() });
  expect(campaigns.some((campaign) => campaign.programmeSlug === "later-programme" && campaign.intakeSlug === "later-intake")).toBe(true);
});

it("allows an owned paid draft to submit after campaign closure while blocking new purchases", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "close-after-purchase");
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "close-draft-save", requestedEntryLabel: "Primary 1", profile: { firstName: "Ada", lastName: "Eze", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "School fit" }] });
  await f.staff.mutation(closeCampaignRef, { schoolId: f.schoolId, intakeId: f.campaign.intakeId });
  await expect(f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "after-close" })).rejects.toThrow("unavailable");
  const closedReplacement = await f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: f.campaign.programmeId, intakeId: f.campaign.intakeId, productId: f.campaign.productId, schemaVersion: "closed-replacement", fields: [], requirements: [], declarationTitle: "Updated", declarationBody: "Updated declaration", declarationPurpose: "Attestation", amountMinor: 500_000, currency: "NGN", refundPolicyKey: "non-refundable", feeDisclosure: "Application processing fee", effectiveFrom: Date.now() - 1 });
  await f.staff.mutation(approveCampaignPublicationRequirementsRef, closedReplacement);
  await f.staff.mutation(publishCampaignRef, closedReplacement);
  expect(await f.t.run((ctx) => ctx.db.get(f.campaign.intakeId))).toMatchObject({ status: "closed" });
  expect(await f.t.run((ctx) => ctx.db.get(f.campaign.productId))).toMatchObject({ status: "paused" });
  await expect(f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "after-closed-replacement" })).rejects.toThrow("unavailable");
  await expect(f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "close-draft-submit", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true })).resolves.toMatchObject({ revision: 1 });
});

it("invalidates digest-bound field and document approvals after same-key edits and requires reapproval", async () => {
  const f = await fixture();
  const forgedEvidenceId = await f.t.run((ctx) => ctx.db.insert("schoolApprovalEvidence", { schoolId: f.schoolId, approvalClass: "privacy", subjectType: "admissions_form", subjectKey: "caller-supplied", evidenceReference: "must not be trusted", approvedByUserId: f.staffUserId, approvedAt: Date.now(), createdAt: Date.now() }));
  const replacement = await f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: f.campaign.programmeId, intakeId: f.campaign.intakeId, productId: f.campaign.productId, schemaVersion: "sensitive", fields: [{ fieldKey: "medical-note", sectionKey: "health", kind: "text", label: "Medical note", requiredMode: "optional", dataClass: "highly_sensitive", purpose: "Applicant support", validationJson: "{}", approvalEvidenceId: forgedEvidenceId, order: 1 }], requirements: [{ requirementKey: "financial-evidence", category: "financial", label: "Financial evidence", requiredMode: "optional", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 1, sensitivity: "financial_security", purpose: "Financial assessment", approvalEvidenceId: forgedEvidenceId, order: 1 }], declarationTitle: "Updated", declarationBody: "Updated declaration", declarationPurpose: "Attestation", amountMinor: 600_000, currency: "NGN", refundPolicyKey: "current", feeDisclosure: "Current fee", priceApprovalEvidenceId: forgedEvidenceId, effectiveFrom: Date.now() - 1 }) as CampaignIds;
  const unapprovedRows = await f.t.run(async (ctx) => ({
    field: await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_field_key", (q) => q.eq("formVersionId", replacement.formVersionId).eq("fieldKey", "medical-note")).unique(),
    requirement: await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q) => q.eq("formVersionId", replacement.formVersionId).eq("requirementKey", "financial-evidence")).unique(),
    price: await ctx.db.get(replacement.priceId),
  }));
  expect(unapprovedRows.field?.approvalEvidenceId).toBeUndefined();
  expect(unapprovedRows.requirement?.approvalEvidenceId).toBeUndefined();
  expect(unapprovedRows.price?.approvalEvidenceId).toBeUndefined();

  await expect(f.staff.mutation(approveCampaignPublicationRequirementsRef, replacement)).resolves.toMatchObject({ approvedCount: 3, replayedCount: 0 });
  const approvedDraft = (await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() })).find((item) => item.priceId === replacement.priceId);
  if (!approvedDraft) throw new Error("Approved sensitive campaign draft missing");
  const priorFieldApproval = approvedDraft.fields[0]?.approvalEvidenceId;
  const priorRequirementApproval = approvedDraft.requirements[0]?.approvalEvidenceId;
  if (!priorFieldApproval || !priorRequirementApproval) throw new Error("Definition approvals were not attached");
  const priorSubjects = await f.t.run(async (ctx) => Promise.all([ctx.db.get(priorFieldApproval), ctx.db.get(priorRequirementApproval)]));
  expect(priorSubjects[0]?.subjectKey).toMatch(/:medical-note:[a-f0-9]{64}$/);
  expect(priorSubjects[1]?.subjectKey).toMatch(/:financial-evidence:[a-f0-9]{64}$/);

  const edited = await f.staff.mutation(editCampaignRef, {
    schoolId: f.schoolId,
    programmeId: approvedDraft.programmeId,
    intakeId: approvedDraft.intakeId,
    formVersionId: approvedDraft.formVersionId,
    declarationVersionId: approvedDraft.declarationVersionId,
    productId: approvedDraft.productId,
    priceId: approvedDraft.priceId,
    programmeSlug: approvedDraft.programmeSlug,
    programmeName: approvedDraft.programmeName,
    intakeSlug: approvedDraft.intakeSlug,
    intakeName: approvedDraft.intakeName,
    cycleLabel: approvedDraft.cycleLabel,
    opensAt: approvedDraft.opensAt,
    closesAt: approvedDraft.closesAt,
    schemaVersion: approvedDraft.schemaVersion,
    fields: approvedDraft.fields.map((field) => ({ ...field, label: "Updated medical note" })),
    requirements: approvedDraft.requirements.map((requirement) => ({ ...requirement, maxBytes: 120_000 })),
    declarationTitle: approvedDraft.declarationTitle,
    declarationBody: approvedDraft.declarationBody,
    declarationPurpose: approvedDraft.declarationPurpose,
    productSlug: approvedDraft.productSlug,
    productName: approvedDraft.productName,
    amountMinor: approvedDraft.amountMinor,
    currency: approvedDraft.currency,
    refundPolicyKey: approvedDraft.refundPolicyKey,
    feeDisclosure: approvedDraft.feeDisclosure,
    effectiveFrom: approvedDraft.effectiveFrom,
    expectedDraftRevision: approvedDraft.draftRevision,
  });
  await expect(f.staff.mutation(publishCampaignRef, edited)).rejects.toThrow("approval evidence");
  await expect(f.staff.mutation(approveCampaignPublicationRequirementsRef, edited)).resolves.toMatchObject({ approvedCount: 2, replayedCount: 1 });
  const reapprovedRows = await f.t.run(async (ctx) => ({
    field: await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_field_key", (q) => q.eq("formVersionId", replacement.formVersionId).eq("fieldKey", "medical-note")).unique(),
    requirement: await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q) => q.eq("formVersionId", replacement.formVersionId).eq("requirementKey", "financial-evidence")).unique(),
  }));
  expect(reapprovedRows.field?.approvalEvidenceId).not.toBe(priorFieldApproval);
  expect(reapprovedRows.requirement?.approvalEvidenceId).not.toBe(priorRequirementApproval);
  await expect(f.staff.mutation(publishCampaignRef, edited)).resolves.toBeNull();
});

it("initializes guardian-owned checkout and fulfils only server-verified Paystack return data", async () => {
  const priorKey = process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
  process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = "admissions-test-encryption-key";
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.insert("schoolBillingSettings", { schoolId: f.schoolId, invoicePrefix: "INV", defaultCurrency: "NGN", defaultDueDays: 7, preferredProvider: "paystack", paymentProviderMode: "test", allowManualPayments: true, allowOnlinePayments: true, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: f.staffUserId }));
  await f.t.mutation(internal.functions.billingProviders.saveSchoolPaystackGatewayConfigInternal, { schoolId: f.schoolId, userId: f.staffUserId, mode: "test", publicKey: "pk_test", secretKey: "sk_test_secret" });
  await f.t.mutation(internal.functions.billingProviders.markSchoolPaystackGatewayConfigReadyInternal, { schoolId: f.schoolId, mode: "test", userId: f.staffUserId, successMessage: "ready" });
  const attempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "real-checkout" });
  let providerReference = attempt.reference;
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.test/session", access_code: "access-1" } }), { status: 200, headers: { "content-type": "application/json" } });
    expect(url).toContain("/transaction/verify/");
    return new Response(JSON.stringify({ status: true, data: { id: 42, status: "success", reference: providerReference, amount: attempt.amountMinor, currency: attempt.currency } }), { status: 200, headers: { "content-type": "application/json" } });
  });
  try {
    const initialized = await f.guardian.action(initializeAttemptRef, { reference: attempt.reference, confirmedTermsDigest: attempt.terms.termsDigest });
    expect(initialized).toMatchObject({ state: "checkout_pending", authorizationUrl: "https://checkout.paystack.test/session", replayed: false });
    expect(await f.guardian.action(initializeAttemptRef, { reference: attempt.reference, confirmedTermsDigest: attempt.terms.termsDigest })).toMatchObject({ replayed: true });
    const verified = await f.guardian.action(verifyReturnRef, { reference: attempt.reference });
    expect(verified).toMatchObject({ state: "paid" });
    expect(await f.guardian.action(verifyReturnRef, { reference: attempt.reference })).toMatchObject({ state: "paid", replayed: true });
    expect(await f.t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", attempt.attemptId)).collect())).toHaveLength(1);
    const mismatch = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "mismatched-return" });
    await f.guardian.action(initializeAttemptRef, { reference: mismatch.reference, confirmedTermsDigest: mismatch.terms.termsDigest });
    providerReference = "another-merchant-reference";
    await expect(f.guardian.action(verifyReturnRef, { reference: mismatch.reference })).rejects.toThrow("requires review");
    expect(await f.t.run((ctx) => ctx.db.get(mismatch.attemptId))).toMatchObject({ state: "manual_attention", failureCode: "PAYMENT_REFERENCE_MISMATCH" });
    expect(await f.t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", mismatch.attemptId)).unique())).toBeNull();
  } finally {
    fetchMock.mockRestore();
    if (priorKey === undefined) delete process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
    else process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = priorKey;
  }
}, 15_000);

it("persists safe initialization and verification recovery states", async () => {
  const priorKey = process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
  process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = "admissions-recovery-encryption-key";
  const f = await fixture();
  const unavailable = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "initialization-unavailable" });
  await expect(f.guardian.action(initializeAttemptRef, { reference: unavailable.reference, confirmedTermsDigest: unavailable.terms.termsDigest })).rejects.toThrow("requires review");
  expect(await f.t.run((ctx) => ctx.db.get(unavailable.attemptId))).toMatchObject({ state: "manual_attention", failureCode: "PAYMENT_INITIALIZATION_REVIEW_REQUIRED" });
  await f.t.run((ctx) => ctx.db.patch(unavailable.attemptId, { state: "failed", failureCode: "TEST_RESOLVED" }));

  await f.t.run((ctx) => ctx.db.insert("schoolBillingSettings", { schoolId: f.schoolId, invoicePrefix: "INV", defaultCurrency: "NGN", defaultDueDays: 7, preferredProvider: "paystack", paymentProviderMode: "test", allowManualPayments: true, allowOnlinePayments: true, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: f.staffUserId }));
  await f.t.mutation(internal.functions.billingProviders.saveSchoolPaystackGatewayConfigInternal, { schoolId: f.schoolId, userId: f.staffUserId, mode: "test", publicKey: "pk_test", secretKey: "sk_test_secret" });
  await f.t.mutation(internal.functions.billingProviders.markSchoolPaystackGatewayConfigReadyInternal, { schoolId: f.schoolId, mode: "test", userId: f.staffUserId, successMessage: "ready" });
  const ambiguous = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "initialization-ambiguous" });
  const initializationFailure = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("raw provider transport detail"));
  await expect(f.guardian.action(initializeAttemptRef, { reference: ambiguous.reference, confirmedTermsDigest: ambiguous.terms.termsDigest })).rejects.toThrow("requires review");
  initializationFailure.mockRestore();
  expect(await f.t.run((ctx) => ctx.db.get(ambiguous.attemptId))).toMatchObject({ state: "manual_attention", failureCode: "PAYMENT_INITIALIZATION_REVIEW_REQUIRED" });
  const recoveredVerification = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ status: true, data: { id: 98, status: "success", reference: ambiguous.reference, amount: ambiguous.amountMinor, currency: ambiguous.currency } }), { status: 200, headers: { "content-type": "application/json" } }));
  await expect(f.guardian.action(verifyReturnRef, { reference: ambiguous.reference })).resolves.toMatchObject({ state: "paid", entitlementId: expect.any(String) });
  recoveredVerification.mockRestore();

  const rejected = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "initialization-rejected" });
  const rejection = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ status: false, message: "provider detail must not escape" }), { status: 400, headers: { "content-type": "application/json" } }));
  await expect(f.guardian.action(initializeAttemptRef, { reference: rejected.reference, confirmedTermsDigest: rejected.terms.termsDigest })).rejects.toThrow("initialization was declined");
  rejection.mockRestore();
  expect(await f.t.run((ctx) => ctx.db.get(rejected.attemptId))).toMatchObject({ state: "failed", failureCode: "PAYMENT_INITIALIZATION_REJECTED" });

  const pending = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "verification-pending" });
  let providerStatus = "pending";
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => init?.method === "POST"
    ? new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.test/pending", access_code: "pending" } }), { status: 200, headers: { "content-type": "application/json" } })
    : new Response(JSON.stringify({ status: true, data: { id: 99, status: providerStatus, reference: pending.reference, amount: pending.amountMinor, currency: pending.currency } }), { status: 200, headers: { "content-type": "application/json" } }));
  try {
    await f.guardian.action(initializeAttemptRef, { reference: pending.reference, confirmedTermsDigest: pending.terms.termsDigest });
    await expect(f.guardian.action(verifyReturnRef, { reference: pending.reference })).resolves.toMatchObject({ state: "verification_pending", entitlementId: null });
    expect(await f.t.run((ctx) => ctx.db.get(pending.attemptId))).toMatchObject({ state: "verification_pending", failureCode: "PAYMENT_VERIFICATION_PENDING" });
    providerStatus = "abandoned";
    await expect(f.guardian.action(verifyReturnRef, { reference: pending.reference })).resolves.toMatchObject({ state: "failed", entitlementId: null });
    expect(await f.t.run((ctx) => ctx.db.get(pending.attemptId))).toMatchObject({ state: "failed", failureCode: "PAYMENT_VERIFICATION_FAILED" });
    providerStatus = "success";
    await expect(f.guardian.action(verifyReturnRef, { reference: pending.reference })).resolves.toMatchObject({ state: "paid", entitlementId: expect.any(String) });
  } finally {
    fetchMock.mockRestore();
    if (priorKey === undefined) delete process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
    else process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = priorKey;
  }
}, 15_000);

it("locks a reserved draft when its verified payment is refunded", async () => {
  const f = await fixture();
  const { attempt, application } = await paidApplication(f, "reserved-refund");
  const refunded = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "reserved-refund-event", eventType: "refund.processed", bodyDigest: "reserved-refund-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, financialOutcome: "refunded", receivedAt: Date.now() });
  expect(refunded.state).toBe("refunded");
  expect(await f.t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ state: "draft", financialHoldReason: "VERIFIED_REFUNDED" });
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "held-draft-save", requestedEntryLabel: "Primary 1", profile: { firstName: "Ife", lastName: "Ade", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [] })).rejects.toThrow("financially held");
});

it("keeps a partial-reversal hold monotonic across polling and delayed success", async () => {
  const priorKey = process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
  process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = "admissions-partial-reversal-encryption-key";
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.insert("schoolBillingSettings", { schoolId: f.schoolId, invoicePrefix: "INV", defaultCurrency: "NGN", defaultDueDays: 7, preferredProvider: "paystack", paymentProviderMode: "test", allowManualPayments: true, allowOnlinePayments: true, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: f.staffUserId }));
  await f.t.mutation(internal.functions.billingProviders.saveSchoolPaystackGatewayConfigInternal, { schoolId: f.schoolId, userId: f.staffUserId, mode: "test", publicKey: "pk_test", secretKey: "sk_test_secret" });
  await f.t.mutation(internal.functions.billingProviders.markSchoolPaystackGatewayConfigReadyInternal, { schoolId: f.schoolId, mode: "test", userId: f.staffUserId, successMessage: "ready" });
  const { attempt, payment } = await paidApplication(f, "partial-poll-delayed-success");
  const partial = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "partial-before-poll", eventType: "refund.processed", bodyDigest: "partial-before-poll-digest", amountMinor: attempt.amountMinor - 1, currency: attempt.currency, financialOutcome: "refunded", receivedAt: Date.now() });
  expect(partial.state).toBe("manual_attention");

  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: true, data: { id: 100, status: "pending", reference: attempt.reference, amount: attempt.amountMinor, currency: attempt.currency } }), { status: 200, headers: { "content-type": "application/json" } }));
  try {
    await expect(f.guardian.action(verifyReturnRef, { reference: attempt.reference })).resolves.toMatchObject({ state: "manual_attention" });
    expect(await f.t.run((ctx) => ctx.db.get(attempt.attemptId))).toMatchObject({ state: "manual_attention", failureCode: "PARTIAL_FINANCIAL_REVERSAL_REVIEW_REQUIRED" });
  } finally {
    fetchMock.mockRestore();
    if (priorKey === undefined) delete process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
    else process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = priorKey;
  }

  const delayed = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "success-after-partial-poll", eventType: "charge.success", bodyDigest: "success-after-partial-poll-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  expect(delayed.state).toBe("manual_attention");
  const entitlementId = payment.entitlementId;
  if (!entitlementId) throw new Error("Paid entitlement missing");
  expect(await f.t.run((ctx) => ctx.db.get(entitlementId))).toMatchObject({ state: "revoked", voidReason: "VERIFIED_PARTIAL_FINANCIAL_REVERSAL" });
});

it("recovers legacy verified events and applies refund/reversal outcomes monotonically", async () => {
  const f = await fixture();
  const attempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "legacy-verified" });
  const legacy = await f.t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "legacy-event", eventType: "charge.success", bodyDigest: "legacy-digest", receivedAt: Date.now() });
  const recovered = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "legacy-event", eventType: "charge.success", bodyDigest: "legacy-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  expect(recovered).toMatchObject({ eventId: legacy.eventId, processed: true, state: "paid" });
  if (!recovered.entitlementId) throw new Error("recovery did not create entitlement");
  const application = await f.guardian.mutation(createApplicationRef, { entitlementId: recovered.entitlementId });
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "refund-draft", requestedEntryLabel: "Primary 1", profile: { firstName: "Ife", lastName: "Ade", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Fit" }] });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "refund-submit", signerName: "Pat Ade", signerRelationship: "Guardian", declarationAccepted: true });
  const partial = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "partial-refund-event", eventType: "refund.processed", bodyDigest: "partial-refund-digest", amountMinor: attempt.amountMinor - 1, currency: attempt.currency, financialOutcome: "refunded", receivedAt: Date.now() });
  expect(partial).toMatchObject({ state: "manual_attention", processed: true });
  expect(await f.t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ financialHoldReason: "VERIFIED_PARTIAL_FINANCIAL_REVERSAL" });
  const successAfterPartial = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "success-after-partial", eventType: "charge.success", bodyDigest: "success-after-partial-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  expect(successAfterPartial.state).toBe("manual_attention");
  const refunded = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "refund-event", eventType: "refund.processed", bodyDigest: "refund-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, financialOutcome: "refunded", receivedAt: Date.now() });
  expect(refunded.state).toBe("refunded");
  expect(await f.t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ financialHoldReason: "VERIFIED_REFUNDED" });
  const partialAfterRefund = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "partial-after-refund", eventType: "refund.processed", bodyDigest: "partial-after-refund-digest", amountMinor: attempt.amountMinor - 2, currency: attempt.currency, financialOutcome: "refunded", receivedAt: Date.now() });
  expect(partialAfterRefund.state).toBe("refunded");
  const reversalAfterRefund = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "reversal-after-refund", eventType: "charge.dispute.resolve", bodyDigest: "reversal-after-refund-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, financialOutcome: "reversed", receivedAt: Date.now() });
  expect(reversalAfterRefund.state).toBe("refunded");
  expect(await f.t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ financialHoldReason: "VERIFIED_REFUNDED" });
  const delayed = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: "delayed-success", eventType: "charge.success", bodyDigest: "delayed-digest", amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  expect(delayed.state).toBe("refunded");
});

it("fails closed when requested entry is missing from an otherwise complete draft", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "missing-requested-entry");
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "missing-entry-save", profile: { firstName: "Ada", lastName: "Okafor", dateOfBirth: Date.UTC(2019, 1, 2) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Learning" }] });
  await expect(f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "missing-entry-submit", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true })).rejects.toThrow("requested entry");
});

it("handles draft replay/conflict, immutable resubmission snapshots, and correction scopes", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f);
  const profile = { firstName: "Ada", lastName: "Okafor", dateOfBirth: Date.UTC(2019, 1, 2), gender: "Female" };
  const save = await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "draft-save-001", requestedEntryLabel: "Primary 1", profile, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Learning" }] });
  expect(save).toEqual({ draftVersion: 1, replayed: false });
  expect(await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "draft-save-001", requestedEntryLabel: "Primary 1", profile, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Learning" }] })).toEqual({ draftVersion: 1, replayed: true });
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "draft-save-002", answers: [] })).rejects.toThrow("current version is 1");
  const submitted = await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "submission-001", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true });
  const snapshotBefore = await f.t.run((ctx) => ctx.db.get(submitted.snapshotId));
  expect(await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "submission-001", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true })).toMatchObject({ snapshotId: submitted.snapshotId, replayed: true });
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "draft-save-003", answers: [] })).rejects.toThrow("locked");
  await f.staff.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await f.staff.mutation(requestChangesRef, { schoolId: f.schoolId, applicationId: application.applicationId, fieldKeys: ["reason"], requirementIds: [], reasonCode: "CLARIFY", guardianMessage: "Please clarify the reason." });
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "draft-save-004", profile, answers: [] })).rejects.toThrow("requested corrections");
  await expect(f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "unchanged-correction-submit", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true })).rejects.toThrow("Update requested items");
  const unchangedSave = await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "unchanged-correction-save", answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Learning" }] });
  await expect(f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: unchangedSave.draftVersion, submissionKey: "unchanged-correction-resubmit", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true })).rejects.toThrow("Update requested items");
  const correction = await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: unchangedSave.draftVersion, mutationKey: "draft-save-005", answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Updated reason" }] });
  const resubmitted = await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: correction.draftVersion, submissionKey: "submission-002", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true });
  expect(resubmitted.revision).toBe(2);
  expect(await f.t.run((ctx) => ctx.db.get(submitted.snapshotId))).toEqual(snapshotBefore);
  expect(await f.t.run((ctx) => ctx.db.query("admissionsSubmissionSnapshots").withIndex("by_application_and_revision", (q) => q.eq("applicationId", application.applicationId)).collect())).toHaveLength(2);
});

it("requires a newer requested document version before resubmission", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "replacement-required");
  const document = await addRequiredDocument(f, application.applicationId, "replacement-required");
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "replacement-draft", requestedEntryLabel: "Primary 1", profile: { firstName: "Ada", lastName: "Eze", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "School fit" }] });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "replacement-submit-one", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true });
  await f.staff.mutation(requestChangesRef, { schoolId: f.schoolId, applicationId: application.applicationId, fieldKeys: [], requirementIds: [document.requirementId], reasonCode: "REPLACE_DOCUMENT", guardianMessage: "Upload a newer identity document." });
  await expect(f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "replacement-submit-two", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true })).rejects.toThrow("Complete required items");
  await f.t.run(async (ctx) => {
    const applicationRow = await ctx.db.get(application.applicationId);
    if (!applicationRow) throw new Error("Application missing");
    const storageId = await ctx.storage.store(new Blob(["new identity evidence"], { type: "application/pdf" }));
    await ctx.db.insert("admissionsDocuments", { schoolId: f.schoolId, applicationId: application.applicationId, requirementId: document.requirementId, category: "identity", documentKey: "replacement-required-v2", storageId, fileName: "replacement-v2.pdf", mimeType: "application/pdf", byteSize: 21, sha256: "replacement-v2-digest", version: 2, state: "uploaded", sensitivity: "personal", uploadedByGuardianId: applicationRow.guardianId, retentionHold: false, createdAt: Date.now(), updatedAt: Date.now() });
  });
  await expect(f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "replacement-submit-three", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true })).resolves.toMatchObject({ revision: 2 });
});

it("allows rejection when a required document fails review but still blocks acceptance", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "rejected-document-decision");
  const document = await addRequiredDocument(f, application.applicationId, "rejected-document");
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "reject-doc-draft", requestedEntryLabel: "Primary 1", profile: { firstName: "Ada", lastName: "Eze", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "School fit" }] });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "reject-doc-submit", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true });
  await f.staff.mutation(documentReviewRef, { schoolId: f.schoolId, documentKey: document.documentKey, result: "rejected", reasonCode: "INVALID_DOCUMENT", guardianMessage: "The identity document could not be accepted." });
  await f.staff.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await f.staff.mutation(markReadyRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await expect(f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "ACCEPT", guardianMessage: "Accepted." })).rejects.toThrow("before an acceptance decision");
  await expect(f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "rejected", reasonCode: "DOCUMENT_FAILED", guardianMessage: "The application could not be approved." })).resolves.toMatchObject({ version: 3 });
});

it("atomically turns a needs-replacement document review into a guardian correction", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "document-review-correction");
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "document-review-save", requestedEntryLabel: "Primary 1", profile: { firstName: "Ada", lastName: "Eze", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Fit" }] });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "document-review-submit", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true });
  const documentKey = "replacement-document";
  const requirementId = await f.t.run(async (ctx) => { const now = Date.now(); const requirementId = await ctx.db.insert("admissionsDocumentRequirements", { schoolId: f.schoolId, formVersionId: f.campaign.formVersionId, requirementKey: "replacement", category: "identity", label: "Identity document", requiredMode: "optional", acceptedMimeTypes: ["application/pdf"], maxBytes: 1000, maxFiles: 1, sensitivity: "personal", purpose: "Identity review", order: 2, createdAt: now, updatedAt: now }); const applicationRow = await ctx.db.get(application.applicationId); if (!applicationRow) throw new Error("application missing"); const storageId = await ctx.storage.store(new Blob(["document"])); await ctx.db.insert("admissionsDocuments", { schoolId: f.schoolId, applicationId: application.applicationId, requirementId, category: "identity", documentKey, storageId, fileName: "identity.pdf", mimeType: "application/pdf", byteSize: 8, sha256: "digest", version: 1, state: "uploaded", sensitivity: "personal", uploadedByGuardianId: applicationRow.guardianId, retentionHold: false, createdAt: now, updatedAt: now }); return requirementId; });
  await f.staff.mutation(documentReviewRef, { schoolId: f.schoolId, documentKey, result: "needs_replacement", reasonCode: "BLURRY", guardianMessage: "Please upload a clearer copy." });
  expect(await f.guardian.query(getDraftRef, { applicationId: application.applicationId })).toMatchObject({ state: "changes_requested", correction: { requirementIds: [requirementId], message: "Please upload a clearer copy." }, safeMessages: ["Please upload a clearer copy."] });
});

it("resumes primary contact and bound definitions and enforces every mutable core correction scope", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "complete-resume");
  await f.guardian.mutation(saveDraftRef, {
    applicationId: application.applicationId,
    expectedVersion: 0,
    mutationKey: "complete-resume-save",
    requestedEntryLabel: "Primary 1",
    profile: { firstName: "Kosi", lastName: "Nwosu", dateOfBirth: Date.UTC(2019, 4, 2) },
    primaryContact: { fullName: "Ada Nwosu", relationship: "Mother", email: "ada@example.test", phone: "+2348000000000", address: "Lagos" },
    answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Community" }],
  });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "complete-resume-submit", signerName: "Ada Nwosu", signerRelationship: "Mother", declarationAccepted: true });
  await f.staff.mutation(requestChangesRef, { schoolId: f.schoolId, applicationId: application.applicationId, fieldKeys: ["profile", "primaryContact", "requestedEntryLabel"], requirementIds: [], reasonCode: "CORE_DETAILS", guardianMessage: "Please update the core details." });
  const resumed = await f.guardian.query(getDraftRef, { applicationId: application.applicationId });
  expect(resumed).toMatchObject({
    state: "changes_requested",
    requestedEntryLabel: "Primary 1",
    primaryContact: { fullName: "Ada Nwosu", relationship: "Mother", email: "ada@example.test", phone: "+2348000000000", address: "Lagos" },
    form: { version: 1, schemaVersion: "1", status: "published", fields: [{ fieldKey: "reason" }] },
    declaration: { version: 1, title: "Declaration", body: "I confirm this application is accurate.", status: "published" },
    correction: { fieldKeys: ["profile", "primaryContact", "requestedEntryLabel"], requirementIds: [], reasonCode: "CORE_DETAILS", message: "Please update the core details." },
  });
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "outside-core-scope", answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Not allowed" }] })).rejects.toThrow("requested corrections");
  await expect(f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "all-core-scope", requestedEntryLabel: "Primary 2", profile: { firstName: "Kosi", lastName: "Nwosu", dateOfBirth: Date.UTC(2019, 4, 2), preferredName: "K" }, primaryContact: { fullName: "Adaobi Nwosu", relationship: "Mother", email: "adaobi@example.test" }, answers: [] })).resolves.toMatchObject({ draftVersion: 2 });
  expect(await f.guardian.query(getDraftRef, { applicationId: application.applicationId })).toMatchObject({ requestedEntryLabel: "Primary 2", profile: { preferredName: "K" }, primaryContact: { fullName: "Adaobi Nwosu", email: "adaobi@example.test" } });
});

it("lists active conversion classes independently of archived class history", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "active-conversion-classes");
  const activeClassId = await f.t.run(async (ctx) => {
    const now = Date.now();
    for (let index = 0; index < 120; index += 1) {
      await ctx.db.insert("classes", { schoolId: f.schoolId, name: `Archived ${index}`, gradeName: `Archived ${index}`, level: "primary", isArchived: true, createdAt: now + index, updatedAt: now + index });
    }
    return await ctx.db.insert("classes", { schoolId: f.schoolId, name: "Current Primary", gradeName: "Current Primary", level: "primary", isArchived: false, createdAt: now + 121, updatedAt: now + 121 });
  });
  const workflow = await f.staff.query(conversionWorkflowRef, { schoolId: f.schoolId, applicationId: application.applicationId }) as { classes: Array<{ classId: Id<"classes">; name: string }> };
  expect(workflow.classes).toContainEqual(expect.objectContaining({ classId: activeClassId, name: "Current Primary" }));
  expect(workflow.classes.some((row) => row.name.startsWith("Archived "))).toBe(false);
});

it("returns separate immutable basic and audited sensitive staff detail without storage IDs", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "staff-detail");
  const definitions = await f.t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("admissionsFormFields", { schoolId: f.schoolId, formVersionId: f.campaign.formVersionId, fieldKey: "medical-note", sectionKey: "health", kind: "text", label: "Medical note", requiredMode: "optional", dataClass: "highly_sensitive", purpose: "Applicant support", validationJson: "{}", order: 2, status: "active", createdAt: now, updatedAt: now });
    const basicRequirementId = await ctx.db.insert("admissionsDocumentRequirements", { schoolId: f.schoolId, formVersionId: f.campaign.formVersionId, requirementKey: "school-report", category: "academic", label: "School report", requiredMode: "optional", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 1, sensitivity: "personal", purpose: "Academic review", order: 1, createdAt: now, updatedAt: now });
    const sensitiveRequirementId = await ctx.db.insert("admissionsDocumentRequirements", { schoolId: f.schoolId, formVersionId: f.campaign.formVersionId, requirementKey: "medical-report", category: "medical", label: "Medical report", requiredMode: "optional", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 1, sensitivity: "highly_sensitive", purpose: "Applicant support", order: 2, createdAt: now, updatedAt: now });
    return { basicRequirementId, sensitiveRequirementId };
  });
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "staff-detail-save", requestedEntryLabel: "Primary 1", profile: { firstName: "Zara", lastName: "Bello", dateOfBirth: Date.UTC(2019, 5, 1) }, primaryContact: { fullName: "Musa Bello", relationship: "Father", email: "musa@example.test" }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "School community" }, { fieldKey: "medical-note", valueType: "string", serializedValue: "Sensitive note" }] });
  await f.t.run(async (ctx) => {
    const now = Date.now();
    const storedApplication = await ctx.db.get(application.applicationId);
    if (!storedApplication) throw new Error("application missing");
    const basicStorageId = await ctx.storage.store(new Blob(["basic"], { type: "application/pdf" }));
    const sensitiveStorageId = await ctx.storage.store(new Blob(["sensitive"], { type: "application/pdf" }));
    await ctx.db.insert("admissionsDocuments", { schoolId: f.schoolId, applicationId: application.applicationId, requirementId: definitions.basicRequirementId, category: "academic", documentKey: "opaque-basic-document", storageId: basicStorageId, fileName: "report.pdf", mimeType: "application/pdf", byteSize: 5, sha256: "basic-digest", version: 1, state: "uploaded", sensitivity: "personal", uploadedByGuardianId: storedApplication.guardianId, retentionHold: false, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsDocuments", { schoolId: f.schoolId, applicationId: application.applicationId, requirementId: definitions.sensitiveRequirementId, category: "medical", documentKey: "opaque-sensitive-document", storageId: sensitiveStorageId, fileName: "medical.pdf", mimeType: "application/pdf", byteSize: 9, sha256: "sensitive-digest", version: 1, state: "uploaded", sensitivity: "highly_sensitive", uploadedByGuardianId: storedApplication.guardianId, retentionHold: false, createdAt: now, updatedAt: now });
  });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "staff-detail-submit", signerName: "Musa Bello", signerRelationship: "Father", declarationAccepted: true });
  const basic = await f.limited.query(getApplicationDetailRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  expect(basic).toMatchObject({ profile: { firstName: "Zara", lastName: "Bello" }, primaryContact: { fullName: "Musa Bello", email: "musa@example.test" }, requestedEntryLabel: "Primary 1", answers: [{ fieldKey: "reason", serializedValue: "School community" }], documents: [{ documentKey: "opaque-basic-document", fileName: "report.pdf" }] });
  expect(JSON.stringify(basic)).not.toContain("storageId");
  expect(JSON.stringify(basic)).not.toContain("basic-digest");
  expect(JSON.stringify(basic)).not.toContain("Sensitive note");
  await expect(f.limited.mutation(revealSensitiveApplicationDetailRef, { schoolId: f.schoolId, applicationId: application.applicationId, reason: "Review health support" })).rejects.toThrow("capability");
  await expect(f.staff.mutation(revealSensitiveApplicationDetailRef, { schoolId: f.schoolId, applicationId: application.applicationId, reason: "Review health support" })).rejects.toThrow("Fresh authentication");
  const sensitive = await f.freshStaff.mutation(revealSensitiveApplicationDetailRef, { schoolId: f.schoolId, applicationId: application.applicationId, reason: "Review health support" });
  expect(sensitive).toMatchObject({ answers: [{ fieldKey: "medical-note", serializedValue: "Sensitive note" }], documents: [{ documentKey: "opaque-sensitive-document", fileName: "medical.pdf" }] });
  expect(JSON.stringify(sensitive)).not.toContain("storageId");
  expect(JSON.stringify(sensitive)).not.toContain("sensitive-digest");

  expect(await f.limited.mutation(documentAccessRef, { schoolId: f.schoolId, documentKey: "opaque-basic-document", action: "view", reason: "Application review" })).toEqual({ status: "unavailable" });
  const permissionAudit = await f.t.run(async (ctx) => {
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", "opaque-basic-document")).unique();
    if (!document) throw new Error("document missing");
    return await ctx.db.query("admissionsDocumentAccessAudits").withIndex("by_document_and_created_at", (q) => q.eq("documentId", document._id)).unique();
  });
  expect(permissionAudit).toMatchObject({ actorKind: "staff", actorUserId: f.limitedUserId, outcome: "denied", reason: "PERMISSION_DENIED" });
  expect(await f.staff.mutation(documentAccessRef, { schoolId: f.otherSchoolId, documentKey: "opaque-basic-document", action: "view", reason: "Cross-tenant request" })).toEqual({ status: "unavailable" });
  expect(await f.t.mutation(documentAccessRef, { schoolId: f.schoolId, documentKey: "opaque-basic-document", action: "view", reason: "Unauthenticated request" })).toEqual({ status: "unavailable" });
  const deniedAuditCount = await f.t.run(async (ctx) => {
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", "opaque-basic-document")).unique();
    if (!document) throw new Error("document missing");
    return (await ctx.db.query("admissionsDocumentAccessAudits").withIndex("by_document_and_created_at", (q) => q.eq("documentId", document._id)).take(10)).length;
  });
  expect(deniedAuditCount).toBe(1);

  const basicGrant = await f.staff.mutation(documentAccessRef, { schoolId: f.schoolId, documentKey: "opaque-basic-document", action: "view", reason: "Application review" }) as { status: "available"; url: string };
  expect(basicGrant.url).toMatch(/^\/api\/admissions\/documents\/[a-f0-9]{64}$/);
  expect(basicGrant.url).not.toMatch(/opaque-basic-document|convex\.cloud|api\/storage/);
  const basicToken = basicGrant.url.split("/").at(-1) ?? "";
  expect(await f.limited.mutation(consumeStaffDocumentAccessGrantRef, { token: basicToken })).toEqual({ status: "unavailable" });
  expect(await f.staff.mutation(consumeStaffDocumentAccessGrantRef, { token: basicToken })).toMatchObject({ status: "available", fileName: "report.pdf", action: "view" });
  expect(await f.staff.mutation(consumeStaffDocumentAccessGrantRef, { token: basicToken })).toEqual({ status: "unavailable" });
  expect(await f.staff.mutation(documentAccessRef, { schoolId: f.schoolId, documentKey: "opaque-sensitive-document", action: "view", reason: "Sensitive application review" })).toEqual({ status: "unavailable" });
  const freshStaff = f.t.withIdentity({ tokenIdentifier: "test|admissions-staff", subject: "admissions-staff", issuer: "test", authenticatedAt: Date.now() });
  const sensitiveGrant = await freshStaff.mutation(documentAccessRef, { schoolId: f.schoolId, documentKey: "opaque-sensitive-document", action: "download", reason: "Sensitive application review" }) as { status: "available"; url: string };
  expect(await freshStaff.mutation(consumeStaffDocumentAccessGrantRef, { token: sensitiveGrant.url.split("/").at(-1) ?? "" })).toMatchObject({ status: "available", fileName: "medical.pdf", action: "download" });
  expect(await f.t.run((ctx) => ctx.db.query("admissionsAuditEvents").withIndex("by_school_and_action_and_created_at", (q) => q.eq("schoolId", f.schoolId).eq("action", "application.reveal_sensitive")).unique())).toMatchObject({ applicationId: application.applicationId, actorUserId: f.staffUserId });
});

it("versions evaluations and enforces ready, waitlist, resume, and manager reopen transitions", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "decision-workflow");
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "decision-workflow-save", requestedEntryLabel: "Primary 1", profile: { firstName: "Ada", lastName: "Eze", dateOfBirth: Date.UTC(2019, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "School fit" }] });
  const submitted = await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "decision-workflow-submit", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true });
  await expect(f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "EARLY", guardianMessage: "Accepted." })).rejects.toThrow("transition");
  await f.staff.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  expect((await f.staff.query(reviewStateRef, { schoolId: f.schoolId, applicationId: application.applicationId })).decision).toMatchObject({ state: "in_evaluation", version: 1, snapshotId: submitted.snapshotId });
  await f.t.run((ctx) => ctx.db.patch(application.applicationId, { financialHoldAt: Date.now(), financialHoldReason: "TEST_HOLD" }));
  await expect(f.staff.mutation(markReadyRef, { schoolId: f.schoolId, applicationId: application.applicationId })).rejects.toThrow("FINANCIAL_HOLD");
  await f.t.run((ctx) => ctx.db.patch(application.applicationId, { financialHoldAt: undefined, financialHoldReason: undefined }));
  await expect(f.staff.mutation(evaluationRef, { schoolId: f.schoolId, applicationId: application.applicationId, type: "interview", state: "completed", resultCode: "PASS" })).rejects.toThrow("scheduled");
  await expect(f.staff.mutation(evaluationRef, { schoolId: f.schoolId, applicationId: application.applicationId, type: "interview", state: "scheduled", scheduledAt: Date.now() + 10_000, notes: "internal evaluation note" })).resolves.toMatchObject({ version: 1 });
  await expect(f.staff.mutation(markReadyRef, { schoolId: f.schoolId, applicationId: application.applicationId })).rejects.toThrow("EVALUATION_PENDING");
  await expect(f.staff.mutation(evaluationRef, { schoolId: f.schoolId, applicationId: application.applicationId, type: "interview", state: "completed", resultCode: "PASS", score: 84 })).resolves.toMatchObject({ version: 2 });
  await expect(f.staff.mutation(markReadyRef, { schoolId: f.schoolId, applicationId: application.applicationId })).resolves.toMatchObject({ version: 2 });
  await expect(f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "waitlisted", reasonCode: "CAPACITY", guardianMessage: "The application is waitlisted.", rationale: "internal decision rationale" })).resolves.toMatchObject({ version: 3 });
  expect(await f.t.run((ctx) => ctx.db.get(application.applicationId))).toMatchObject({ state: "waitlisted" });
  const basicWorkflow = await f.limited.query(reviewStateRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  expect(JSON.stringify(basicWorkflow)).not.toMatch(/notes|rationale|internal evaluation note|internal decision rationale/);
  const storedInternalFields = await f.t.run(async (ctx) => {
    const storedApplication = await ctx.db.get(application.applicationId);
    return {
      decision: storedApplication?.currentDecisionId ? await ctx.db.get(storedApplication.currentDecisionId) : null,
      evaluation: (await ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application.applicationId).eq("type", "interview")).order("asc").take(1))[0],
    };
  });
  expect(storedInternalFields.decision?.rationale).toBe("internal decision rationale");
  expect(storedInternalFields.evaluation?.notes).toBe("internal evaluation note");
  await expect(f.staff.mutation(resumeWaitlistedRef, { schoolId: f.schoolId, applicationId: application.applicationId, reasonCode: "PLACE_AVAILABLE" })).rejects.toThrow("Fresh authentication");
  await expect(f.freshStaff.mutation(resumeWaitlistedRef, { schoolId: f.schoolId, applicationId: application.applicationId, reasonCode: "PLACE_AVAILABLE" })).resolves.toMatchObject({ version: 4 });
  await f.staff.mutation(markReadyRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "ACCEPT", guardianMessage: "Accepted." });
  await expect(f.staff.mutation(reopenDecisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, reasonCode: "MANAGER_REVIEW" })).rejects.toThrow("Fresh authentication");
  await expect(f.freshStaff.mutation(reopenDecisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, reasonCode: "MANAGER_REVIEW" })).resolves.toMatchObject({ version: 7 });
  expect(await f.t.run((ctx) => ctx.db.query("admissionsDecisions").withIndex("by_application_and_version", (q) => q.eq("applicationId", application.applicationId)).collect())).toHaveLength(7);
});

it("refreshes in-evaluation snapshot binding after a resubmission", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "snapshot-refresh");
  const profile = { firstName: "Ada", lastName: "Eze", dateOfBirth: Date.UTC(2019, 1, 1) };
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "snapshot-refresh-save", requestedEntryLabel: "Primary 1", profile, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Initial" }] });
  const first = await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "snapshot-refresh-submit-1", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true });
  await f.staff.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await f.staff.mutation(requestChangesRef, { schoolId: f.schoolId, applicationId: application.applicationId, fieldKeys: ["reason"], requirementIds: [], reasonCode: "CLARIFY", guardianMessage: "Clarify." });
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "snapshot-refresh-change", answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Updated" }] });
  const second = await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 2, submissionKey: "snapshot-refresh-submit-2", signerName: "Parent Eze", signerRelationship: "Parent", declarationAccepted: true });
  await f.staff.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  const decisions = await f.t.run((ctx) => ctx.db.query("admissionsDecisions").withIndex("by_application_and_version", (q) => q.eq("applicationId", application.applicationId)).collect());
  expect(decisions.map((decision) => decision.snapshotId)).toEqual([first.snapshotId, second.snapshotId]);
});

it("keeps conversion-only identities and internal status out of basic and guardian projections", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f, "projection-security");
  expect(await f.limited.query(workflowRef, { schoolId: f.schoolId, applicationId: application.applicationId })).toMatchObject({ fieldKeys: expect.any(Array), requirements: [] });
  await expect(f.limited.query(conversionWorkflowRef, { schoolId: f.schoolId, applicationId: application.applicationId })).rejects.toThrow("capability");
  const owned = await f.guardian.query(ownedApplicationRef, { schoolSlug: "admissions-school", publicId: (await f.t.run((ctx) => ctx.db.get(application.applicationId)))?.publicId ?? "missing" });
  expect(owned).toMatchObject({ safeMessages: [], conversion: null });
  expect(JSON.stringify(owned)).not.toMatch(/familyId|idempotencyKey|errorCode/);
});

it("authorizes review and decisions from current enrollment capabilities, not historical capability grants", async () => {
  const f = await fixture();
  const { application } = await paidApplication(f);
  await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 0, mutationKey: "draft-auth-001", requestedEntryLabel: "Primary 1", profile: { firstName: "Tomi", lastName: "Ade", dateOfBirth: Date.UTC(2018, 1, 1) }, answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "School fit" }] });
  await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: 1, submissionKey: "submission-auth", signerName: "Pat Ade", signerRelationship: "Guardian", declarationAccepted: true });
  await f.t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId: f.schoolId, userId: f.limitedUserId, capability: "decisions.record", scope: "school", grantedByUserId: f.staffUserId, reason: "Historical B0 grant must not authorize", isBreakGlass: false, createdAt: Date.now() }));
  await expect(f.limited.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId })).rejects.toThrow("capability");
  await f.t.run((ctx) => ctx.db.patch(application.applicationId, { state: "under_review", currentDecisionId: undefined }));
  await expect(f.staff.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId })).resolves.toBeNull();
  await f.staff.mutation(markReadyRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await expect(f.limited.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "The application has been accepted." })).rejects.toThrow("capability");
  const staleStaff = f.t.withIdentity({ tokenIdentifier: "test|admissions-staff", subject: "admissions-staff", issuer: "test", authenticatedAt: Date.now() - 6 * 60 * 1_000 });
  await expect(staleStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "The application has been accepted." })).rejects.toThrow("Fresh authentication");
  expect(await f.t.run((ctx) => ctx.db.query("admissionsDecisions").withIndex("by_application_and_version", (q) => q.eq("applicationId", application.applicationId)).take(10))).toHaveLength(2);
  await expect(f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "" })).rejects.toThrow("Guardian-safe");
  const decision = await f.freshStaff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "The application has been accepted.", rationale: "Reviewed" });
  expect(decision).toMatchObject({ version: 3, replayed: false });
  await expect(f.staff.mutation(startReviewRef, { schoolId: f.otherSchoolId, applicationId: application.applicationId })).rejects.toThrow();
});
