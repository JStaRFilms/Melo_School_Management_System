import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
  v.literal("visibility_changed")
);

const knowledgeTopicStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("retired")
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
    status: v.optional(v.union(v.literal("pending"), v.literal("active"))),
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    logoContentType: v.optional(v.string()),
    logoUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  users: defineTable({
    schoolId: v.id("schools"),
    authId: v.string(),
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
    .index("by_auth", ["authId"]),

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
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_family", ["familyId"])
    .index("by_school_and_class", ["schoolId", "classId"]),

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
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
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
    .index("by_school_and_visibility", ["schoolId", "visibility"])
    .index("by_school_and_review_status", ["schoolId", "reviewStatus"])
    .index("by_school_and_visibility_and_review_status", [
      "schoolId",
      "visibility",
      "reviewStatus",
    ])
    .index("by_school_and_subject_and_level", ["schoolId", "subjectId", "level"])
    .index("by_school_and_topic", ["schoolId", "topicId"])
    .index("by_school_and_source_type", ["schoolId", "sourceType"])
    .index("by_school_and_search_status", ["schoolId", "searchStatus"])
    .searchIndex("search_search_text", {
      searchField: "searchText",
      filterFields: ["schoolId", "visibility", "reviewStatus", "topicId", "sourceType"],
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

  assessmentBanks: defineTable({
    schoolId: v.id("schools"),
    ownerUserId: v.id("users"),
    ownerRole: knowledgeOwnerRoleValidator,
    outputType: knowledgeOutputTypeValidator,
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

  aiRunLogs: defineTable({
    schoolId: v.id("schools"),
    actorUserId: v.id("users"),
    actorRole: knowledgeOwnerRoleValidator,
    outputType: knowledgeOutputTypeValidator,
    promptClass: v.string(),
    status: knowledgeAIRunStatusValidator,
    model: v.string(),
    provider: v.string(),
    targetArtifactId: v.optional(v.id("instructionArtifacts")),
    targetAssessmentBankId: v.optional(v.id("assessmentBanks")),
    sourceSelectionSnapshot: v.string(),
    sourceCount: v.number(),
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
      v.literal("assessmentBankItem")
    ),
    materialId: v.optional(v.id("knowledgeMaterials")),
    bindingId: v.optional(v.id("knowledgeMaterialClassBindings")),
    topicId: v.optional(v.id("knowledgeTopics")),
    artifactId: v.optional(v.id("instructionArtifacts")),
    templateId: v.optional(v.id("instructionTemplates")),
    bankId: v.optional(v.id("assessmentBanks")),
    itemId: v.optional(v.id("assessmentBankItems")),
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
    .index("by_school_and_created_at", ["schoolId", "createdAt"]),
});
