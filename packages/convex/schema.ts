import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  admissionsDataClassValidator,
  admissionsDecisionStateValidator,
  admissionsDocumentStateValidator,
  admissionsEntitlementStateValidator,
  admissionsPermissionValidator,
  admissionsProviderValidator,
  admissionsPurchaseStateValidator,
  applicationStateValidator,
  capabilityScopeValidator,
  paymentProviderModeValidator,
  siteRevisionContentValidator,
} from "./functions/foundation/contracts";

const knowledgeVisibilityValidator = v.union(
  v.literal("private_owner"),
  v.literal("staff_shared"),
  v.literal("class_scoped"),
  v.literal("student_approved")
);

const knowledgeReviewStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("archived")
);

const knowledgeSourceTypeValidator = v.union(
  v.literal("file_upload"),
  v.literal("text_entry"),
  v.literal("youtube_link"),
  v.literal("generated_draft"),
  v.literal("student_upload"),
  v.literal("imported_curriculum")
);

const knowledgeOwnerRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("admin"),
  v.literal("student"),
  v.literal("system")
);

const knowledgeOutputTypeValidator = v.union(
  v.literal("lesson_plan"),
  v.literal("student_note"),
  v.literal("assignment"),
  v.literal("question_bank_draft"),
  v.literal("cbt_draft")
);

const aiRunOutputTypeValidator = v.union(
  v.literal("lesson_plan"),
  v.literal("student_note"),
  v.literal("assignment"),
  v.literal("question_bank_draft"),
  v.literal("cbt_draft"),
  v.literal("curriculum_extraction")
);

const curriculumImportStatusValidator = v.union(
  v.literal("draft"), v.literal("generating"), v.literal("ready_for_review"),
  v.literal("partially_approved"), v.literal("approved"), v.literal("failed"), v.literal("archived")
);

const curriculumUnitReviewStatusValidator = v.union(
  v.literal("proposed"), v.literal("approved"), v.literal("rejected")
);

const assessmentDraftModeValidator = v.union(
  v.literal("practice_quiz"),
  v.literal("class_test"),
  v.literal("exam_draft")
);

const assessmentQuestionStyleValidator = v.union(
  v.literal("balanced"),
  v.literal("open_ended_heavy"),
  v.literal("mixed_open_ended"),
  v.literal("objective_heavy")
);

const assessmentGenerationSettingsValidator = v.object({
  profileId: v.optional(v.id("assessmentGenerationProfiles")),
  profileName: v.optional(v.string()),
  questionStyle: assessmentQuestionStyleValidator,
  totalQuestions: v.number(),
  questionMix: v.object({
    multiple_choice: v.number(),
    short_answer: v.number(),
    essay: v.number(),
    true_false: v.number(),
    fill_in_the_blank: v.number(),
  }),
  allowTeacherOverrides: v.boolean(),
  overrideReason: v.optional(v.string()),
});

const knowledgeArtifactStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("archived"),
  v.literal("superseded")
);

const knowledgeBindingStatusValidator = v.union(
  v.literal("active"),
  v.literal("revoked")
);

const knowledgeBindingPurposeValidator = v.union(
  v.literal("review_queue"),
  v.literal("supplemental_upload"),
  v.literal("topic_attachment")
);

const knowledgeSearchStatusValidator = v.union(
  v.literal("not_indexed"),
  v.literal("indexing"),
  v.literal("indexed"),
  v.literal("failed")
);

const knowledgeMaterialProcessingStatusValidator = v.union(
  v.literal("awaiting_upload"),
  v.literal("queued"),
  v.literal("extracting"),
  v.literal("ocr_needed"),
  v.literal("ready"),
  v.literal("failed")
);

const knowledgeTemplateScopeValidator = v.union(
  v.literal("subject_and_level"),
  v.literal("subject_only"),
  v.literal("level_only"),
  v.literal("school_default")
);

const knowledgeRevisionKindValidator = v.union(
  v.literal("generated"),
  v.literal("manual_save"),
  v.literal("approval_snapshot"),
  v.literal("publish_snapshot"),
  v.literal("archive_snapshot"),
  v.literal("source_refresh")
);

const knowledgeQuestionDifficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);

const knowledgeQuestionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("short_answer"),
  v.literal("essay"),
  v.literal("true_false"),
  v.literal("fill_in_the_blank")
);

const knowledgeAIRunStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled")
);

const knowledgeAuditEventTypeValidator = v.union(
  v.literal("approved"),
  v.literal("promoted"),
  v.literal("published"),
  v.literal("rejected"),
  v.literal("archived"),
  v.literal("overridden"),
  v.literal("topic_attached"),
  v.literal("class_bound"),
  v.literal("visibility_changed"),
  v.literal("created"),
  v.literal("ingestion_started"),
  v.literal("extraction_completed"),
  v.literal("ocr_needed"),
  v.literal("ocr_requested"),
  v.literal("ocr_started"),
  v.literal("ocr_succeeded"),
  v.literal("ocr_failed"),
  v.literal("ingestion_failed"),
  v.literal("retry_requested")
);

const knowledgeTopicStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("retired")
);

const rateLimitActionValidator = v.union(
  v.literal("teacher_lesson_plan_generation"),
  v.literal("teacher_assessment_generation"),
  v.literal("knowledge_material_upload_url"),
  v.literal("knowledge_material_link_registration"),
  v.literal("knowledge_material_ingestion_retry"),
  v.literal("knowledge_material_ocr_retry"),
  v.literal("portal_supplemental_upload_url")
);

export default defineSchema({
  // Platform super admin accounts (not school-scoped)
  platformAdmins: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth", ["authId"])
    .index("by_email", ["email"]),

  // Stub tables for prerequisite data (from prior FRs)
  schools: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("active"), v.literal("suspended"))),
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    logoContentType: v.optional(v.string()),
    logoUpdatedAt: v.optional(v.number()),
    motto: v.optional(v.string()),
    theme: v.optional(
      v.object({
        primaryColor: v.string(),
        accentColor: v.string(),
      })
    ),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    features: v.optional(
      v.object({
        billing: v.boolean(),
        curriculum: v.boolean(),
        knowledgeLibrary: v.boolean(),
        admissions: v.boolean(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // Shared B0 foundation. These tables are additive and intentionally contain
  // contracts/data boundaries only; B1 and B4 own their feature behaviour.
  admissionsGuardians: defineTable({
    authTokenIdentifier: v.string(),
    betterAuthUserId: v.optional(v.string()),
    normalizedEmail: v.string(),
    emailVerifiedAt: v.optional(v.number()),
    normalizedPhone: v.optional(v.string()),
    phoneVerifiedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("suspended")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth_token_identifier", ["authTokenIdentifier"])
    .index("by_better_auth_user_id", ["betterAuthUserId"])
    .index("by_normalized_email", ["normalizedEmail"]),

  admissionsProgrammes: defineTable({
    schoolId: v.id("schools"),
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("closed"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_slug", ["schoolId", "slug"])
    .index("by_school_and_status", ["schoolId", "status"]),

  admissionsIntakes: defineTable({
    schoolId: v.id("schools"),
    programmeId: v.id("admissionsProgrammes"),
    slug: v.string(),
    name: v.string(),
    cycleLabel: v.string(),
    targetClassId: v.optional(v.id("classes")),
    opensAt: v.number(),
    closesAt: v.number(),
    startsAt: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("open"), v.literal("paused"), v.literal("closed"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_slug", ["schoolId", "slug"])
    .index("by_school_and_status_and_opens_at", ["schoolId", "status", "opensAt"])
    .index("by_programme_and_status", ["programmeId", "status"]),

  admissionsFormVersions: defineTable({
    schoolId: v.id("schools"),
    programmeId: v.id("admissionsProgrammes"),
    intakeId: v.optional(v.id("admissionsIntakes")),
    version: v.number(),
    schemaVersion: v.string(),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("retired")),
    publishedAt: v.optional(v.number()),
    publishedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_programme", ["schoolId", "programmeId"])
    .index("by_intake_and_status", ["intakeId", "status"])
    .index("by_school_and_programme_and_version", ["schoolId", "programmeId", "version"]),

  admissionsFormFields: defineTable({
    schoolId: v.id("schools"),
    formVersionId: v.id("admissionsFormVersions"),
    fieldKey: v.string(),
    sectionKey: v.string(),
    kind: v.string(),
    label: v.string(),
    helpText: v.optional(v.string()),
    requiredMode: v.union(v.literal("required"), v.literal("optional"), v.literal("conditional")),
    dataClass: admissionsDataClassValidator,
    purpose: v.optional(v.string()),
    validationJson: v.string(),
    conditionalRuleJson: v.optional(v.string()),
    order: v.number(),
    status: v.union(v.literal("active"), v.literal("retired")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_form_version_and_order", ["formVersionId", "order"])
    .index("by_form_version_and_field_key", ["formVersionId", "fieldKey"])
    .index("by_school_and_data_class", ["schoolId", "dataClass"]),

  admissionsDocumentRequirements: defineTable({
    schoolId: v.id("schools"),
    formVersionId: v.id("admissionsFormVersions"),
    requirementKey: v.string(),
    category: v.string(),
    label: v.string(),
    requiredMode: v.union(v.literal("required"), v.literal("optional"), v.literal("conditional")),
    acceptedMimeTypes: v.array(v.string()),
    maxBytes: v.number(),
    maxFiles: v.number(),
    sensitivity: admissionsDataClassValidator,
    purpose: v.string(),
    conditionJson: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_form_version_and_order", ["formVersionId", "order"])
    .index("by_form_version_and_requirement_key", ["formVersionId", "requirementKey"])
    .index("by_school_and_category", ["schoolId", "category"]),

  admissionsDeclarationVersions: defineTable({
    schoolId: v.id("schools"),
    programmeId: v.id("admissionsProgrammes"),
    version: v.number(),
    title: v.string(),
    body: v.string(),
    bodyDigest: v.string(),
    purpose: v.string(),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("retired")),
    publishedAt: v.optional(v.number()),
    publishedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_programme_and_version", ["schoolId", "programmeId", "version"])
    .index("by_programme_and_status", ["programmeId", "status"]),

  admissionsProducts: defineTable({
    schoolId: v.id("schools"),
    intakeId: v.id("admissionsIntakes"),
    slug: v.string(),
    name: v.string(),
    slotCount: v.literal(1),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("retired")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_intake", ["schoolId", "intakeId"])
    .index("by_school_and_slug", ["schoolId", "slug"])
    .index("by_intake_and_status", ["intakeId", "status"]),

  admissionsProductPrices: defineTable({
    schoolId: v.id("schools"),
    productId: v.id("admissionsProducts"),
    version: v.number(),
    amountMinor: v.number(),
    currency: v.string(),
    refundPolicyKey: v.string(),
    feeDisclosure: v.string(),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("retired")),
    approvalEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product_and_version", ["productId", "version"])
    .index("by_product_and_status_and_effective_from", ["productId", "status", "effectiveFrom"])
    .index("by_school_and_status", ["schoolId", "status"]),

  admissionsPurchaseAttempts: defineTable({
    schoolId: v.id("schools"),
    guardianId: v.id("admissionsGuardians"),
    productId: v.id("admissionsProducts"),
    priceId: v.id("admissionsProductPrices"),
    provider: admissionsProviderValidator,
    providerMode: paymentProviderModeValidator,
    reference: v.string(),
    idempotencyKey: v.string(),
    amountMinor: v.number(),
    currency: v.string(),
    feeDisclosureSnapshot: v.string(),
    state: admissionsPurchaseStateValidator,
    providerAuthorizationReference: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    failureCode: v.optional(v.string()),
    entitlementId: v.optional(v.id("admissionsEntitlements")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reference", ["reference"])
    .index("by_school_and_reference", ["schoolId", "reference"])
    .index("by_guardian_and_created_at", ["guardianId", "createdAt"])
    .index("by_school_and_state_and_created_at", ["schoolId", "state", "createdAt"])
    .index("by_school_and_guardian_and_idempotency_key", ["schoolId", "guardianId", "idempotencyKey"]),

  admissionsPaymentEvents: defineTable({
    schoolId: v.id("schools"),
    purchaseAttemptId: v.id("admissionsPurchaseAttempts"),
    provider: admissionsProviderValidator,
    providerMode: paymentProviderModeValidator,
    providerEventId: v.string(),
    eventType: v.string(),
    bodyDigest: v.string(),
    signatureValid: v.boolean(),
    processingStatus: v.union(v.literal("received"), v.literal("verified"), v.literal("processed"), v.literal("ignored"), v.literal("rejected")),
    processingMessage: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_provider_and_provider_event_id", ["schoolId", "provider", "providerEventId"])
    .index("by_purchase_attempt_and_received_at", ["purchaseAttemptId", "receivedAt"])
    .index("by_school_and_processing_status_and_received_at", ["schoolId", "processingStatus", "receivedAt"]),

  admissionsEntitlements: defineTable({
    schoolId: v.id("schools"),
    guardianId: v.id("admissionsGuardians"),
    productId: v.id("admissionsProducts"),
    intakeId: v.id("admissionsIntakes"),
    sourcePurchaseAttemptId: v.id("admissionsPurchaseAttempts"),
    state: admissionsEntitlementStateValidator,
    applicationId: v.optional(v.id("admissionsApplications")),
    reservedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
    voidReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source_purchase_attempt", ["sourcePurchaseAttemptId"])
    .index("by_guardian_and_state_and_created_at", ["guardianId", "state", "createdAt"])
    .index("by_school_and_state_and_created_at", ["schoolId", "state", "createdAt"])
    .index("by_application", ["applicationId"]),

  admissionsApplications: defineTable({
    schoolId: v.id("schools"),
    guardianId: v.id("admissionsGuardians"),
    entitlementId: v.id("admissionsEntitlements"),
    programmeId: v.id("admissionsProgrammes"),
    intakeId: v.id("admissionsIntakes"),
    productId: v.id("admissionsProducts"),
    priceId: v.id("admissionsProductPrices"),
    formVersionId: v.id("admissionsFormVersions"),
    declarationVersionId: v.id("admissionsDeclarationVersions"),
    publicId: v.string(),
    state: applicationStateValidator,
    currentRevision: v.number(),
    latestSnapshotId: v.optional(v.id("admissionsSubmissionSnapshots")),
    currentDecisionId: v.optional(v.id("admissionsDecisions")),
    conversionId: v.optional(v.id("admissionsConversions")),
    requestedEntryLabel: v.optional(v.string()),
    draftVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entitlement", ["entitlementId"])
    .index("by_school_and_public_id", ["schoolId", "publicId"])
    .index("by_guardian_and_updated_at", ["guardianId", "updatedAt"])
    .index("by_school_and_state_and_updated_at", ["schoolId", "state", "updatedAt"])
    .index("by_school_and_intake_and_state", ["schoolId", "intakeId", "state"]),

  admissionsApplicantProfiles: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    firstName: v.string(),
    lastName: v.string(),
    middleName: v.optional(v.string()),
    dateOfBirth: v.number(),
    gender: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    nationality: v.optional(v.string()),
    countryOfBirth: v.optional(v.string()),
    address: v.optional(v.string()),
    normalizedName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_school_and_normalized_name_and_date_of_birth", ["schoolId", "normalizedName", "dateOfBirth"]),

  admissionsApplicationAnswers: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    formFieldId: v.id("admissionsFormFields"),
    fieldKey: v.string(),
    valueType: v.string(),
    serializedValue: v.string(),
    dataClass: admissionsDataClassValidator,
    valueVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application_and_field_key", ["applicationId", "fieldKey"])
    .index("by_form_field", ["formFieldId"])
    .index("by_school_and_data_class", ["schoolId", "dataClass"]),

  admissionsSubmissionSnapshots: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    revision: v.number(),
    formVersionId: v.id("admissionsFormVersions"),
    declarationVersionId: v.id("admissionsDeclarationVersions"),
    productPriceId: v.id("admissionsProductPrices"),
    requirementsDigest: v.string(),
    canonicalDigest: v.string(),
    signerGuardianId: v.id("admissionsGuardians"),
    signerName: v.string(),
    signerRelationship: v.string(),
    submittedAt: v.number(),
    declarationAcceptedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_application_and_revision", ["applicationId", "revision"])
    .index("by_school_and_submitted_at", ["schoolId", "submittedAt"])
    .index("by_canonical_digest", ["canonicalDigest"]),

  admissionsSubmissionSnapshotItems: defineTable({
    schoolId: v.id("schools"),
    snapshotId: v.id("admissionsSubmissionSnapshots"),
    itemKey: v.string(),
    kind: v.string(),
    valueType: v.string(),
    serializedValue: v.string(),
    dataClass: admissionsDataClassValidator,
    sourceRowId: v.optional(v.string()),
    sourceVersion: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_snapshot_and_item_key", ["snapshotId", "itemKey"])
    .index("by_school_and_data_class", ["schoolId", "dataClass"])
    .index("by_snapshot_and_kind", ["snapshotId", "kind"]),

  admissionsDocuments: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    requirementId: v.optional(v.id("admissionsDocumentRequirements")),
    category: v.string(),
    documentKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    sha256: v.string(),
    version: v.number(),
    state: admissionsDocumentStateValidator,
    sensitivity: admissionsDataClassValidator,
    uploadedByGuardianId: v.optional(v.id("admissionsGuardians")),
    supersedesDocumentId: v.optional(v.id("admissionsDocuments")),
    retentionHold: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application_and_category_and_version", ["applicationId", "category", "version"])
    .index("by_document_key", ["documentKey"])
    .index("by_storage", ["storageId"])
    .index("by_school_and_state_and_updated_at", ["schoolId", "state", "updatedAt"])
    .index("by_application_and_requirement", ["applicationId", "requirementId"]),

  admissionsDocumentAccessAudits: defineTable({
    schoolId: v.id("schools"),
    documentId: v.id("admissionsDocuments"),
    actorKind: v.union(v.literal("guardian"), v.literal("staff"), v.literal("system")),
    guardianId: v.optional(v.id("admissionsGuardians")),
    actorUserId: v.optional(v.id("users")),
    action: v.union(v.literal("view"), v.literal("download")),
    outcome: v.union(v.literal("granted"), v.literal("denied")),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_document_and_created_at", ["documentId", "createdAt"])
    .index("by_school_and_actor_user_and_created_at", ["schoolId", "actorUserId", "createdAt"]),

  admissionsDecisions: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    version: v.number(),
    state: admissionsDecisionStateValidator,
    reasonCode: v.optional(v.string()),
    rationale: v.optional(v.string()),
    decidedBy: v.id("users"),
    decidedAt: v.number(),
    supersedesDecisionId: v.optional(v.id("admissionsDecisions")),
    createdAt: v.number(),
  })
    .index("by_application_and_version", ["applicationId", "version"])
    .index("by_school_and_state_and_decided_at", ["schoolId", "state", "decidedAt"])
    .index("by_school_and_decided_by_and_decided_at", ["schoolId", "decidedBy", "decidedAt"]),

  admissionsConversions: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    acceptedDecisionId: v.id("admissionsDecisions"),
    snapshotId: v.id("admissionsSubmissionSnapshots"),
    idempotencyKey: v.string(),
    state: v.union(v.literal("pending"), v.literal("running"), v.literal("succeeded"), v.literal("failed_retryable"), v.literal("failed_terminal")),
    classId: v.optional(v.id("classes")),
    admissionNumber: v.optional(v.string()),
    familyId: v.optional(v.id("families")),
    studentId: v.optional(v.id("students")),
    errorCode: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_school_and_state_and_updated_at", ["schoolId", "state", "updatedAt"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_student", ["studentId"]),

  admissionsApplicationContacts: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    contactKey: v.string(),
    kind: v.union(v.literal("parent"), v.literal("guardian"), v.literal("emergency")),
    fullName: v.string(),
    relationship: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    isApplicantGuardian: v.boolean(),
    isPrimary: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application_and_contact_key", ["applicationId", "contactKey"])
    .index("by_school_and_email", ["schoolId", "email"])
    .index("by_application_and_is_primary", ["applicationId", "isPrimary"]),

  admissionsPreviousSchools: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    name: v.string(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    classLabel: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application_and_end_date", ["applicationId", "endDate"])
    .index("by_school_and_application", ["schoolId", "applicationId"]),

  admissionsDocumentReviews: defineTable({
    schoolId: v.id("schools"),
    documentId: v.id("admissionsDocuments"),
    reviewerUserId: v.id("users"),
    result: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("needs_replacement")),
    reasonCode: v.optional(v.string()),
    guardianMessage: v.optional(v.string()),
    internalNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_document_and_created_at", ["documentId", "createdAt"])
    .index("by_school_and_reviewer_user_and_created_at", ["schoolId", "reviewerUserId", "createdAt"]),

  admissionsReviewAssignments: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    assigneeUserId: v.id("users"),
    role: v.string(),
    state: v.union(v.literal("assigned"), v.literal("completed"), v.literal("cancelled")),
    dueAt: v.optional(v.number()),
    assignedByUserId: v.id("users"),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_assignee_user_and_state", ["schoolId", "assigneeUserId", "state"])
    .index("by_application_and_state", ["applicationId", "state"])
    .index("by_school_and_state_and_due_at", ["schoolId", "state", "dueAt"]),

  admissionsReviewEvents: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    snapshotId: v.optional(v.id("admissionsSubmissionSnapshots")),
    actorUserId: v.optional(v.id("users")),
    actorGuardianId: v.optional(v.id("admissionsGuardians")),
    eventType: v.string(),
    visibility: v.union(v.literal("guardian"), v.literal("staff")),
    reasonCode: v.optional(v.string()),
    message: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_application_and_created_at", ["applicationId", "createdAt"])
    .index("by_school_and_event_type_and_created_at", ["schoolId", "eventType", "createdAt"])
    .index("by_school_and_visibility_and_created_at", ["schoolId", "visibility", "createdAt"]),

  admissionsEvaluations: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    type: v.union(v.literal("entrance_assessment"), v.literal("interview")),
    state: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")),
    scheduledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    resultCode: v.optional(v.string()),
    score: v.optional(v.number()),
    evaluatorUserId: v.optional(v.id("users")),
    version: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_application_and_type_and_version", ["applicationId", "type", "version"])
    .index("by_school_and_state_and_scheduled_at", ["schoolId", "state", "scheduledAt"])
    .index("by_school_and_evaluator_user_and_state", ["schoolId", "evaluatorUserId", "state"]),

  admissionsConversionAttempts: defineTable({
    schoolId: v.id("schools"),
    conversionId: v.id("admissionsConversions"),
    attemptNumber: v.number(),
    workerKey: v.string(),
    outcome: v.union(v.literal("succeeded"), v.literal("retryable_failure"), v.literal("terminal_failure")),
    errorCode: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_conversion_and_attempt_number", ["conversionId", "attemptNumber"])
    .index("by_school_and_outcome_and_started_at", ["schoolId", "outcome", "startedAt"]),

  admissionsCommunicationOutbox: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.optional(v.id("admissionsApplications")),
    conversionId: v.optional(v.id("admissionsConversions")),
    eventKey: v.string(),
    recipientGuardianId: v.id("admissionsGuardians"),
    channel: v.union(v.literal("email"), v.literal("sms")),
    templateKey: v.string(),
    templateVersion: v.string(),
    state: v.union(v.literal("pending"), v.literal("sending"), v.literal("sent"), v.literal("failed")),
    nextAttemptAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_state_and_next_attempt_at", ["schoolId", "state", "nextAttemptAt"])
    .index("by_conversion_and_event_key", ["conversionId", "eventKey"])
    .index("by_application_and_event_key", ["applicationId", "eventKey"]),

  admissionsAuditEvents: defineTable({
    schoolId: v.id("schools"),
    actorKind: v.union(v.literal("guardian"), v.literal("staff"), v.literal("system")),
    actorGuardianId: v.optional(v.id("admissionsGuardians")),
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    applicationId: v.optional(v.id("admissionsApplications")),
    outcome: v.union(v.literal("success"), v.literal("denied"), v.literal("blocked"), v.literal("failed")),
    reasonCode: v.optional(v.string()),
    requestCorrelationId: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_school_and_created_at", ["schoolId", "createdAt"])
    .index("by_application_and_created_at", ["applicationId", "createdAt"])
    .index("by_school_and_actor_user_and_created_at", ["schoolId", "actorUserId", "createdAt"])
    .index("by_school_and_action_and_created_at", ["schoolId", "action", "createdAt"]),

  admissionsRetentionJobs: defineTable({
    schoolId: v.id("schools"),
    applicationId: v.optional(v.id("admissionsApplications")),
    policyKey: v.string(),
    policyVersion: v.string(),
    state: v.union(v.literal("draft"), v.literal("approved"), v.literal("running"), v.literal("completed"), v.literal("cancelled")),
    scheduledAt: v.number(),
    cursor: v.optional(v.string()),
    dryRunCount: v.optional(v.number()),
    approvedByUserId: v.optional(v.id("users")),
    executedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_state_and_scheduled_at", ["schoolId", "state", "scheduledAt"])
    .index("by_application", ["applicationId"])
    .index("by_school_and_policy_key", ["schoolId", "policyKey"]),

  schoolCapabilityGrants: defineTable({
    schoolId: v.id("schools"),
    userId: v.id("users"),
    capability: admissionsPermissionValidator,
    scope: capabilityScopeValidator,
    programmeId: v.optional(v.id("admissionsProgrammes")),
    intakeId: v.optional(v.id("admissionsIntakes")),
    grantedByUserId: v.id("users"),
    reason: v.string(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedByUserId: v.optional(v.id("users")),
    isBreakGlass: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_school_and_user", ["schoolId", "userId"])
    .index("by_school_and_capability", ["schoolId", "capability"])
    .index("by_user_and_capability", ["userId", "capability"]),

  schoolApprovalEvidence: defineTable({
    schoolId: v.id("schools"),
    approvalClass: v.union(v.literal("standard"), v.literal("sensitive_public"), v.literal("identity"), v.literal("privacy"), v.literal("finance"), v.literal("legal")),
    subjectType: v.string(),
    subjectKey: v.string(),
    evidenceReference: v.string(),
    approvedByUserId: v.optional(v.id("users")),
    approvedAt: v.number(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_school_and_approval_class", ["schoolId", "approvalClass"])
    .index("by_school_and_subject_type_and_subject_key", ["schoolId", "subjectType", "subjectKey"])
    .index("by_school_and_expires_at", ["schoolId", "expiresAt"]),

  schoolSiteProfiles: defineTable({
    schoolId: v.id("schools"),
    mode: v.union(v.literal("managed"), v.literal("external"), v.literal("none")),
    status: v.union(v.literal("draft"), v.literal("review"), v.literal("published"), v.literal("suspended"), v.literal("retired")),
    rendererKey: v.optional(v.string()),
    rendererSchemaVersion: v.optional(v.string()),
    externalPrimaryUrl: v.optional(v.string()),
    draftRevisionId: v.optional(v.id("schoolSiteRevisions")),
    publishedRevisionId: v.optional(v.id("schoolSiteRevisions")),
    canonicalDomainId: v.optional(v.id("schoolDomains")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_status", ["status"]),

  schoolDomains: defineTable({
    schoolId: v.id("schools"),
    hostname: v.string(),
    surface: v.literal("public"),
    kind: v.union(v.literal("platform_subdomain"), v.literal("custom_domain"), v.literal("school_subdomain")),
    status: v.union(v.literal("requested"), v.literal("verification_pending"), v.literal("verified"), v.literal("routing_pending"), v.literal("certificate_pending"), v.literal("ready"), v.literal("active"), v.literal("suspended"), v.literal("retired")),
    canonicalIntent: v.union(v.literal("canonical"), v.literal("redirect")),
    canonicalDomainId: v.optional(v.id("schoolDomains")),
    ownership: v.union(v.literal("school_managed_dns"), v.literal("platform_managed_dns")),
    verificationTokenHash: v.optional(v.string()),
    nextVerificationCheckAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_hostname", ["hostname"])
    .index("by_school_and_surface_and_status", ["schoolId", "surface", "status"])
    .index("by_status_and_next_verification_check_at", ["status", "nextVerificationCheckAt"]),

  schoolSiteAssets: defineTable({
    schoolId: v.id("schools"),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("logo"), v.literal("favicon"), v.literal("hero"), v.literal("gallery"), v.literal("staff"), v.literal("facility"), v.literal("document"), v.literal("social_share")),
    fileName: v.string(),
    mediaType: v.string(),
    byteSize: v.number(),
    checksum: v.string(),
    altText: v.optional(v.string()),
    decorative: v.boolean(),
    rightsStatus: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("expired")),
    approvalEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
    rightsExpiresAt: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("retired")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_status", ["schoolId", "status"])
    .index("by_school_and_kind_and_status", ["schoolId", "kind", "status"])
    .index("by_storage", ["storageId"]),

  schoolSiteRevisions: defineTable({
    schoolId: v.id("schools"),
    revisionNumber: v.number(),
    state: v.union(v.literal("draft"), v.literal("published"), v.literal("retired")),
    rendererKey: v.string(),
    rendererSchemaVersion: v.string(),
    content: siteRevisionContentValidator,
    contentDigest: v.string(),
    sourceRevisionId: v.optional(v.id("schoolSiteRevisions")),
    approvalEvidenceIds: v.array(v.id("schoolApprovalEvidence")),
    expectedDraftVersion: v.number(),
    publishedAt: v.optional(v.number()),
    publishedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school_and_state_and_revision_number", ["schoolId", "state", "revisionNumber"])
    .index("by_school_and_revision_number", ["schoolId", "revisionNumber"]),

  schoolSiteAuditEvents: defineTable({
    schoolId: v.id("schools"),
    actorUserId: v.optional(v.id("users")),
    eventType: v.union(v.literal("draft_saved"), v.literal("previewed"), v.literal("published"), v.literal("reverted"), v.literal("domain_changed"), v.literal("asset_approved"), v.literal("grant_changed")),
    revisionId: v.optional(v.id("schoolSiteRevisions")),
    outcome: v.union(v.literal("success"), v.literal("denied"), v.literal("blocked")),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index("by_school_and_created_at", ["schoolId", "createdAt"])
    .index("by_actor_user_and_created_at", ["actorUserId", "createdAt"]),

  users: defineTable({
    schoolId: v.id("schools"),
    authId: v.string(),
    // New writes use the canonical Convex token identifier. authId remains the
    // Better Auth bridge for existing memberships until a reviewed backfill.
    authTokenIdentifier: v.optional(v.string()),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    role: v.union(
      v.literal("student"),
      v.literal("parent"),
      v.literal("teacher"),
      v.literal("admin")
    ),
    isSchoolAdmin: v.optional(v.boolean()),
    managerUserId: v.optional(v.union(v.id("users"), v.null())),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_email", ["schoolId", "email"])
    .index("by_auth", ["authId"])
    .index("by_auth_token_identifier", ["authTokenIdentifier"])
    .index("by_email", ["email"]),

  families: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_name", ["schoolId", "name"]),

  familyMembers: defineTable({
    schoolId: v.id("schools"),
    familyId: v.id("families"),
    parentUserId: v.id("users"),
    relationship: v.optional(v.string()),
    isPrimaryContact: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_family", ["familyId"])
    .index("by_parent_user", ["parentUserId"])
    .index("by_family_and_parent", ["familyId", "parentUserId"])
    .index("by_family_and_primary", ["familyId", "isPrimaryContact"]),

  schoolAdminLeadership: defineTable({
    schoolId: v.id("schools"),
    leadAdminUserId: v.id("users"),
    previousLeadAdminUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_lead_admin", ["leadAdminUserId"]),

  students: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    userId: v.id("users"),
    familyId: v.optional(v.id("families")),
    admissionNumber: v.string(),
    houseName: v.optional(v.string()),
    gender: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    guardianName: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    photoFileName: v.optional(v.string()),
    photoContentType: v.optional(v.string()),
    photoUpdatedAt: v.optional(v.number()),
    // Existing student rows remain valid. Admissions conversion writes these
    // only after an explicit accepted-application conversion.
    sourceApplicationId: v.optional(v.id("admissionsApplications")),
    photoProvenance: v.optional(
      v.union(v.literal("school_upload"), v.literal("application_upload"))
    ),
    photoSourceDocumentId: v.optional(v.id("admissionsDocuments")),
    photoRetentionHold: v.optional(v.boolean()),
    enrollmentStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("graduated"),
        v.literal("withdrawn"),
        v.literal("transferred_out")
      )
    ),
    graduatedAt: v.optional(v.number()),
    graduatingSessionId: v.optional(v.id("academicSessions")),
    graduatingClassId: v.optional(v.id("classes")),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_family", ["familyId"])
    .index("by_school_and_class", ["schoolId", "classId"])
    .index("by_school_and_admission_number", ["schoolId", "admissionNumber"])
    .index("by_source_application", ["sourceApplicationId"]),

  classes: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    level: v.string(),
    gradeName: v.optional(v.string()),
    classLabel: v.optional(v.string()),
    formTeacherId: v.optional(v.id("users")),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"]),

  subjects: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    code: v.string(),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"]),

  schoolEvents: defineTable({
    schoolId: v.id("schools"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    isAllDay: v.boolean(),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_start", ["schoolId", "startDate"]),

  teacherAssignments: defineTable({
    schoolId: v.id("schools"),
    teacherId: v.id("users"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_teacher", ["teacherId"])
    .index("by_class", ["classId"])
    .index("by_teacher_and_class", ["teacherId", "classId"])
    .index("by_teacher_and_class_and_subject", ["teacherId", "classId", "subjectId"]),

  classSubjects: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_class_and_subject", ["classId", "subjectId"]),

  classSessionFormTeachers: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    formTeacherId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class_and_session", ["classId", "sessionId"])
    .index("by_teacher_and_session", ["formTeacherId", "sessionId"])
    .index("by_school_and_session", ["schoolId", "sessionId"]),

  classSubjectAggregations: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    umbrellaSubjectId: v.id("subjects"),
    strategy: v.union(
      v.literal("fixed_contribution"),
      v.literal("raw_combined_normalized")
    ),
    reportDisplayMode: v.union(
      v.literal("umbrella_only"),
      v.literal("umbrella_with_breakdown")
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_class_and_umbrella", ["classId", "umbrellaSubjectId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  classSubjectAggregationComponents: defineTable({
    schoolId: v.id("schools"),
    aggregationId: v.id("classSubjectAggregations"),
    componentSubjectId: v.id("subjects"),
    order: v.number(),
    contributionMax: v.optional(v.number()),
    rawMaxOverride: v.optional(v.number()),
    includeCA: v.boolean(),
    includeExam: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_aggregation", ["aggregationId"])
    .index("by_component_subject", ["componentSubjectId"]),

  studentSubjectSelections: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    sessionId: v.id("academicSessions"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_session", ["sessionId"])
    .index("by_student_and_session", ["studentId", "sessionId"])
    .index("by_class_and_session", ["classId", "sessionId"])
    .index("by_student_and_class_and_session", ["studentId", "classId", "sessionId"]),

  studentPromotions: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    fromClassId: v.id("classes"),
    toClassId: v.id("classes"),
    fromSessionId: v.id("academicSessions"),
    toSessionId: v.id("academicSessions"),
    subjectEnrollmentMode: v.union(
      v.literal("all_target_class_subjects"),
      v.literal("matching_previous_subjects"),
      v.literal("none")
    ),
    subjectEnrollmentCount: v.number(),
    batchKey: v.string(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student", ["studentId"])
    .index("by_school_and_created_at", ["schoolId", "createdAt"])
    .index("by_to_class_and_to_session", ["toClassId", "toSessionId"])
    .index("by_from_class_and_from_session", ["fromClassId", "fromSessionId"])
    .index("by_student_and_from_session", ["studentId", "fromSessionId"])
    .index("by_student_and_to_session", ["studentId", "toSessionId"]),

  studentGraduations: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    graduationDate: v.number(),
    certificateNumber: v.optional(v.string()),
    honorsOrRemarks: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student", ["studentId"])
    .index("by_class_and_session", ["classId", "sessionId"])
    .index("by_school_and_session", ["schoolId", "sessionId"])
    .index("by_student_and_session", ["studentId", "sessionId"]),

  studentSubjectAggregationOptOuts: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    aggregationId: v.id("classSubjectAggregations"),
    umbrellaSubjectId: v.id("subjects"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student", ["studentId"])
    .index("by_student_class_session", ["studentId", "classId", "sessionId"])
    .index("by_class_and_session", ["classId", "sessionId"])
    .index("by_aggregation", ["aggregationId"]),

  academicSessions: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  academicTerms: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    nextTermBegins: v.optional(v.number()),
    defaultTimesSchoolOpened: v.optional(v.number()),
    reportCardCalculationMode: v.optional(
      v.union(v.literal("standalone"), v.literal("cumulative_annual"))
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_session", ["sessionId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  academicTimelineAuditEvents: defineTable({
    schoolId: v.id("schools"),
    eventType: v.union(
      v.literal("session_dates_updated"),
      v.literal("term_dates_updated"),
      v.literal("term_activated"),
      v.literal("unused_timeline_deleted"),
      v.literal("production_timeline_repair")
    ),
    entityType: v.union(v.literal("session"), v.literal("term")),
    entityId: v.string(),
    entityName: v.string(),
    before: v.string(),
    after: v.string(),
    actorUserId: v.optional(v.id("users")),
    actorLabel: v.string(),
    createdAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_createdAt", ["schoolId", "createdAt"]),

  // Exam Recording tables
  schoolAssessmentSettings: defineTable({
    schoolId: v.id("schools"),
    examInputMode: v.union(
      v.literal("raw40"),
      v.literal("raw60_scaled_to_40")
    ),
    ca1Max: v.number(),
    ca2Max: v.number(),
    ca3Max: v.number(),
    examContributionMax: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  assessmentEditingPolicies: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    editingWindowEnabled: v.boolean(),
    editingWindowStartsAt: v.optional(v.number()),
    editingWindowEndsAt: v.optional(v.number()),
    finalizationEnabled: v.boolean(),
    finalizeAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_session_term", ["schoolId", "sessionId", "termId"]),

  gradingBands: defineTable({
    schoolId: v.id("schools"),
    minScore: v.number(),
    maxScore: v.number(),
    gradeLetter: v.string(),
    remark: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  assessmentRecords: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    studentId: v.id("students"),
    ca1: v.number(),
    ca2: v.number(),
    ca3: v.number(),
    examRawScore: v.number(),
    examScaledScore: v.number(),
    total: v.number(),
    gradeLetter: v.string(),
    remark: v.string(),
    examInputModeSnapshot: v.string(),
    examRawMaxSnapshot: v.number(),
    status: v.literal("draft"),
    enteredBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_sheet", [
      "schoolId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
    ])
    .index("by_student_sheet", [
      "schoolId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
      "studentId",
    ])
    .index("by_student_and_term", [
      "schoolId",
      "studentId",
      "sessionId",
      "termId",
    ])
    .index("by_student_and_session", [
      "schoolId",
      "studentId",
      "sessionId",
    ]),

  historicalTermTotals: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    studentId: v.id("students"),
    total: v.number(),
    source: v.union(
      v.literal("manual_backfill"),
      v.literal("migration_snapshot")
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"])
    .index("by_lookup", [
      "schoolId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
      "studentId",
    ])
    .index("by_student_and_session", ["schoolId", "studentId", "sessionId"]),

  reportCardManualAdjustments: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    subjectId: v.id("subjects"),
    includedTerms: v.array(
      v.union(v.literal("first"), v.literal("second"), v.literal("current"))
    ),
    finalTotalOverride: v.optional(v.number()),
    reason: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_and_report_term", [
      "schoolId",
      "studentId",
      "sessionId",
      "termId",
    ])
    .index("by_lookup", [
      "schoolId",
      "studentId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
    ]),

  reportCardManualAdjustmentEvents: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    subjectId: v.id("subjects"),
    action: v.union(v.literal("apply"), v.literal("reset")),
    includedTerms: v.array(
      v.union(v.literal("first"), v.literal("second"), v.literal("current"))
    ),
    finalTotalOverride: v.optional(v.number()),
    reason: v.string(),
    createdAt: v.number(),
    actorId: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_and_report_term", [
      "schoolId",
      "studentId",
      "sessionId",
      "termId",
    ]),

  reportCardComments: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classTeacherComment: v.optional(v.string()),
    headTeacherComment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_session_term", ["studentId", "sessionId", "termId"])
    .index("by_school_and_term", ["schoolId", "termId"]),

  reportCardExtraScaleTemplates: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    description: v.optional(v.string()),
    options: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        shortLabel: v.optional(v.string()),
        order: v.number(),
      })
    ),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_school", ["schoolId"]),

  reportCardExtraBundles: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    description: v.optional(v.string()),
    sections: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        order: v.number(),
        fields: v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            type: v.union(
              v.literal("text"),
              v.literal("number"),
              v.literal("boolean"),
              v.literal("scale")
            ),
            scaleTemplateId: v.optional(v.id("reportCardExtraScaleTemplates")),
            printable: v.boolean(),
            source: v.optional(
              v.union(
                v.literal("teacher_manual"),
                v.literal("admin_manual"),
                v.literal("system_term"),
                v.literal("system_attendance")
              )
            ),
            systemKey: v.optional(
              v.union(
                v.literal("next_term_begins"),
                v.literal("attendance_code"),
                v.literal("times_school_opened"),
                v.literal("times_present"),
                v.literal("times_absent")
              )
            ),
            order: v.number(),
          })
        ),
      })
    ),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_school", ["schoolId"]),

  reportCardExtraClassAssignments: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    bundleId: v.id("reportCardExtraBundles"),
    order: v.number(),
    createdAt: v.number(),
    assignedBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_bundle", ["bundleId"])
    .index("by_class_and_bundle", ["classId", "bundleId"]),

  reportCardExtraStudentValues: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    bundleId: v.id("reportCardExtraBundles"),
    values: v.array(
      v.object({
        fieldId: v.string(),
        textValue: v.optional(v.string()),
        numberValue: v.optional(v.number()),
        booleanValue: v.optional(v.boolean()),
        scaleOptionId: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_session_term", ["studentId", "sessionId", "termId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"]),

  reportCardAttendanceClassValues: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    timesSchoolOpened: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"])
    .index("by_school_and_term", ["schoolId", "termId"]),

  reportCardAttendanceStudentValues: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    timesPresent: v.optional(v.number()),
    attendanceCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_session_term", ["studentId", "sessionId", "termId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"]),

  reportCardTermSettingGroups: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    name: v.string(),
    classIds: v.array(v.id("classes")),
    nextTermBegins: v.optional(v.number()),
    timesSchoolOpened: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_term", ["termId"])
    .index("by_session", ["sessionId"])
    .index("by_school_and_term", ["schoolId", "termId"]),

  schoolBillingSettings: defineTable({
    schoolId: v.id("schools"),
    invoicePrefix: v.string(),
    defaultCurrency: v.string(),
    defaultDueDays: v.number(),
    preferredProvider: v.union(
      v.literal("paystack"),
      v.literal("flutterwave"),
      v.literal("stripe"),
      v.literal("manual")
    ),
    paymentProviderMode: v.optional(v.union(v.literal("test"), v.literal("live"))),
    allowManualPayments: v.boolean(),
    allowOnlinePayments: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.union(v.id("users"), v.null()),
  }).index("by_school", ["schoolId"]),
  feePlans: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    description: v.optional(v.string()),
    currency: v.string(),
    billingMode: v.optional(
      v.union(v.literal("class_default"), v.literal("manual_extra"))
    ),
    targetClassIds: v.optional(v.array(v.id("classes"))),
    lineItems: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        amount: v.number(),
        category: v.union(
          v.literal("tuition"),
          v.literal("boarding"),
          v.literal("transport"),
          v.literal("exam"),
          v.literal("activity"),
          v.literal("other")
        ),
        order: v.number(),
        isOptional: v.optional(v.boolean()),
        isSelected: v.optional(v.boolean()),
      })
    ),
    installmentPolicy: v.object({
      enabled: v.boolean(),
      installmentCount: v.number(),
      intervalDays: v.number(),
      firstDueDays: v.number(),
    }),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  feePlanApplications: defineTable({
    schoolId: v.id("schools"),
    feePlanId: v.id("feePlans"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    studentCount: v.number(),
    createdInvoiceCount: v.number(),
    skippedInvoiceCount: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_fee_plan", ["feePlanId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"])
    .index("by_school_and_created_at", ["schoolId", "createdAt"]),

  studentInvoices: defineTable({
    schoolId: v.id("schools"),
    feePlanId: v.id("feePlans"),
    feePlanApplicationId: v.optional(v.id("feePlanApplications")),
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    invoiceNumber: v.string(),
    feePlanNameSnapshot: v.string(),
    currency: v.string(),
    lineItems: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        amount: v.number(),
        category: v.union(
          v.literal("tuition"),
          v.literal("boarding"),
          v.literal("transport"),
          v.literal("exam"),
          v.literal("activity"),
          v.literal("other")
        ),
        order: v.number(),
        isOptional: v.optional(v.boolean()),
        isSelected: v.optional(v.boolean()),
      })
    ),
    installmentSchedule: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        dueAt: v.number(),
        amount: v.number(),
        isPaid: v.boolean(),
      })
    ),
    subtotal: v.number(),
    waiverAmount: v.number(),
    discountAmount: v.number(),
    totalAmount: v.number(),
    amountPaid: v.number(),
    balanceDue: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("waived"),
      v.literal("cancelled")
    ),
    dueDate: v.number(),
    issuedAt: v.number(),
    issuedBy: v.id("users"),
    notes: v.optional(v.string()),
    lastPaymentId: v.optional(v.id("billingPayments")),
    lastPaymentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_class", ["schoolId", "classId"])
    .index("by_school_and_session_term", ["schoolId", "sessionId", "termId"])
    .index("by_student", ["studentId"])
    .index("by_status", ["status"])
    .index("by_school_and_number", ["schoolId", "invoiceNumber"]),

  billingPaymentAttempts: defineTable({
    schoolId: v.id("schools"),
    invoiceId: v.id("studentInvoices"),
    provider: v.union(
      v.literal("paystack"),
      v.literal("flutterwave"),
      v.literal("stripe"),
      v.literal("manual")
    ),
    providerMode: v.optional(v.union(v.literal("test"), v.literal("live"))),
    reference: v.string(),    gatewayReference: v.union(v.string(), v.null()),
    authorizationUrl: v.union(v.string(), v.null()),
    accessCode: v.union(v.string(), v.null()),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("link_generated"),
      v.literal("awaiting_payer_return"),
      v.literal("verified"),
      v.literal("webhook_reconciled"),
      v.literal("manual_attention_needed")
    ),
    reconciliationSource: v.union(
      v.literal("return_page"),
      v.literal("webhook"),
      v.literal("admin_poll"),
      v.null()
    ),
    checkoutPayload: v.any(),
    callbackUrl: v.union(v.string(), v.null()),
    paymentId: v.union(v.id("billingPayments"), v.null()),
    gatewayEventId: v.union(v.id("paymentGatewayEvents"), v.null()),
    lastCheckedAt: v.union(v.number(), v.null()),
    resolvedAt: v.union(v.number(), v.null()),
    resolutionMessage: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_invoice", ["schoolId", "invoiceId"])
    .index("by_reference", ["reference"])
    .index("by_school_and_reference", ["schoolId", "reference"])
    .index("by_school_and_status", ["schoolId", "status"]),

  billingPayments: defineTable({
    schoolId: v.id("schools"),
    invoiceId: v.id("studentInvoices"),
    reference: v.string(),
    gatewayReference: v.optional(v.string()),
    provider: v.optional(
      v.union(
        v.literal("paystack"),
        v.literal("flutterwave"),
        v.literal("stripe"),
        v.literal("manual")
      )
    ),
    paymentMethod: v.union(
      v.literal("cash"),
      v.literal("bank_transfer"),
      v.literal("cheque"),
      v.literal("mobile_money"),
      v.literal("card"),
      v.literal("online")
    ),
    amountReceived: v.number(),
    amountApplied: v.number(),
    unappliedAmount: v.number(),
    applicationStatus: v.union(
      v.literal("applied"),
      v.literal("partial"),
      v.literal("unapplied")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("successful"),
      v.literal("failed"),
      v.literal("reconciled"),
      v.literal("reversed")
    ),
    payerName: v.optional(v.string()),
    payerEmail: v.optional(v.string()),
    receivedAt: v.number(),
    recordedBy: v.union(v.id("users"), v.null()),
    reconciliationStatus: v.union(
      v.literal("unreconciled"),
      v.literal("reconciled"),
      v.literal("flagged")
    ),
    reconciledBy: v.union(v.id("users"), v.null()),
    reconciledAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_reference", ["reference"])
    .index("by_gateway_reference", ["gatewayReference"])
    .index("by_status", ["status"]),

  paymentAllocations: defineTable({
    schoolId: v.id("schools"),
    invoiceId: v.id("studentInvoices"),
    paymentId: v.id("billingPayments"),
    amountApplied: v.number(),
    createdAt: v.number(),
    createdBy: v.union(v.id("users"), v.null()),
  })
    .index("by_school", ["schoolId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_payment", ["paymentId"]),

  paymentGatewayEvents: defineTable({
    schoolId: v.id("schools"),
    provider: v.union(
      v.literal("paystack"),
      v.literal("flutterwave"),
      v.literal("stripe"),
      v.literal("manual")
    ),
    providerMode: v.optional(v.union(v.literal("test"), v.literal("live"))),
    eventId: v.string(),    eventType: v.string(),
    reference: v.string(),
    invoiceNumber: v.optional(v.string()),
    invoiceId: v.optional(v.id("studentInvoices")),
    paymentId: v.optional(v.id("billingPayments")),
    signatureValid: v.boolean(),
    verificationStatus: v.union(
      v.literal("verified"),
      v.literal("rejected"),
      v.literal("ignored")
    ),
    rawBody: v.string(),
    payload: v.any(),
    processedAt: v.optional(v.number()),
    verificationMessage: v.optional(v.string()),
    receivedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_provider", ["provider"])
    .index("by_reference", ["reference"])
    .index("by_event", ["eventId"])
    .index("by_school_and_event", ["schoolId", "eventId"]),

  schoolPaymentProviders: defineTable({
    schoolId: v.id("schools"),
    provider: v.literal("paystack"),
    mode: v.union(v.literal("test"), v.literal("live")),
    isEnabled: v.boolean(),
    status: v.union(
      v.literal("not_configured"),
      v.literal("invalid"),
      v.literal("ready"),
      v.literal("disabled"),
      v.literal("rotation_pending")
    ),
    publicKey: v.union(v.string(), v.null()),
    publicKeyMasked: v.union(v.string(), v.null()),
    publicKeyFingerprint: v.union(v.string(), v.null()),
    activeSecretMasked: v.union(v.string(), v.null()),
    pendingSecretMasked: v.union(v.string(), v.null()),
    activeSecretId: v.union(v.id("schoolPaymentProviderSecrets"), v.null()),
    pendingSecretId: v.union(v.id("schoolPaymentProviderSecrets"), v.null()),
    activeSecretFingerprint: v.union(v.string(), v.null()),
    pendingSecretFingerprint: v.union(v.string(), v.null()),
    lastValidatedAt: v.union(v.number(), v.null()),
    lastValidationMessage: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.union(v.id("users"), v.null()),
    updatedBy: v.union(v.id("users"), v.null()),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_provider", ["schoolId", "provider"])
    .index("by_school_and_provider_and_mode", ["schoolId", "provider", "mode"])
    .index("by_school_and_status", ["schoolId", "status"]),

  schoolPaymentProviderSecrets: defineTable({
    schoolId: v.id("schools"),
    provider: v.literal("paystack"),
    mode: v.union(v.literal("test"), v.literal("live")),
    encryptedSecret: v.string(),
    secretFingerprint: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.union(v.id("users"), v.null()),
    updatedBy: v.union(v.id("users"), v.null()),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_provider", ["schoolId", "provider"])
    .index("by_school_and_provider_and_mode", ["schoolId", "provider", "mode"]),

  // Lesson Knowledge Hub foundation
  knowledgeTopics: defineTable({
    schoolId: v.id("schools"),
    subjectId: v.id("subjects"),
    level: v.string(),
    termId: v.id("academicTerms"),
    title: v.string(),
    normalizedTitle: v.optional(v.string()),
    slug: v.string(),
    summary: v.optional(v.string()),
    searchText: v.string(),
    status: knowledgeTopicStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_subject_and_level_and_term", [
      "schoolId",
      "subjectId",
      "level",
      "termId",
    ])
    .index("by_school_and_subject_and_level_and_term_and_status", [
      "schoolId",
      "subjectId",
      "level",
      "termId",
      "status",
    ])
    .index("by_scope_normalized_title_and_status", [
      "schoolId",
      "subjectId",
      "level",
      "termId",
      "normalizedTitle",
      "status",
    ])
    .index("by_school_and_subject_and_level", ["schoolId", "subjectId", "level"])
    .index("by_school_and_slug", ["schoolId", "slug"])
    .index("by_school_and_status", ["schoolId", "status"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: ["schoolId", "subjectId", "termId", "status"],
    }),

  knowledgeMaterials: defineTable({
    schoolId: v.id("schools"),
    ownerUserId: v.id("users"),
    ownerRole: knowledgeOwnerRoleValidator,
    sourceType: knowledgeSourceTypeValidator,
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    title: v.string(),
    description: v.optional(v.string()),
    subjectId: v.optional(v.id("subjects")),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    searchStatus: knowledgeSearchStatusValidator,
    searchText: v.string(),
    processingStatus: knowledgeMaterialProcessingStatusValidator,
    ingestionErrorMessage: v.union(v.string(), v.null()),
    ingestionAttemptCount: v.number(),
    labelSuggestions: v.array(v.string()),
    chunkCount: v.number(),
    indexedAt: v.union(v.number(), v.null()),
    selectedPageRanges: v.optional(v.string()),
    selectedPageNumbers: v.optional(v.array(v.number())),
    pdfPageCount: v.optional(v.number()),
    sourceFileMode: v.optional(v.union(v.literal("original"), v.literal("selected_pages"))),
    sourcePdfPageCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_owner_user", ["schoolId", "ownerUserId"])
    .index("by_school_and_owner_role", ["schoolId", "ownerRole"])
    .index("by_school_and_visibility", ["schoolId", "visibility"])
    .index("by_school_and_review_status", ["schoolId", "reviewStatus"])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_subject_and_level", ["schoolId", "subjectId", "level"])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_topic_and_visibility_and_review_status", ["schoolId", "topicId", "visibility", "reviewStatus"])
    .index("by_school_and_source_type", ["schoolId", "sourceType"])
    .index("by_school_curriculum_ready_approved_indexed", ["schoolId", "sourceType", "processingStatus", "reviewStatus", "searchStatus"])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .index("by_school_and_processing_status", ["schoolId", "processingStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "visibility",
        "reviewStatus",
        "topicId",
        "sourceType",
        "searchStatus",
        "processingStatus",
        "ownerRole",
        "ownerUserId",
        "subjectId",
        "level",
      ],
    }),

  knowledgeMaterialClassBindings: defineTable({
    schoolId: v.id("schools"),
    materialId: v.id("knowledgeMaterials"),
    classId: v.id("classes"),
    bindingPurpose: knowledgeBindingPurposeValidator,
    bindingStatus: knowledgeBindingStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_class", ["schoolId", "classId"])
    .index("by_school_and_material", ["schoolId", "materialId"])
    .index("by_school_and_class_and_material", ["schoolId", "classId", "materialId"])
    .index("by_school_and_material_and_class", ["schoolId", "materialId", "classId"])
    .index("by_school_and_class_and_binding_status", [
      "schoolId",
      "classId",
      "bindingStatus",
    ])
    .index("by_school_and_material_and_binding_status", [
      "schoolId",
      "materialId",
      "bindingStatus",
    ])
    .index("by_school_and_binding_purpose", ["schoolId", "bindingPurpose"]),

  knowledgeOcrJobs: defineTable({
    schoolId: v.id("schools"),
    materialId: v.id("knowledgeMaterials"),
    storageId: v.id("_storage"),
    requestedByUserId: v.id("users"),
    provider: v.union(v.literal("openrouter_mistral_ocr"), v.literal("mistral")),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    attempt: v.number(),
    maxAttempts: v.number(),
    selectedPageRanges: v.optional(v.string()),
    selectedPageNumbers: v.optional(v.array(v.number())),
    providerJobId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_material", ["schoolId", "materialId"])
    .index("by_school_and_status", ["schoolId", "status"])
    .index("by_material_and_status", ["materialId", "status"]),

  knowledgeMaterialChunks: defineTable({
    schoolId: v.id("schools"),
    materialId: v.id("knowledgeMaterials"),
    topicId: v.optional(v.id("knowledgeTopics")),
    chunkIndex: v.number(),
    chunkText: v.string(),
    searchText: v.string(),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    searchStatus: knowledgeSearchStatusValidator,
    tokenEstimate: v.optional(v.number()),
    pageStart: v.optional(v.number()),
    pageEnd: v.optional(v.number()),
    pageNumbers: v.optional(v.array(v.number())),
    chunkHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_material", ["schoolId", "materialId"])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_material_and_chunk_index", [
      "schoolId",
      "materialId",
      "chunkIndex",
    ])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_material_and_visibility_and_review_status", [
      "schoolId",
      "materialId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "visibility",
        "reviewStatus",
        "topicId",
        "materialId",
        "searchStatus",
      ],
    }),

  curriculumImports: defineTable({
    schoolId: v.id("schools"), materialId: v.id("knowledgeMaterials"), subjectId: v.id("subjects"),
    level: v.string(), termId: v.id("academicTerms"), status: curriculumImportStatusValidator,
    requestedBy: v.id("users"), reviewedBy: v.optional(v.id("users")),
    provider: v.optional(v.string()), modelId: v.optional(v.string()), promptVersion: v.string(), schemaVersion: v.string(),
    aiRunLogId: v.optional(v.id("aiRunLogs")), errorCode: v.optional(v.string()), errorMessage: v.optional(v.string()),
    proposedUnitCount: v.number(), approvedUnitCount: v.number(), rejectedUnitCount: v.number(), duplicateWarningCount: v.number(),
    createdAt: v.number(), updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_status", ["schoolId", "status"])
    .index("by_school_and_material", ["schoolId", "materialId"])
    .index("by_school_and_updated_at", ["schoolId", "updatedAt"])
    .index("by_school_and_subject_and_term_and_level", ["schoolId", "subjectId", "termId", "level"]),

  curriculumUnits: defineTable({
    schoolId: v.id("schools"), importId: v.id("curriculumImports"), materialId: v.id("knowledgeMaterials"),
    weekNumber: v.optional(v.number()), title: v.string(), subtopics: v.array(v.string()), learningObjectives: v.array(v.string()),
    suggestedDuration: v.optional(v.string()), sourcePages: v.array(v.number()), sourceChunkHash: v.string(), supportingExcerpt: v.string(),
    confidence: v.number(), reviewStatus: curriculumUnitReviewStatusValidator,
    validationWarnings: v.array(v.string()), duplicateWarnings: v.array(v.string()),
    editedBy: v.optional(v.id("users")), reviewedBy: v.optional(v.id("users")), reviewedAt: v.optional(v.number()),
    knowledgeTopicId: v.optional(v.id("knowledgeTopics")), createdAt: v.number(), updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_import_and_review_status", ["importId", "reviewStatus"])
    .index("by_school_and_topic_identity", ["schoolId", "title"])
    .index("by_school_and_knowledge_topic", ["schoolId", "knowledgeTopicId"])
    .index("by_school_and_knowledge_topic_and_review_status", ["schoolId", "knowledgeTopicId", "reviewStatus"]),

  instructionTemplates: defineTable({
    schoolId: v.id("schools"),
    templateKey: v.string(),
    outputType: knowledgeOutputTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    templateScope: knowledgeTemplateScopeValidator,
    subjectId: v.optional(v.id("subjects")),
    level: v.optional(v.string()),
    isSchoolDefault: v.boolean(),
    requiredSectionIds: v.array(v.string()),
    sectionDefinitions: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        order: v.number(),
        required: v.boolean(),
        minimumWordCount: v.optional(v.number()),
      })
    ),
    objectiveMinimums: v.object({
      minimumObjectives: v.number(),
      minimumSourceMaterials: v.number(),
      minimumSections: v.number(),
    }),
    searchText: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_output_type", ["schoolId", "outputType"])
    .index("by_school_and_output_type_and_subject", [
      "schoolId",
      "outputType",
      "subjectId",
    ])
    .index("by_school_and_output_type_and_level", [
      "schoolId",
      "outputType",
      "level",
    ])
    .index("by_school_and_output_type_and_subject_and_level", [
      "schoolId",
      "outputType",
      "subjectId",
      "level",
    ])
    .index("by_school_and_template_key", ["schoolId", "templateKey"])
    .index("by_school_and_template_scope", ["schoolId", "templateScope"])
    .index("by_school_and_is_school_default", ["schoolId", "isSchoolDefault"])
    .index("by_school_and_output_type_and_is_school_default", [
      "schoolId",
      "outputType",
      "isSchoolDefault",
    ])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "outputType",
        "templateScope",
        "subjectId",
        "level",
        "isSchoolDefault",
      ],
    }),

  instructionArtifacts: defineTable({
    schoolId: v.id("schools"),
    ownerUserId: v.id("users"),
    ownerRole: knowledgeOwnerRoleValidator,
    outputType: knowledgeOutputTypeValidator,
    artifactStatus: knowledgeArtifactStatusValidator,
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    templateId: v.optional(v.id("instructionTemplates")),
    templateResolutionPath: v.optional(v.string()),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    currentRevisionId: v.optional(v.id("instructionArtifactRevisions")),
    currentDocumentId: v.optional(v.id("instructionArtifactDocuments")),
    searchStatus: knowledgeSearchStatusValidator,
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_owner_user", ["schoolId", "ownerUserId"])
    .index("by_school_and_owner_role", ["schoolId", "ownerRole"])
    .index("by_school_and_output_type", ["schoolId", "outputType"])
    .index("by_school_and_output_type_and_review_status", [
      "schoolId",
      "outputType",
      "reviewStatus",
    ])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_topic_and_artifact_status_and_output_type", ["schoolId", "topicId", "artifactStatus", "outputType"])
    .index("by_school_and_subject_and_level", ["schoolId", "subjectId", "level"])
    .index("by_school_and_template", ["schoolId", "templateId"])
    .index("by_school_and_artifact_status", ["schoolId", "artifactStatus"])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "visibility",
        "reviewStatus",
        "topicId",
        "outputType",
        "templateId",
        "searchStatus",
      ],
    }),

  instructionArtifactDocuments: defineTable({
    schoolId: v.id("schools"),
    artifactId: v.id("instructionArtifacts"),
    documentFormat: v.union(v.literal("markdown"), v.literal("editor_json")),
    documentState: v.string(),
    plainText: v.string(),
    searchText: v.string(),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    outputType: knowledgeOutputTypeValidator,
    topicId: v.optional(v.id("knowledgeTopics")),
    searchStatus: knowledgeSearchStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_artifact", ["schoolId", "artifactId"])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_output_type", ["schoolId", "outputType"])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "visibility",
        "reviewStatus",
        "topicId",
        "outputType",
        "searchStatus",
      ],
    }),

  instructionArtifactRevisions: defineTable({
    schoolId: v.id("schools"),
    artifactId: v.id("instructionArtifacts"),
    revisionNumber: v.number(),
    revisionKind: knowledgeRevisionKindValidator,
    documentFormat: v.union(v.literal("markdown"), v.literal("editor_json")),
    documentState: v.string(),
    plainText: v.string(),
    searchText: v.string(),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    outputType: knowledgeOutputTypeValidator,
    templateId: v.optional(v.id("instructionTemplates")),
    templateResolutionPath: v.optional(v.string()),
    sourceSelectionSnapshot: v.string(),
    sourceCount: v.number(),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_artifact", ["schoolId", "artifactId"])
    .index("by_school_and_artifact_and_revision_number", [
      "schoolId",
      "artifactId",
      "revisionNumber",
    ])
    .index("by_school_and_created_by", ["schoolId", "createdBy"])
    .index("by_school_and_revision_kind", ["schoolId", "revisionKind"])
    .index("by_school_and_output_type", ["schoolId", "outputType"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: ["schoolId", "artifactId", "revisionKind", "outputType"],
    }),

  instructionArtifactSources: defineTable({
    schoolId: v.id("schools"),
    artifactId: v.id("instructionArtifacts"),
    materialId: v.id("knowledgeMaterials"),
    sourceOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_artifact", ["schoolId", "artifactId"])
    .index("by_school_and_material", ["schoolId", "materialId"])
    .index("by_school_and_artifact_and_source_order", [
      "schoolId",
      "artifactId",
      "sourceOrder",
    ])
    .index("by_school_and_material_and_artifact", [
      "schoolId",
      "materialId",
      "artifactId",
    ]),

  assessmentGenerationProfiles: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    description: v.optional(v.string()),
    questionStyle: assessmentQuestionStyleValidator,
    totalQuestions: v.number(),
    questionMix: v.object({
      multiple_choice: v.number(),
      short_answer: v.number(),
      essay: v.number(),
      true_false: v.number(),
      fill_in_the_blank: v.number(),
    }),
    allowTeacherOverrides: v.boolean(),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_is_default", ["schoolId", "isDefault"])
    .index("by_school_and_is_active", ["schoolId", "isActive"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: ["schoolId", "questionStyle", "isDefault", "isActive"],
    }),

  assessmentBanks: defineTable({
    schoolId: v.id("schools"),
    ownerUserId: v.id("users"),
    ownerRole: knowledgeOwnerRoleValidator,
    outputType: knowledgeOutputTypeValidator,
    draftMode: v.optional(assessmentDraftModeValidator),
    sourceSelectionSnapshot: v.optional(v.string()),
    effectiveGenerationSettings: v.optional(assessmentGenerationSettingsValidator),
    bankStatus: knowledgeArtifactStatusValidator,
    title: v.string(),
    description: v.optional(v.string()),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    subjectId: v.id("subjects"),
    level: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    searchStatus: knowledgeSearchStatusValidator,
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_owner_user", ["schoolId", "ownerUserId"])
    .index("by_school_and_output_type", ["schoolId", "outputType"])
    .index("by_school_and_output_type_and_review_status", [
      "schoolId",
      "outputType",
      "reviewStatus",
    ])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_topic_and_bank_status", ["schoolId", "topicId", "bankStatus"])
    .index("by_school_and_subject_and_level", ["schoolId", "subjectId", "level"])
    .index("by_school_and_bank_status", ["schoolId", "bankStatus"])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "visibility",
        "reviewStatus",
        "topicId",
        "outputType",
        "draftMode",
        "searchStatus",
      ],
    }),

  assessmentBankItems: defineTable({
    schoolId: v.id("schools"),
    bankId: v.id("assessmentBanks"),
    itemOrder: v.number(),
    questionType: knowledgeQuestionTypeValidator,
    difficulty: knowledgeQuestionDifficultyValidator,
    promptText: v.string(),
    answerText: v.string(),
    explanationText: v.string(),
    marks: v.optional(v.number()),
    tags: v.array(v.string()),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
    searchStatus: knowledgeSearchStatusValidator,
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_bank", ["schoolId", "bankId"])
    .index("by_school_and_bank_and_item_order", ["schoolId", "bankId", "itemOrder"])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_bank_and_review_status", [
      "schoolId",
      "bankId",
      "reviewStatus",
    ])
    .index("by_school_and_question_type", ["schoolId", "questionType"])
    .index("by_school_and_difficulty", ["schoolId", "difficulty"])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: [
        "schoolId",
        "bankId",
        "questionType",
        "difficulty",
        "visibility",
        "reviewStatus",
        "searchStatus",
      ],
    }),

  // Persisted cursor state for bounded, restart-safe demo population phases.
  demoSeedRuns: defineTable({
    schoolId: v.id("schools"),
    seedProfile: v.optional(v.union(v.literal("demo"), v.literal("judge"))),
    status: v.union(v.literal("running"), v.literal("failed"), v.literal("succeeded")),
    phase: v.union(v.literal("foundation"), v.literal("students"), v.literal("assessments"), v.literal("billing"), v.literal("knowledge"), v.literal("complete")),
    studentCursor: v.number(),
    assessmentCursor: v.number(),
    billingCursor: v.number(),
    adminAuthId: v.string(),
    teacherAuthId: v.string(),
    portalAuthId: v.string(),
    logoStorageId: v.id("_storage"),
    portraitStorageIds: v.array(v.id("_storage")),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_school", ["schoolId"]),

  // Durable cleanup ledger: destructive demo resets retain storage IDs until a
  // successful storage delete is acknowledged, including across retries.
  demoSeedStorageCleanup: defineTable({
    schoolId: v.id("schools"),
    schoolSlug: v.string(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_slug", ["schoolSlug"])
    .index("by_storage", ["storageId"]),

  rateLimitCounters: defineTable({
    key: v.string(),
    action: rateLimitActionValidator,
    schoolId: v.id("schools"),
    actorUserId: v.id("users"),
    windowStartAt: v.number(),
    windowExpiresAt: v.number(),
    count: v.number(),
    limit: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_school", ["schoolId"])
    .index("by_school_and_action", ["schoolId", "action"])
    .index("by_window_expires_at", ["windowExpiresAt"]),

  aiRunLogs: defineTable({
    schoolId: v.id("schools"),
    actorUserId: v.id("users"),
    actorRole: knowledgeOwnerRoleValidator,
    outputType: aiRunOutputTypeValidator,
    promptClass: v.string(),
    status: knowledgeAIRunStatusValidator,
    model: v.string(),
    provider: v.string(),
    targetArtifactId: v.optional(v.id("instructionArtifacts")),
    targetAssessmentBankId: v.optional(v.id("assessmentBanks")),
    curriculumImportId: v.optional(v.id("curriculumImports")),
    sourceSelectionSnapshot: v.string(),
    sourceCount: v.number(),
    effectiveGenerationSettings: v.optional(assessmentGenerationSettingsValidator),
    tokenPromptCount: v.optional(v.number()),
    tokenCompletionCount: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_status", ["schoolId", "status"])
    .index("by_school_and_output_type_and_status", [
      "schoolId",
      "outputType",
      "status",
    ])
    .index("by_school_and_actor_user", ["schoolId", "actorUserId"])
    .index("by_school_and_prompt_class", ["schoolId", "promptClass"])
    .index("by_school_and_target_artifact", ["schoolId", "targetArtifactId"])
    .index("by_school_and_target_assessment_bank", [
      "schoolId",
      "targetAssessmentBankId",
    ])
    .index("by_school_and_curriculum_import", ["schoolId", "curriculumImportId"])
    .index("by_school_and_created_at", ["schoolId", "createdAt"]),

  contentAuditEvents: defineTable({
    schoolId: v.id("schools"),
    actorUserId: v.id("users"),
    actorRole: knowledgeOwnerRoleValidator,
    eventType: knowledgeAuditEventTypeValidator,
    entityType: v.union(
      v.literal("knowledgeTopic"),
      v.literal("knowledgeMaterial"),
      v.literal("knowledgeMaterialClassBinding"),
      v.literal("knowledgeMaterialChunk"),
      v.literal("instructionTemplate"),
      v.literal("instructionArtifact"),
      v.literal("instructionArtifactDocument"),
      v.literal("instructionArtifactRevision"),
      v.literal("instructionArtifactSource"),
      v.literal("assessmentBank"),
      v.literal("assessmentBankItem"),
      v.literal("curriculumImport"),
      v.literal("curriculumUnit")
    ),
    materialId: v.optional(v.id("knowledgeMaterials")),
    bindingId: v.optional(v.id("knowledgeMaterialClassBindings")),
    topicId: v.optional(v.id("knowledgeTopics")),
    artifactId: v.optional(v.id("instructionArtifacts")),
    templateId: v.optional(v.id("instructionTemplates")),
    bankId: v.optional(v.id("assessmentBanks")),
    itemId: v.optional(v.id("assessmentBankItems")),
    curriculumImportId: v.optional(v.id("curriculumImports")),
    curriculumUnitId: v.optional(v.id("curriculumUnits")),
    beforeVisibility: v.optional(knowledgeVisibilityValidator),
    afterVisibility: v.optional(knowledgeVisibilityValidator),
    beforeReviewStatus: v.optional(knowledgeReviewStatusValidator),
    afterReviewStatus: v.optional(knowledgeReviewStatusValidator),
    beforeTopicId: v.optional(v.union(v.id("knowledgeTopics"), v.null())),
    afterTopicId: v.optional(v.union(v.id("knowledgeTopics"), v.null())),
    changeSummary: v.string(),
    createdAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_event_type", ["schoolId", "eventType"])
    .index("by_school_and_entity_type", ["schoolId", "entityType"])
    .index("by_school_and_actor_user", ["schoolId", "actorUserId"])
    .index("by_school_and_material", ["schoolId", "materialId"])
    .index("by_school_and_binding", ["schoolId", "bindingId"])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_artifact", ["schoolId", "artifactId"])
    .index("by_school_and_bank", ["schoolId", "bankId"])
    .index("by_school_and_curriculum_import", ["schoolId", "curriculumImportId"])
    .index("by_school_and_curriculum_unit", ["schoolId", "curriculumUnitId"])
    .index("by_school_and_created_at", ["schoolId", "createdAt"]),

  migrationState: defineTable({
    phase: v.string(),
    sourceSchoolId: v.id("schools"),
    targetSchoolId: v.id("schools"),
    currentTable: v.string(),
    cursor: v.optional(v.string()),
    idMaps: v.string(), // JSON stringified map of { [tableName]: { [oldId]: newId } }
    tablesCompleted: v.array(v.string()),
    status: v.union(v.literal("idle"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),
});

