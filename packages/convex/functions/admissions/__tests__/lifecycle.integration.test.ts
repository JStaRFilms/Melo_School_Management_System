import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it, vi } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { internal } from "../../../_generated/api";
import { seedReviewedTenantOperatorWithCapabilities } from "../../academic/__tests__/securityFixtures";
import { listCampaignsRef, listGuardianWorkspaceBySlugRef, listPublishedOfferingsRef, recordVerifiedPaymentRef } from "../refs";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

const guardianIdentityRef = makeFunctionReference<"mutation", Record<string, never>, { guardianId: Id<"admissionsGuardians">; normalizedEmail: string; emailVerifiedAt: number }>("functions/admissions/guardian:getOrCreateIdentity");
const createCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:createCampaignDraft");
const publishCampaignRef = makeFunctionReference<"mutation">("functions/admissions/catalogue:publishCampaign");
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
const documentReviewRef = makeFunctionReference<"mutation">("functions/admissions/staff:recordDocumentReview");
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
  draftRevision?: string;
};

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Admissions School", slug: "admissions-school", status: "active", features: { billing: true, curriculum: true, knowledgeLibrary: true, admissions: true }, createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "other-school", status: "active", createdAt: now, updatedAt: now });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "primary", createdAt: now, updatedAt: now });
    const staff = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|admissions-staff", ["enrollment.intakes.manage", "enrollment.applications.list", "enrollment.applications.view_basic", "enrollment.applications.view_sensitive", "enrollment.documents.review", "enrollment.decisions.record", "enrollment.admissions.override_number"]);
    const limited = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|limited-staff", ["enrollment.applications.view_basic"]);
    await ctx.db.insert("schoolPaymentProviders", { schoolId, provider: "paystack", mode: "test", isEnabled: true, status: "ready", publicKey: "pk_test", publicKeyMasked: "pk_***", publicKeyFingerprint: "fingerprint", activeSecretMasked: "sk_***", pendingSecretMasked: null, activeSecretId: null, pendingSecretId: null, activeSecretFingerprint: null, pendingSecretFingerprint: null, lastValidatedAt: now, lastValidationMessage: "ready", createdAt: now, updatedAt: now, createdBy: staff.memberships[0].userId, updatedBy: staff.memberships[0].userId });
    return { schoolId, otherSchoolId, classId, staffUserId: staff.memberships[0].userId, limitedUserId: limited.memberships[0].userId };
  });
  const staff = t.withIdentity({ tokenIdentifier: "test|admissions-staff", subject: "admissions-staff", issuer: "test" });
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
  await staff.mutation(publishCampaignRef, { programmeId: campaign.programmeId, intakeId: campaign.intakeId, formVersionId: campaign.formVersionId, declarationVersionId: campaign.declarationVersionId, productId: campaign.productId, priceId: campaign.priceId });
  await guardian.mutation(guardianIdentityRef, {});
  await otherGuardian.mutation(guardianIdentityRef, {});
  return { t, staff, limited, guardian, otherGuardian, campaign, ...ids };
}

async function paidApplication(f: Awaited<ReturnType<typeof fixture>>, key = "purchase-key-1") {
  const attempt = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: key }) as { attemptId: Id<"admissionsPurchaseAttempts">; reference: string; amountMinor: number; currency: string; replayed: boolean };
  const payment = await f.t.mutation(recordVerifiedPaymentRef, { schoolId: f.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: "test", providerEventId: `event-${key}`, eventType: "charge.success", bodyDigest: `digest-${key}`, amountMinor: attempt.amountMinor, currency: attempt.currency, receivedAt: Date.now() });
  if (!payment.entitlementId) throw new Error("Expected paid entitlement");
  const application = await f.guardian.mutation(createApplicationRef, { entitlementId: payment.entitlementId }) as { applicationId: Id<"admissionsApplications">; replayed: boolean };
  return { attempt, payment, application };
}

it("serves the restored UI read models without caller-supplied guardian identity", async () => {
  const f = await fixture();
  const campaigns = await f.staff.query(listCampaignsRef, { schoolId: f.schoolId, now: Date.now() });
  expect(campaigns).toHaveLength(1);
  expect(campaigns[0]).toMatchObject({ lifecycle: "published", programmeSlug: "primary", amountMinor: 500_000 });
  const landing = await f.t.query(listPublishedOfferingsRef, { schoolSlug: "admissions-school", now: Date.now() });
  expect(landing).toMatchObject({ available: true, offerings: [{ intakeSlug: "2026", availability: "open", amountMinor: 500_000 }] });
  const paid = await paidApplication(f, "ui-owned-workspace");
  const workspace = await f.guardian.query(listGuardianWorkspaceBySlugRef, { schoolSlug: "admissions-school" });
  expect(workspace.applications).toEqual([expect.objectContaining({ applicationId: paid.application.applicationId })]);
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
  const replacement = await f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: f.campaign.programmeId, intakeId: f.campaign.intakeId, productId: f.campaign.productId, schemaVersion: "2", fields: [{ fieldKey: "reason", sectionKey: "child", kind: "textarea", label: "Reason", requiredMode: "required", dataClass: "personal", purpose: "Understand the application", validationJson: JSON.stringify({ maxLength: 500 }), order: 1 }], requirements: [], declarationTitle: "Updated", declarationBody: "Updated declaration", declarationPurpose: "Attestation", amountMinor: 600_000, currency: "NGN", refundPolicyKey: "current", feeDisclosure: "Current fee", effectiveFrom: Date.now() - 1 });
  await f.staff.mutation(publishCampaignRef, replacement);
  const offering = await f.t.query(offeringRef, { schoolSlug: "admissions-school", intakeSlug: "2026", now: Date.now() });
  expect(offering).toMatchObject({ available: true, link: { version: "1", availability: "open" }, form: { schemaVersion: "2" }, price: { amountMinor: 600_000 }, declaration: { title: "Updated", version: 2 } });
  expect(await f.t.run((ctx) => ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", f.campaign.intakeId).eq("status", "published")).collect())).toHaveLength(1);
  const submitted = await f.guardian.mutation(submitRef, { applicationId: oldDraft.application.applicationId, expectedVersion: 1, submissionKey: "old-bound-submit", signerName: "Ngozi Eze", signerRelationship: "Guardian", declarationAccepted: true });
  expect(await f.t.run((ctx) => ctx.db.get(submitted.snapshotId))).toMatchObject({ formVersionId: f.campaign.formVersionId, declarationVersionId: f.campaign.declarationVersionId, productPriceId: f.campaign.priceId });
  expect(await f.t.run((ctx) => ctx.db.get(oldDraft.application.applicationId))).toMatchObject({ formVersionId: f.campaign.formVersionId, declarationVersionId: f.campaign.declarationVersionId, priceId: f.campaign.priceId });
});

it("requires current approval evidence bound to each optional sensitive field and document subject", async () => {
  const f = await fixture();
  const [fieldEvidenceId, requirementEvidenceId] = await f.t.run(async (ctx) => {
    const now = Date.now();
    return Promise.all([
      ctx.db.insert("schoolApprovalEvidence", { schoolId: f.schoolId, approvalClass: "privacy", subjectType: "admissions_form", subjectKey: "broad", evidenceReference: "privacy-review", approvedByUserId: f.staffUserId, approvedAt: now, createdAt: now }),
      ctx.db.insert("schoolApprovalEvidence", { schoolId: f.schoolId, approvalClass: "finance", subjectType: "admissions_form", subjectKey: "broad", evidenceReference: "finance-review", approvedByUserId: f.staffUserId, approvedAt: now, createdAt: now }),
    ]);
  });
  const replacement = await f.staff.mutation(replacementCampaignRef, { schoolId: f.schoolId, programmeId: f.campaign.programmeId, intakeId: f.campaign.intakeId, productId: f.campaign.productId, schemaVersion: "sensitive", fields: [{ fieldKey: "medical-note", sectionKey: "health", kind: "text", label: "Medical note", requiredMode: "optional", dataClass: "highly_sensitive", purpose: "Applicant support", validationJson: "{}", approvalEvidenceId: fieldEvidenceId, order: 1 }], requirements: [{ requirementKey: "financial-evidence", category: "financial", label: "Financial evidence", requiredMode: "optional", acceptedMimeTypes: ["application/pdf"], maxBytes: 100_000, maxFiles: 1, sensitivity: "financial_security", purpose: "Financial assessment", approvalEvidenceId: requirementEvidenceId, order: 1 }], declarationTitle: "Updated", declarationBody: "Updated declaration", declarationPurpose: "Attestation", amountMinor: 600_000, currency: "NGN", refundPolicyKey: "current", feeDisclosure: "Current fee", effectiveFrom: Date.now() - 1 });
  await expect(f.staff.mutation(publishCampaignRef, replacement)).rejects.toThrow("subject-bound");
  await f.t.run((ctx) => ctx.db.patch(fieldEvidenceId, { subjectType: "admissions_form_field", subjectKey: `${String(replacement.formVersionId)}:medical-note` }));
  await expect(f.staff.mutation(publishCampaignRef, replacement)).rejects.toThrow("subject-bound");
  await f.t.run((ctx) => ctx.db.patch(requirementEvidenceId, { subjectType: "admissions_document_requirement", subjectKey: `${String(replacement.formVersionId)}:financial-evidence` }));
  await expect(f.staff.mutation(publishCampaignRef, replacement)).resolves.toBeNull();
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
    const initialized = await f.guardian.action(initializeAttemptRef, { reference: attempt.reference });
    expect(initialized).toMatchObject({ state: "checkout_pending", authorizationUrl: "https://checkout.paystack.test/session", replayed: false });
    expect(await f.guardian.action(initializeAttemptRef, { reference: attempt.reference })).toMatchObject({ replayed: true });
    const verified = await f.guardian.action(verifyReturnRef, { reference: attempt.reference });
    expect(verified).toMatchObject({ state: "paid" });
    expect(await f.guardian.action(verifyReturnRef, { reference: attempt.reference })).toMatchObject({ state: "paid", replayed: true });
    expect(await f.t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", attempt.attemptId)).collect())).toHaveLength(1);
    const mismatch = await f.guardian.mutation(createAttemptRef, { schoolSlug: "admissions-school", productSlug: "application-slot", idempotencyKey: "mismatched-return" });
    await f.guardian.action(initializeAttemptRef, { reference: mismatch.reference });
    providerReference = "another-merchant-reference";
    await expect(f.guardian.action(verifyReturnRef, { reference: mismatch.reference })).rejects.toThrow("does not match");
    expect(await f.t.run((ctx) => ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", mismatch.attemptId)).unique())).toBeNull();
  } finally {
    fetchMock.mockRestore();
    if (priorKey === undefined) delete process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY;
    else process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY = priorKey;
  }
}, 15_000);

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
  const correction = await f.guardian.mutation(saveDraftRef, { applicationId: application.applicationId, expectedVersion: 1, mutationKey: "draft-save-005", answers: [{ fieldKey: "reason", valueType: "string", serializedValue: "Updated reason" }] });
  const resubmitted = await f.guardian.mutation(submitRef, { applicationId: application.applicationId, expectedVersion: correction.draftVersion, submissionKey: "submission-002", signerName: "Grace Okafor", signerRelationship: "Mother", declarationAccepted: true });
  expect(resubmitted.revision).toBe(2);
  expect(await f.t.run((ctx) => ctx.db.get(submitted.snapshotId))).toEqual(snapshotBefore);
  expect(await f.t.run((ctx) => ctx.db.query("admissionsSubmissionSnapshots").withIndex("by_application_and_revision", (q) => q.eq("applicationId", application.applicationId)).collect())).toHaveLength(2);
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
  expect(JSON.stringify(basic)).not.toContain("Sensitive note");
  await expect(f.limited.mutation(revealSensitiveApplicationDetailRef, { schoolId: f.schoolId, applicationId: application.applicationId, reason: "Review health support" })).rejects.toThrow("capability");
  const sensitive = await f.staff.mutation(revealSensitiveApplicationDetailRef, { schoolId: f.schoolId, applicationId: application.applicationId, reason: "Review health support" });
  expect(sensitive).toMatchObject({ answers: [{ fieldKey: "medical-note", serializedValue: "Sensitive note" }], documents: [{ documentKey: "opaque-sensitive-document", fileName: "medical.pdf" }] });
  expect(JSON.stringify(sensitive)).not.toContain("storageId");
  expect(await f.t.run((ctx) => ctx.db.query("admissionsAuditEvents").withIndex("by_school_and_action_and_created_at", (q) => q.eq("schoolId", f.schoolId).eq("action", "application.reveal_sensitive")).unique())).toMatchObject({ applicationId: application.applicationId, actorUserId: f.staffUserId });
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
  await f.limited.mutation(startReviewRef, { schoolId: f.schoolId, applicationId: application.applicationId });
  await expect(f.limited.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "The application has been accepted." })).rejects.toThrow("capability");
  await expect(f.staff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "" })).rejects.toThrow("Guardian-safe");
  const decision = await f.staff.mutation(decisionRef, { schoolId: f.schoolId, applicationId: application.applicationId, state: "accepted", reasonCode: "MEETS_REQUIREMENTS", guardianMessage: "The application has been accepted.", rationale: "Reviewed" });
  expect(decision).toMatchObject({ version: 1, replayed: false });
  await expect(f.staff.mutation(startReviewRef, { schoolId: f.otherSchoolId, applicationId: application.applicationId })).rejects.toThrow();
});
