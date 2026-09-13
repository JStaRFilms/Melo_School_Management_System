import { makeFunctionReference } from "convex/server";
import type { Id } from "../../_generated/dataModel";
import type { ApplicationLinkV1 } from "@school/shared";

export type AdmissionsDataClass = "public" | "internal" | "personal" | "child_confidential" | "highly_sensitive" | "financial_security";
export type CampaignFieldInput = { fieldKey: string; sectionKey: string; kind: string; label: string; helpText?: string; requiredMode: "required" | "optional" | "conditional"; dataClass: AdmissionsDataClass; purpose?: string; validationJson: string; conditionalRuleJson?: string; approvalEvidenceId?: Id<"schoolApprovalEvidence">; order: number };
export type CampaignRequirementInput = { requirementKey: string; category: string; label: string; requiredMode: "required" | "optional" | "conditional"; acceptedMimeTypes: string[]; maxBytes: number; maxFiles: number; sensitivity: AdmissionsDataClass; purpose: string; conditionJson?: string; approvalEvidenceId?: Id<"schoolApprovalEvidence">; order: number };
export type CampaignIds = { programmeId: Id<"admissionsProgrammes">; intakeId: Id<"admissionsIntakes">; formVersionId: Id<"admissionsFormVersions">; declarationVersionId: Id<"admissionsDeclarationVersions">; productId: Id<"admissionsProducts">; priceId: Id<"admissionsProductPrices"> };
export type CampaignInput = { schoolId: Id<"schools">; programmeSlug: string; programmeName: string; programmeDescription?: string; intakeSlug: string; intakeName: string; cycleLabel: string; targetClassId?: Id<"classes">; opensAt: number; closesAt: number; startsAt?: number; schemaVersion: string; fields: CampaignFieldInput[]; requirements: CampaignRequirementInput[]; declarationTitle: string; declarationBody: string; declarationPurpose: string; productSlug: string; productName: string; amountMinor: number; currency: string; refundPolicyKey: string; feeDisclosure: string; effectiveFrom: number; effectiveTo?: number };
export type CampaignBundle = CampaignIds & Omit<CampaignInput, "schoolId" | "programmeDescription" | "targetClassId" | "startsAt" | "effectiveTo"> & { lifecycle: "draft" | "published"; draftRevision: string; applicationLink: ApplicationLinkV1; programmeDescription: string | null; startsAt: number | null; effectiveTo: number | null; formVersion: number };
export type CampaignDraftResult = CampaignIds & { draftRevision: string };
export type OfferingSummary = { intakeSlug: string; intakeName: string; cycleLabel: string; availability: "open" | "upcoming" | "paused" | "closed" | "unavailable"; opensAt: number; closesAt: number; programmeName: string | null; productSlug: string | null; productName: string | null; amountMinor: number | null; currency: string | null; feeDisclosure: string | null; refundPolicyKey: string | null };
export type QueueItem = { applicationId: Id<"admissionsApplications">; publicId: string; state: string; intakeId: Id<"admissionsIntakes">; currentRevision: number; updatedAt: number };
export type DocumentMetadata = { documentKey: string; requirementId: Id<"admissionsDocumentRequirements"> | null; category: string; fileName: string; mimeType: string; byteSize: number; sha256: string; version: number; submittedState: string; currentState: string; sensitivity: string };
export type ImmutableDetail = { context: { applicationId: Id<"admissionsApplications">; publicId: string; state: string; intakeId: Id<"admissionsIntakes">; currentRevision: number; snapshotId: Id<"admissionsSubmissionSnapshots">; submittedAt: number; signerName: string; signerRelationship: string; declarationAcceptedAt: number }; profile: { firstName: string; lastName: string; middleName: string | null; dateOfBirth: number; gender: string | null; preferredName: string | null; nationality: string | null; countryOfBirth: string | null; address: string | null }; primaryContact: { fullName: string; relationship: string; email: string | null; phone: string | null; address: string | null }; requestedEntryLabel: string | null; answers: Array<{ fieldKey: string; valueType: string; serializedValue: string; dataClass: string }>; documents: DocumentMetadata[] };
export type Workflow = { fieldKeys: string[]; requirements: Array<{ requirementId: Id<"admissionsDocumentRequirements">; label: string }> };
export type ConversionWorkflow = { classes: Array<{ classId: Id<"classes">; name: string; level: string }>; families: Array<{ familyId: Id<"families">; name: string }>; conversion: null | { state: string; errorCode: string | null; admissionNumber: string | null; onboardingState: string | null; idempotencyKey: string } };
export type WorkspaceResult = { schoolId: Id<"schools">; entitlements: Array<{ entitlementId: Id<"admissionsEntitlements">; state: string; applicationId: Id<"admissionsApplications"> | null; createdAt: number }>; applications: Array<{ applicationId: Id<"admissionsApplications">; publicId: string; state: string; draftVersion: number; currentRevision: number; updatedAt: number }>; attempts: Array<{ reference: string; state: string; amountMinor: number; currency: string; entitlementId: Id<"admissionsEntitlements"> | null; createdAt: number }> };

export const cleanupUploadIntentRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents"> },
  null
>("functions/admissions/documents:cleanupUploadIntent");

export const beginHttpUploadRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadAttemptId: string },
  { contentType: string; expectedSize: number; expectedSha256: string }
>("functions/admissions/documents:beginHttpUpload");

export const recordHttpUploadStorageRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadAttemptId: string; storageId: Id<"_storage"> },
  null
>("functions/admissions/documents:recordHttpUploadStorage");

export const failHttpUploadRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadAttemptId: string; failureReason: string },
  null
>("functions/admissions/documents:failHttpUpload");

export const processConversionRef = makeFunctionReference<
  "mutation",
  { conversionId: Id<"admissionsConversions"> },
  null
>("functions/admissions/conversion:processAcceptedConversion");

export const conversionTransactionRef = makeFunctionReference<
  "mutation",
  { conversionId: Id<"admissionsConversions"> },
  null
>("functions/admissions/conversion:processAcceptedConversionTransaction");

export const processOnboardingRef = makeFunctionReference<
  "action",
  { outboxId: Id<"admissionsCommunicationOutbox"> },
  null
>("functions/admissions/conversion:processOnboarding");

export const claimOnboardingDeliveryRef = makeFunctionReference<
  "mutation",
  { outboxId: Id<"admissionsCommunicationOutbox">; now: number },
  null | { attemptNumber: number; recipientEmail: string; schoolName: string; schoolSlug: string; studentName: string; applicationPublicId: string }
>("functions/admissions/conversion:claimOnboardingDelivery");

export const finishOnboardingDeliveryRef = makeFunctionReference<
  "mutation",
  { outboxId: Id<"admissionsCommunicationOutbox">; attemptNumber: number; succeeded: boolean; errorCode?: string; now: number },
  { retryAt: number | null }
>("functions/admissions/conversion:finishOnboardingDelivery");

export const queueOnboardingRef = makeFunctionReference<
  "mutation",
  { conversionId: Id<"admissionsConversions"> },
  null
>("functions/admissions/conversion:queueOnboarding");

export const ownedProviderAttemptRef = makeFunctionReference<
  "query",
  { reference: string },
  {
    attemptId: Id<"admissionsPurchaseAttempts">;
    schoolId: Id<"schools">;
    schoolSlug: string;
    guardianEmail: string;
    providerMode: "test" | "live";
    reference: string;
    amountMinor: number;
    currency: string;
    state: string;
    authorizationUrl: string | null;
    entitlementId: Id<"admissionsEntitlements"> | null;
  }
>("functions/admissions/payments:getOwnedProviderAttemptInternal");

export const markCheckoutInitializedRef = makeFunctionReference<
  "mutation",
  { attemptId: Id<"admissionsPurchaseAttempts">; authorizationUrl: string; authorizationReference?: string },
  { state: string; authorizationUrl: string; replayed: boolean }
>("functions/admissions/payments:markCheckoutInitialized");

export const processRetentionCleanupRef = makeFunctionReference<
  "mutation",
  { now?: number; limit?: number },
  { inspected: number; archived: number; deleted: number; blocked: number }
>("functions/admissions/retention:processRetentionCleanup");

export const listCampaignsRef = makeFunctionReference<"query", { schoolId: Id<"schools">; now: number }, CampaignBundle[]>("functions/admissions/catalogue:listCampaigns");
export const createCampaignDraftRef = makeFunctionReference<"mutation", CampaignInput, CampaignDraftResult>("functions/admissions/catalogue:createCampaignDraft");
export const editCampaignDraftRef = makeFunctionReference<"mutation", CampaignInput & CampaignIds & { expectedDraftRevision: string }, CampaignDraftResult>("functions/admissions/catalogue:editCampaignDraft");
export const createReplacementDraftRef = makeFunctionReference<"mutation", Omit<CampaignInput, "programmeSlug" | "programmeName" | "programmeDescription" | "intakeSlug" | "intakeName" | "cycleLabel" | "targetClassId" | "opensAt" | "closesAt" | "startsAt" | "productSlug" | "productName"> & Pick<CampaignIds, "programmeId" | "intakeId" | "productId">, CampaignDraftResult>("functions/admissions/catalogue:createReplacementDraft");
export const publishCampaignRef = makeFunctionReference<"mutation", CampaignIds, null>("functions/admissions/catalogue:publishCampaign");
export const closeCampaignRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; intakeId: Id<"admissionsIntakes"> }, null>("functions/admissions/catalogue:closeCampaign");
export const listPublishedOfferingsRef = makeFunctionReference<"query", { schoolSlug: string; now: number }, { available: false } | { available: true; school: { schoolId: Id<"schools">; slug: string; name: string; primaryColor: string; accentColor: string }; offerings: OfferingSummary[] }>("functions/admissions/catalogue:listPublishedOfferings");
export const getPublishedOfferingRef = makeFunctionReference<"query", { schoolSlug: string; intakeSlug: string; now: number }, { available: false; link: { version: "1"; schoolSlug: string; href: string; availability: "open" | "upcoming" | "paused" | "closed" | "unavailable"; intakeSlug: string | null; opensAt: number | null; closesAt: number | null } } | { available: true; link: { version: "1"; schoolSlug: string; href: string; availability: "open" | "upcoming" | "paused" | "closed" | "unavailable"; intakeSlug: string | null; opensAt: number | null; closesAt: number | null }; school: { slug: string; name: string }; programme: { slug: string; name: string; description: string | null }; intake: { slug: string; name: string; cycleLabel: string; opensAt: number; closesAt: number; startsAt: number | null }; product: { slug: string; name: string }; price: { amountMinor: number; currency: string; feeDisclosure: string; refundPolicyKey: string }; form: { schemaVersion: string; fields: Array<{ fieldKey: string; sectionKey: string; kind: string; label: string; helpText: string | null; requiredMode: string; dataClass: string; purpose: string | null; validationJson: string; conditionalRuleJson: string | null; order: number }>; requirements: Array<{ requirementKey: string; category: string; label: string; requiredMode: string; acceptedMimeTypes: string[]; maxBytes: number; maxFiles: number; sensitivity: string; purpose: string; conditionJson: string | null; order: number }> }; declaration: { title: string; body: string; purpose: string; version: number } }>("functions/admissions/catalogue:getPublishedOffering");
export const listQueuePageRef = makeFunctionReference<"query", { schoolId: Id<"schools">; state: "submitted" | "under_review" | "changes_requested" | "waitlisted" | "accepted" | "rejected"; paginationOpts: { numItems: number; cursor: string | null } }, { page: QueueItem[]; isDone: boolean; continueCursor: string }>("functions/admissions/staff:listQueuePage");
export const resolveApplicationByPublicIdRef = makeFunctionReference<"query", { schoolId: Id<"schools">; publicId: string }, { applicationId: Id<"admissionsApplications">; state: string } | null>("functions/admissions/staff:resolveApplicationByPublicId");
export const getApplicationDetailRef = makeFunctionReference<"query", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications"> }, ImmutableDetail>("functions/admissions/staff:getApplicationDetail");
export const getApplicationWorkflowRef = makeFunctionReference<"query", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications"> }, Workflow>("functions/admissions/staff:getApplicationWorkflow");
export const getConversionWorkflowRef = makeFunctionReference<"query", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications"> }, ConversionWorkflow>("functions/admissions/staff:getConversionWorkflow");
export const getAdmissionNumberPolicyRef = makeFunctionReference<"query", { schoolId: Id<"schools">; level?: string }, { policy: object | null; version: number; formatVersion: string | null; counter: { key: string; configVersion: number } | null; activeSessionId: Id<"academicSessions"> | null; resetPeriod: string | null; preview: string | null; unavailableReason: string | null }>("functions/academic/admissionNumbers:getAdmissionNumberPolicy");
export const revealSensitiveApplicationDetailRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications">; reason: string }, { context: ImmutableDetail["context"]; answers: ImmutableDetail["answers"]; documents: DocumentMetadata[] }>("functions/admissions/staff:revealSensitiveApplicationDetail");
export const startReviewRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications"> }, null>("functions/admissions/staff:startReview");
export const requestChangesRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications">; fieldKeys: string[]; requirementIds: Id<"admissionsDocumentRequirements">[]; reasonCode: string; guardianMessage: string }, null>("functions/admissions/staff:requestChanges");
export const recordDocumentReviewRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; documentKey: string; result: "accepted" | "rejected" | "needs_replacement"; reasonCode?: string; guardianMessage?: string; internalNote?: string }, null>("functions/admissions/staff:recordDocumentReview");
export const getDocumentAccessRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; documentKey: string; action: "view" | "download"; reason: string }, { status: "unavailable"; documentKey: string } | { status: "available"; documentKey: string; url: string; expiresAt: number | null }>("functions/admissions/staff:getDocumentAccess");
export const recordDecisionRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications">; state: "accepted" | "rejected"; reasonCode: string; guardianMessage: string; rationale?: string }, { decisionId: Id<"admissionsDecisions">; version: number; replayed: boolean }>("functions/admissions/staff:recordDecision");
export const executeAcceptedConversionRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications">; idempotencyKey: string; classId: Id<"classes">; admissionNumber: string; familyResolution: { kind: "create"; familyName?: string } | { kind: "existing"; familyId: Id<"families"> }; photoDocumentKey?: string; overrideReason?: string; overrideConfirmed?: boolean; overrideCounterDecision?: "keep" | "advance"; advanceCounterTo?: number; numberingVersion?: number; numberingFormatVersion?: string; numberingCounterKey?: string; numberingCounterVersion?: number; numberingSessionId?: Id<"academicSessions">; numberingResetPeriod?: string }, { conversionId: Id<"admissionsConversions">; state: string; replayed: boolean; errorCode?: string | null; admissionNumber?: string }>("functions/admissions/conversion:executeAcceptedConversion");
export const getRetentionPolicyRef = makeFunctionReference<"query", { schoolId: Id<"schools"> }, { mode: "never" | "archive"; archiveAfterDays: number | null; version: number; effectiveFrom: number | null }>("functions/admissions/retention:getPolicy");
export const setRetentionPolicyRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; mode: "never" | "archive"; archiveAfterDays?: number; expectedVersion: number }, { policyId: Id<"admissionsRetentionPolicies">; version: number }>("functions/admissions/retention:setPolicy");
export const getManualDocumentEligibilityRef = makeFunctionReference<"query", { schoolId: Id<"schools">; documentKey: string }, { state: string; canArchive: boolean; canDelete: boolean; archiveBlocker: string | null; deleteBlocker: string | null } | null>("functions/admissions/retention:getManualDocumentEligibility");
export const archiveDocumentManuallyRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; documentKey: string }, { changed: boolean; state: string; blocker: string | null }>("functions/admissions/retention:archiveDocumentManually");
export const deleteDocumentManuallyRef = makeFunctionReference<"mutation", { schoolId: Id<"schools">; documentKey: string }, { changed: boolean; state: string; blocker: string | null }>("functions/admissions/retention:deleteDocumentManually");
export const getOrCreateGuardianIdentityRef = makeFunctionReference<"mutation", Record<string, never>, { guardianId: Id<"admissionsGuardians">; normalizedEmail: string; emailVerifiedAt: number }>("functions/admissions/guardian:getOrCreateIdentity");
export const listGuardianWorkspaceBySlugRef = makeFunctionReference<"query", { schoolSlug: string; limit?: number }, WorkspaceResult>("functions/admissions/guardian:listWorkspaceBySlug");
export const createAttemptRef = makeFunctionReference<"mutation", { schoolSlug: string; productSlug: string; idempotencyKey: string }, { attemptId: Id<"admissionsPurchaseAttempts">; reference: string; state: string; amountMinor: number; currency: string; entitlementId: Id<"admissionsEntitlements"> | null; replayed: boolean }>("functions/admissions/payments:createAttempt");
export const initializeAttemptRef = makeFunctionReference<"action", { reference: string }, { reference: string; state: string; authorizationUrl: string; replayed: boolean }>("functions/admissions/payments:initializeAttempt");
export const verifyReturnRef = makeFunctionReference<"action", { reference: string }, { attemptId: Id<"admissionsPurchaseAttempts">; reference: string; state: string; amountMinor: number; currency: string; entitlementId: Id<"admissionsEntitlements"> | null; replayed: boolean }>("functions/admissions/payments:verifyReturn");
export const getOwnedApplicationByPublicIdRef = makeFunctionReference<"query", { schoolSlug: string; publicId: string }, { applicationId: Id<"admissionsApplications">; publicId: string; state: string; draftVersion: number; currentRevision: number; financialHold: boolean; safeMessages: string[]; conversion: null | { state: "processing" | "completed" | "needs_attention"; message: string; admissionNumber: string | null } } | null>("functions/admissions/applications:getOwnedApplicationByPublicId");
export const createOrResumeApplicationRef = makeFunctionReference<"mutation", { entitlementId: Id<"admissionsEntitlements"> }, { applicationId: Id<"admissionsApplications">; publicId: string; state: string; replayed: boolean }>("functions/admissions/applications:createOrResume");
export const getDraftRef = makeFunctionReference<"query", { applicationId: Id<"admissionsApplications"> }, { state: string; draftVersion: number; currentRevision: number; safeMessages: string[]; requestedEntryLabel: string | null; profile: null | { firstName: string; lastName: string; middleName?: string; dateOfBirth: number; gender?: string; preferredName?: string; nationality?: string; countryOfBirth?: string; address?: string }; primaryContact: null | { fullName: string; relationship: string; email?: string; phone?: string; address?: string }; form: { version: number; schemaVersion: string; status: string; fields: Array<{ fieldKey: string; sectionKey: string; kind: string; label: string; helpText: string | null; requiredMode: string; dataClass: string; purpose: string | null; validationJson: string; conditionalRuleJson: string | null; order: number }>; requirements: Array<{ requirementId: Id<"admissionsDocumentRequirements">; requirementKey: string; category: string; label: string; requiredMode: string; acceptedMimeTypes: string[]; maxBytes: number; maxFiles: number; sensitivity: string; purpose: string; conditionJson: string | null; order: number }> }; declaration: { version: number; title: string; body: string; purpose: string; status: string }; correction: null | { fieldKeys: string[]; requirementIds: Id<"admissionsDocumentRequirements">[]; reasonCode: string; message: string; createdAt: number }; answers: Array<{ fieldKey: string; valueType: string; serializedValue: string; valueVersion: number }>; documents: Array<{ documentKey: string; requirementId: Id<"admissionsDocumentRequirements"> | null; category: string; state: string; version: number }> }>("functions/admissions/applications:getDraft");
export const saveDraftRef = makeFunctionReference<"mutation", { applicationId: Id<"admissionsApplications">; expectedVersion: number; mutationKey: string; requestedEntryLabel?: string; profile?: { firstName: string; lastName: string; middleName?: string; dateOfBirth: number; gender?: string; preferredName?: string; nationality?: string; countryOfBirth?: string; address?: string }; primaryContact?: { fullName: string; relationship: string; email?: string; phone?: string; address?: string }; answers: Array<{ fieldKey: string; valueType: "string" | "number" | "boolean" | "string_array" | "date"; serializedValue: string }>; clearAnswerKeys?: string[] }, { draftVersion: number; replayed: boolean }>("functions/admissions/applications:saveDraft");
export const submitApplicationRef = makeFunctionReference<"mutation", { applicationId: Id<"admissionsApplications">; expectedVersion: number; submissionKey: string; signerName: string; signerRelationship: string; declarationAccepted: boolean }, { snapshotId: Id<"admissionsSubmissionSnapshots">; revision: number; replayed: boolean }>("functions/admissions/applications:submit");
export const requestUploadIntentRef = makeFunctionReference<"mutation", { applicationId: Id<"admissionsApplications">; requirementId: Id<"admissionsDocumentRequirements">; fileName: string; contentType: string; size: number; sha256: string }, { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadPath: "/admissions/document-upload"; expiresAt: number }>("functions/admissions/documents:requestUploadIntent");
export const finalizeUploadRef = makeFunctionReference<"mutation", { uploadIntentId: Id<"admissionsDocumentUploadIntents"> }, { documentKey: string; state: string; replayed: boolean }>("functions/admissions/documents:finalizeUpload");
export const getOwnDocumentAccessRef = makeFunctionReference<"mutation", { documentKey: string; action: "view" | "download" }, { status: "unavailable"; documentKey: string } | { status: "available"; documentKey: string; url: string; expiresAt: number | null }>("functions/admissions/documents:getOwnAccess");

export const recordVerifiedPaymentRef = makeFunctionReference<
  "mutation",
  {
    schoolId: Id<"schools">;
    purchaseAttemptId: Id<"admissionsPurchaseAttempts">;
    provider: "paystack" | "flutterwave" | "stripe" | "manual";
    providerMode: "test" | "live";
    providerEventId: string;
    eventType: string;
    bodyDigest: string;
    amountMinor: number;
    currency: string;
    financialOutcome?: "refunded" | "reversed";
    receivedAt: number;
  },
  { eventId: Id<"admissionsPaymentEvents">; entitlementId: Id<"admissionsEntitlements"> | null; replayed: boolean; processed: boolean; state: string }
>("functions/admissions/payments:recordVerifiedPayment");
