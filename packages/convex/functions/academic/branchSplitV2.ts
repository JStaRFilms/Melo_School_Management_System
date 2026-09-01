import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id, TableNames } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

// Dependency order tiers for duplication
export const DUPLICATION_TIERS: string[][] = [
  // Tier 0: No dependencies beyond schoolId
  [
    "academicSessions",
    "classes",
    "subjects",
    "schoolEvents",
    "schoolAssessmentSettings",
    "gradingBands",
    "schoolBillingSettings",
    "reportCardExtraScaleTemplates",
    "schoolApprovalEvidence",
  ],
  // Tier 1: Depends on Tier 0
  [
    "academicTerms",
    "users",
    "families",
  ],
  // Tier 2: Depends on Tier 1
  [
    "familyMembers",
    "students",
    "classSubjects",
    "teacherAssignments",
    "classSessionFormTeachers",
    "assessmentEditingPolicies",
    "classSubjectAggregations",
    "reportCardExtraBundles",
    "reportCardTermSettingGroups",
    "feePlans",
    "schoolDomains",
    "schoolSiteProfiles",
    "schoolPaymentProviderSecrets",
    "schoolPaymentProviders",
    "academicTimelineAuditEvents",
    "rateLimitCounters",
  ],
  // Tier 3: Depends on Tier 2
  [
    "studentSubjectSelections",
    "studentPromotions",
    "studentGraduations",
    "studentSubjectAggregationOptOuts",
    "classSubjectAggregationComponents",
    "assessmentRecords",
    "historicalTermTotals",
    "reportCardComments",
    "reportCardManualAdjustments",
    "reportCardManualAdjustmentEvents",
    "reportCardExtraClassAssignments",
    "reportCardExtraStudentValues",
    "reportCardAttendanceClassValues",
    "reportCardAttendanceStudentValues",
    "feePlanApplications",
    "studentInvoices",
    "schoolSiteAssets",
    "schoolSiteRevisions",
    "schoolSiteAuditEvents",
  ],
  // Tier 4: Depends on Tier 3
  [
    "billingPaymentAttempts",
    "billingPayments",
    "paymentAllocations",
    "paymentGatewayEvents",
  ],
];

// All tables in order
export const ALL_DUPLICATION_TABLES = DUPLICATION_TIERS.flat();

const USER_FK_REMAP_TABLES = [
  "schoolAssessmentSettings",
  "gradingBands",
  "schoolBillingSettings",
  "schoolEvents",
  "classes",
  "subjects",
  "schoolApprovalEvidence",
] as const;

const userRemapStage = (table: string) => `__user_fk_remap__:${table}`;

// Knowledge hub & AI tables to wipe clean
export const KNOWLEDGE_AI_TABLES = [
  "knowledgeTopics",
  "knowledgeMaterials",
  "knowledgeMaterialClassBindings",
  "knowledgeMaterialChunks",
  "knowledgeOcrJobs",
  "curriculumImports",
  "curriculumUnits",
  "instructionTemplates",
  "instructionArtifacts",
  "instructionArtifactDocuments",
  "instructionArtifactRevisions",
  "instructionArtifactSources",
  "assessmentGenerationProfiles",
  "assessmentBanks",
  "assessmentBankItems",
  "aiRunLogs",
  "contentAuditEvents",
];

export const LEGACY_BILLING_TABLES = [
  "studentInvoices",
  "feePlans",
  "feePlanApplications",
  "billingPayments",
  "billingPaymentAttempts",
  "paymentAllocations",
  "paymentGatewayEvents",
] as const satisfies readonly TableNames[];

const RETAINED_SCHOOL_SLUGS = new Set(["obhis-fedrah", "obhis-ruga"]);

// Every school-scoped table is listed so the non-retained-school purge cannot
// leave records behind in newer feature areas. Children precede their parents.
export const SCHOOL_PURGE_TABLES = [
  "migrationFeatureSignals",
  "stagedImportRecords",
  "importWorkspaces",
  "admissionsRetentionJobs",
  "admissionsCommunicationOutbox",
  "admissionsConversionAttempts",
  "admissionsReviewEvents",
  "admissionsEvaluations",
  "admissionsReviewAssignments",
  "admissionsDocumentReviews",
  "admissionsDocumentAccessAudits",
  "admissionsDocuments",
  "admissionsAuditEvents",
  "admissionsApplicationAnswers",
  "admissionsApplicationContacts",
  "admissionsPreviousSchools",
  "admissionsSubmissionSnapshotItems",
  "admissionsSubmissionSnapshots",
  "admissionsConversions",
  "admissionsDecisions",
  "admissionsApplicantProfiles",
  "admissionsApplications",
  "admissionsEntitlements",
  "admissionsPaymentEvents",
  "admissionsPurchaseAttempts",
  "admissionsProductPrices",
  "admissionsProducts",
  "admissionsDocumentRequirements",
  "admissionsFormFields",
  "admissionsFormVersions",
  "admissionsDeclarationVersions",
  "admissionsIntakes",
  "admissionsProgrammes",
  "schoolCapabilityGrants",
  "schoolSiteAuditEvents",
  "schoolSiteRevisions",
  "schoolSiteAssets",
  "schoolSiteProfiles",
  "schoolDomains",
  "schoolApprovalEvidence",
  "contentAuditEvents",
  "aiRunLogs",
  "assessmentBankItems",
  "assessmentBanks",
  "assessmentGenerationProfiles",
  "instructionArtifactSources",
  "instructionArtifactRevisions",
  "instructionArtifactDocuments",
  "instructionArtifacts",
  "instructionTemplates",
  "curriculumUnits",
  "curriculumImports",
  "knowledgeOcrJobs",
  "knowledgeMaterialChunks",
  "knowledgeMaterialClassBindings",
  "knowledgeMaterials",
  "knowledgeTopics",
  "rateLimitCounters",
  "studentSubjectAggregationOptOuts",
  "studentSubjectSelections",
  "studentPromotions",
  "studentGraduations",
  "classSubjectAggregationComponents",
  "classSubjectAggregations",
  "teacherAssignments",
  "classSubjects",
  "classSessionFormTeachers",
  "academicTimelineAuditEvents",
  "academicTerms",
  "academicSessions",
  "schoolEvents",
  "schoolAssessmentSettings",
  "assessmentEditingPolicies",
  "gradingBands",
  "assessmentRecords",
  "historicalTermTotals",
  "reportCardManualAdjustments",
  "reportCardManualAdjustmentEvents",
  "reportCardComments",
  "reportCardExtraStudentValues",
  "reportCardExtraClassAssignments",
  "reportCardExtraBundles",
  "reportCardExtraScaleTemplates",
  "reportCardAttendanceStudentValues",
  "reportCardAttendanceClassValues",
  "reportCardTermSettingGroups",
  "schoolBillingSettings",
  "demoSeedStorageCleanup",
  "demoSeedRuns",
  "feePlanApplications",
  "studentInvoices",
  "paymentGatewayEvents",
  "billingPaymentAttempts",
  "paymentAllocations",
  "billingPayments",
  "feePlans",
  "schoolPaymentProviders",
  "schoolPaymentProviderSecrets",
  "familyMembers",
  "schoolAdminLeadership",
  "students",
  "classes",
  "families",
  "subjects",
  "users",
] as const satisfies readonly TableNames[];

function storageIdsOnDocument(row: object): Id<"_storage">[] {
  const candidate = row as Record<string, unknown>;
  const ids = new Set<string>();

  for (const key of ["photoStorageId", "logoStorageId", "storageId"]) {
    if (typeof candidate[key] === "string") ids.add(candidate[key]);
  }

  if (Array.isArray(candidate.portraitStorageIds)) {
    for (const value of candidate.portraitStorageIds) {
      if (typeof value === "string") ids.add(value);
    }
  }

  if (Array.isArray(candidate.sourceFiles)) {
    for (const value of candidate.sourceFiles) {
      if (typeof value !== "object" || value === null) continue;
      const sourceFile = value as Record<string, unknown>;
      if (typeof sourceFile.storageId === "string") ids.add(sourceFile.storageId);
    }
  }

  return [...ids].map((id) => id as Id<"_storage">);
}

export const TABLES_WITHOUT_BY_SCHOOL_INDEX = new Set([

  "schoolApprovalEvidence",
  "schoolDomains",
  "schoolSiteAssets",
  "schoolSiteRevisions",
  "schoolSiteAuditEvents",
]);

// Foreign key remapping definitions per table

const FK_DEFINITIONS: Record<string, Array<{ field: string; targetTable: string; isArray?: boolean }>> = {
  classes: [
    { field: "formTeacherId", targetTable: "users" },
    { field: "archivedBy", targetTable: "users" },
  ],
  subjects: [
    { field: "archivedBy", targetTable: "users" },
  ],
  schoolEvents: [
    { field: "updatedBy", targetTable: "users" },
    { field: "archivedBy", targetTable: "users" },
  ],
  schoolAssessmentSettings: [
    { field: "updatedBy", targetTable: "users" },
  ],
  gradingBands: [
    { field: "updatedBy", targetTable: "users" },
  ],
  schoolBillingSettings: [
    { field: "updatedBy", targetTable: "users" },
  ],
  academicTerms: [{ field: "sessionId", targetTable: "academicSessions" }],
  users: [
    { field: "managerUserId", targetTable: "users" },
    { field: "archivedBy", targetTable: "users" },
  ],
  families: [
    { field: "createdBy", targetTable: "users" },
    { field: "updatedBy", targetTable: "users" },
  ],
  familyMembers: [
    { field: "familyId", targetTable: "families" },
    { field: "parentUserId", targetTable: "users" },
  ],
  students: [
    { field: "classId", targetTable: "classes" },
    { field: "userId", targetTable: "users" },
    { field: "familyId", targetTable: "families" },
    { field: "archivedBy", targetTable: "users" },
  ],
  classSubjects: [
    { field: "classId", targetTable: "classes" },
    { field: "subjectId", targetTable: "subjects" },
    { field: "teacherId", targetTable: "users" },
  ],
  teacherAssignments: [
    { field: "teacherId", targetTable: "users" },
    { field: "classId", targetTable: "classes" },
    { field: "subjectId", targetTable: "subjects" },
  ],
  classSessionFormTeachers: [
    { field: "classId", targetTable: "classes" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "formTeacherId", targetTable: "users" },
  ],
  assessmentEditingPolicies: [
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "updatedBy", targetTable: "users" },
  ],
  classSubjectAggregations: [
    { field: "classId", targetTable: "classes" },
    { field: "umbrellaSubjectId", targetTable: "subjects" },
  ],
  classSubjectAggregationComponents: [
    { field: "aggregationId", targetTable: "classSubjectAggregations" },
    { field: "componentSubjectId", targetTable: "subjects" },
  ],
  reportCardExtraBundles: [
    { field: "scaleTemplateId", targetTable: "reportCardExtraScaleTemplates" },
  ],
  reportCardTermSettingGroups: [
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "classIds", targetTable: "classes", isArray: true },
  ],
  feePlans: [
    { field: "targetClassIds", targetTable: "classes", isArray: true },
    { field: "createdBy", targetTable: "users" },
    { field: "updatedBy", targetTable: "users" },
  ],
  schoolDomains: [
    { field: "canonicalDomainId", targetTable: "schoolDomains" },
  ],
  schoolSiteProfiles: [
    { field: "draftRevisionId", targetTable: "schoolSiteRevisions" },
    { field: "publishedRevisionId", targetTable: "schoolSiteRevisions" },
    { field: "canonicalDomainId", targetTable: "schoolDomains" },
  ],
  schoolPaymentProviders: [
    { field: "activeSecretId", targetTable: "schoolPaymentProviderSecrets" },
    { field: "pendingSecretId", targetTable: "schoolPaymentProviderSecrets" },
  ],
  academicTimelineAuditEvents: [
    { field: "actorUserId", targetTable: "users" },
  ],
  rateLimitCounters: [
    { field: "actorUserId", targetTable: "users" },
  ],
  studentSubjectSelections: [
    { field: "studentId", targetTable: "students" },
    { field: "classId", targetTable: "classes" },
    { field: "subjectId", targetTable: "subjects" },
    { field: "sessionId", targetTable: "academicSessions" },
  ],
  studentPromotions: [
    { field: "studentId", targetTable: "students" },
    { field: "fromClassId", targetTable: "classes" },
    { field: "toClassId", targetTable: "classes" },
    { field: "fromSessionId", targetTable: "academicSessions" },
    { field: "toSessionId", targetTable: "academicSessions" },
  ],
  studentGraduations: [
    { field: "studentId", targetTable: "students" },
    { field: "classId", targetTable: "classes" },
    { field: "sessionId", targetTable: "academicSessions" },
  ],
  studentSubjectAggregationOptOuts: [
    { field: "studentId", targetTable: "students" },
    { field: "classId", targetTable: "classes" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "aggregationId", targetTable: "classSubjectAggregations" },
  ],
  assessmentRecords: [
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "classId", targetTable: "classes" },
    { field: "subjectId", targetTable: "subjects" },
    { field: "studentId", targetTable: "students" },
    { field: "enteredBy", targetTable: "users" },
    { field: "updatedBy", targetTable: "users" },
  ],
  historicalTermTotals: [
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "classId", targetTable: "classes" },
    { field: "subjectId", targetTable: "subjects" },
    { field: "studentId", targetTable: "students" },
  ],
  reportCardComments: [
    { field: "studentId", targetTable: "students" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
  ],
  reportCardManualAdjustments: [
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "classId", targetTable: "classes" },
    { field: "studentId", targetTable: "students" },
    { field: "subjectId", targetTable: "subjects" },
  ],
  reportCardManualAdjustmentEvents: [
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "classId", targetTable: "classes" },
    { field: "studentId", targetTable: "students" },
    { field: "subjectId", targetTable: "subjects" },
    { field: "actorId", targetTable: "users" },
  ],
  reportCardExtraClassAssignments: [
    { field: "classId", targetTable: "classes" },
    { field: "bundleId", targetTable: "reportCardExtraBundles" },
  ],
  reportCardExtraStudentValues: [
    { field: "classId", targetTable: "classes" },
    { field: "studentId", targetTable: "students" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
    { field: "bundleId", targetTable: "reportCardExtraBundles" },
  ],
  reportCardAttendanceClassValues: [
    { field: "classId", targetTable: "classes" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
  ],
  reportCardAttendanceStudentValues: [
    { field: "classId", targetTable: "classes" },
    { field: "studentId", targetTable: "students" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
  ],
  feePlanApplications: [
    { field: "feePlanId", targetTable: "feePlans" },
    { field: "classId", targetTable: "classes" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
  ],
  studentInvoices: [
    { field: "feePlanId", targetTable: "feePlans" },
    { field: "feePlanApplicationId", targetTable: "feePlanApplications" },
    { field: "studentId", targetTable: "students" },
    { field: "classId", targetTable: "classes" },
    { field: "sessionId", targetTable: "academicSessions" },
    { field: "termId", targetTable: "academicTerms" },
  ],
  schoolSiteAssets: [
    { field: "approvalEvidenceId", targetTable: "schoolApprovalEvidence" },
  ],
  schoolSiteRevisions: [
    { field: "sourceRevisionId", targetTable: "schoolSiteRevisions" },
    { field: "approvalEvidenceIds", targetTable: "schoolApprovalEvidence", isArray: true },
    { field: "publishedByUserId", targetTable: "users" },
  ],
  schoolSiteAuditEvents: [
    { field: "actorUserId", targetTable: "users" },
    { field: "revisionId", targetTable: "schoolSiteRevisions" },
  ],
  billingPaymentAttempts: [
    { field: "invoiceId", targetTable: "studentInvoices" },
  ],
  billingPayments: [
    { field: "invoiceId", targetTable: "studentInvoices" },
  ],
  paymentAllocations: [
    { field: "invoiceId", targetTable: "studentInvoices" },
    { field: "paymentId", targetTable: "billingPayments" },
  ],
  paymentGatewayEvents: [
    { field: "invoiceId", targetTable: "studentInvoices" },
    { field: "paymentId", targetTable: "billingPayments" },
  ],
  schoolApprovalEvidence: [
    { field: "approvedByUserId", targetTable: "users" },
  ],
};

/**
 * 1. Initialize Migration State & Schools
 */
export const initBranchSplit = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const activeState = await ctx.db
      .query("migrationState")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();
    if (activeState) {
      return {
        stateId: activeState._id,
        sourceSchoolId: activeState.sourceSchoolId,
        targetSchoolId: activeState.targetSchoolId,
        firstTable: activeState.currentTable,
      };
    }

    const completedState = await ctx.db
      .query("migrationState")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .first();
    if (completedState?.phase === "duplication_completed") {
      return {
        stateId: completedState._id,
        sourceSchoolId: completedState.sourceSchoolId,
        targetSchoolId: completedState.targetSchoolId,
        firstTable: completedState.currentTable,
      };
    }

    let sourceSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "olive-blessed"))
      .first();

    if (!sourceSchool) {
      sourceSchool = await ctx.db
        .query("schools")
        .filter((q) => q.eq(q.field("slug"), "obhis-fedrah"))
        .first();
    }

    if (!sourceSchool) {
      throw new ConvexError("Source school ('olive-blessed' or 'obhis-fedrah') not found");
    }

    const sourceSchoolId = sourceSchool._id;

    // Check or create Ruga school
    let rugaSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-ruga"))
      .first();

    let rugaSchoolId: Id<"schools">;
    if (!rugaSchool) {
      rugaSchoolId = await ctx.db.insert("schools", {
        name: "Olive Blessed Crest Academy (Ruga, Nasarawa)",
        slug: "obhis-ruga",
        status: "active",
        motto: sourceSchool.motto ?? "...making the world a better place in peace and unity.",
        theme: sourceSchool.theme,
        features: sourceSchool.features ?? {
          billing: true,
          curriculum: true,
          knowledgeLibrary: true,
          admissions: false,
        },
        logoStorageId: sourceSchool.logoStorageId,
        logoFileName: sourceSchool.logoFileName,
        logoContentType: sourceSchool.logoContentType,
        logoUpdatedAt: sourceSchool.logoUpdatedAt,
        contactEmail: "admin.ruga@oliveblessed.com",
        address: "Ruga, Nasarawa State",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      rugaSchoolId = rugaSchool._id;
      await ctx.db.patch(rugaSchoolId, {
        name: "Olive Blessed Crest Academy (Ruga, Nasarawa)",
        slug: "obhis-ruga",
        status: "active",
        contactEmail: "admin.ruga@oliveblessed.com",
        address: "Ruga, Nasarawa State",
        updatedAt: now,
      });
    }

    // Patch source school (Fedrah)
    await ctx.db.patch(sourceSchoolId, {
      name: "Olive Blessed Crest Academy (Fedrah, Abuja)",
      slug: "obhis-fedrah",
      status: "active",
      contactEmail: "obhischool@gmail.com",
      updatedAt: now,
    });

    // Clear any previous migrationState records
    const previousStates = await ctx.db.query("migrationState").collect();
    for (const s of previousStates) {
      await ctx.db.delete(s._id);
    }

    // Insert new migrationState record
    const stateId = await ctx.db.insert("migrationState", {
      phase: "duplication",
      sourceSchoolId,
      targetSchoolId: rugaSchoolId,
      currentTable: ALL_DUPLICATION_TABLES[0],
      cursor: undefined,
      idMaps: JSON.stringify({}),
      tablesCompleted: [],
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    return {
      stateId,
      sourceSchoolId,
      targetSchoolId: rugaSchoolId,
      firstTable: ALL_DUPLICATION_TABLES[0],
    };
  },
});

export const getMigrationState = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("migrationState"),
      phase: v.string(),
      sourceSchoolId: v.id("schools"),
      targetSchoolId: v.id("schools"),
      currentTable: v.string(),
      cursor: v.optional(v.string()),
      tablesCompleted: v.array(v.string()),
      status: v.union(
        v.literal("idle"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      ),
      error: v.optional(v.string()),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const state = await ctx.db.query("migrationState").order("desc").first();
    if (!state) return null;

    return {
      _id: state._id,
      phase: state.phase,
      sourceSchoolId: state.sourceSchoolId,
      targetSchoolId: state.targetSchoolId,
      currentTable: state.currentTable,
      cursor: state.cursor,
      tablesCompleted: state.tablesCompleted,
      status: state.status,
      error: state.error,
      updatedAt: state.updatedAt,
    };
  },
});

/**
 * 2. Batched Duplication
 */
export const duplicateBatch = internalMutation({
  args: {
    stateId: v.optional(v.id("migrationState")),
  },
  handler: async (ctx, args) => {
    const state = args.stateId
      ? await ctx.db.get(args.stateId)
      : await ctx.db
          .query("migrationState")
          .withIndex("by_status", (q) => q.eq("status", "running"))
          .first();
    if (!state || state.status !== "running") {
      return { done: true, message: "Migration state not in running mode" };
    }

    const currentTable = state.currentTable as any;
    const sourceSchoolId = state.sourceSchoolId;
    const targetSchoolId = state.targetSchoolId;
    const idMaps: Record<string, Record<string, string>> = JSON.parse(state.idMaps || "{}");
    if (!idMaps[currentTable]) {
      idMaps[currentTable] = {};
    }

    if (currentTable.startsWith("__user_fk_remap__:")) {
      const table = currentTable.slice("__user_fk_remap__:".length);
      const userMap = idMaps.users || {};
      const userDefs = (FK_DEFINITIONS[table] || []).filter(
        (definition) => definition.targetTable === "users"
      );

      let remapQuery = ctx.db.query(table as any);
      if (TABLES_WITHOUT_BY_SCHOOL_INDEX.has(table)) {
        remapQuery = (remapQuery as any).filter((q: any) =>
          q.eq(q.field("schoolId"), targetSchoolId)
        );
      } else {
        remapQuery = (remapQuery as any).withIndex("by_school", (q: any) =>
          q.eq("schoolId", targetSchoolId)
        );
      }

      const remapPage = await (remapQuery as any).paginate({
        numItems: 50,
        cursor: state.cursor ?? null,
      });
      for (const row of remapPage.page) {
        const patch: Record<string, string> = {};
        for (const definition of userDefs) {
          const value = row[definition.field];
          if (typeof value === "string" && userMap[value]) {
            patch[definition.field] = userMap[value];
          }
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(row._id, patch);
        }
      }

      if (!remapPage.isDone) {
        await ctx.db.patch(state._id, {
          cursor: remapPage.continueCursor,
          updatedAt: Date.now(),
        });
        return { done: false, currentTable: table, progress: "remapping_user_fks" };
      }

      const remapIndex = USER_FK_REMAP_TABLES.indexOf(
        table as (typeof USER_FK_REMAP_TABLES)[number]
      );
      const nextRemapTable = USER_FK_REMAP_TABLES[remapIndex + 1];
      if (nextRemapTable) {
        await ctx.db.patch(state._id, {
          currentTable: userRemapStage(nextRemapTable),
          cursor: undefined,
          updatedAt: Date.now(),
        });
        return { done: false, currentTable: nextRemapTable, progress: "next_remap_table" };
      }

      await ctx.db.patch(state._id, {
        phase: "duplication_completed",
        status: "completed",
        cursor: undefined,
        idMaps: JSON.stringify(idMaps),
        updatedAt: Date.now(),
      });
      return { done: true, tablesCompletedCount: state.tablesCompleted.length };
    }

    // Fetch batch of up to 50 documents
    let query = ctx.db.query(currentTable);
    if (TABLES_WITHOUT_BY_SCHOOL_INDEX.has(currentTable)) {
      query = (query as any).filter((q: any) => q.eq(q.field("schoolId"), sourceSchoolId));
    } else {
      query = (query as any).withIndex("by_school", (q: any) => q.eq("schoolId", sourceSchoolId));
    }

    const page = await query.paginate({
      numItems: 50,
      cursor: state.cursor ?? null,
    });

    const fkDefs = FK_DEFINITIONS[currentTable] || [];

    for (const doc of page.page) {
      const oldId = doc._id as string;
      // If already duplicated in previous attempt, skip
      if (idMaps[currentTable][oldId]) {
        continue;
      }

      // Clone document and strip system fields
      const newDoc: any = { ...doc };
      delete newDoc._id;
      delete newDoc._creationTime;

      // Set target school
      newDoc.schoolId = targetSchoolId;

      // For classes table, formTeacherId is initially unset for Ruga
      if (currentTable === "classes") {
        newDoc.formTeacherId = undefined;
      }

      // Remap foreign keys
      for (const def of fkDefs) {
        const val = newDoc[def.field];
        if (!val) continue;

        const targetMap = idMaps[def.targetTable] || {};
        if (def.isArray && Array.isArray(val)) {
          newDoc[def.field] = val.map((id: string) => targetMap[id] ?? id);
        } else if (typeof val === "string") {
          if (targetMap[val]) {
            newDoc[def.field] = targetMap[val];
          }
        }
      }

      // Insert duplicated row
      const newId = await ctx.db.insert(currentTable, newDoc);
      idMaps[currentTable][oldId] = newId as string;
    }

    // Check if current table is done
    if (!page.isDone && page.continueCursor) {
      // Update cursor and continue table
      await ctx.db.patch(state._id, {
        cursor: page.continueCursor,
        idMaps: JSON.stringify(idMaps),
        updatedAt: Date.now(),
      });
      return { done: false, currentTable, progress: "in_progress" };
    }

    // Current table completed!
    const completed = [...state.tablesCompleted, currentTable];
    const nextTableIndex = ALL_DUPLICATION_TABLES.indexOf(currentTable) + 1;

    if (nextTableIndex < ALL_DUPLICATION_TABLES.length) {
      const nextTable = ALL_DUPLICATION_TABLES[nextTableIndex];
      await ctx.db.patch(state._id, {
        currentTable: nextTable,
        cursor: undefined,
        idMaps: JSON.stringify(idMaps),
        tablesCompleted: completed,
        updatedAt: Date.now(),
      });
      return { done: false, currentTable: nextTable, progress: "next_table" };
    }

    // User-linked fields in early-tier tables can only be remapped after users have
    // been duplicated. Continue through bounded, resumable remap stages.
    await ctx.db.patch(state._id, {
      currentTable: userRemapStage(USER_FK_REMAP_TABLES[0]),
      cursor: undefined,
      idMaps: JSON.stringify(idMaps),
      tablesCompleted: completed,
      updatedAt: Date.now(),
    });

    return {
      done: false,
      currentTable: USER_FK_REMAP_TABLES[0],
      progress: "remapping_user_fks",
    };
  },
});

/**
 * 3. Cascade Delete Wrong-Branch Data (1 class per invocation to guarantee small transactions)
 */
export const cascadeDeleteWrongBranchData = internalMutation({
  args: {
    target: v.optional(v.union(v.literal("ruga"), v.literal("fedrah"))),
    schoolSlug: v.optional(
      v.union(v.literal("obhis-ruga"), v.literal("obhis-fedrah"))
    ),
  },
  handler: async (ctx, args) => {
    const target = args.schoolSlug
      ? args.schoolSlug === "obhis-ruga"
        ? "ruga"
        : "fedrah"
      : args.target;

    if (!target) {
      throw new ConvexError("Provide target or schoolSlug for cascade delete");
    }

    const fedrahSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-fedrah"))
      .first();

    const rugaSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-ruga"))
      .first();

    if (!fedrahSchool || !rugaSchool) {
      throw new ConvexError("Schools not found for cascade delete");
    }

    const schoolId = target === "ruga" ? rugaSchool._id : fedrahSchool._id;

    // Fetch classes for this school
    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    // Determine which classes to delete:
    // If target is ruga: delete non-fountain / non-blaze classes
    // If target is fedrah: delete fountain / blaze classes
    const classesToDelete = classes.filter((c) => {
      const isRugaClass = c.name.includes("Olive Fountain") || c.name.includes("Olive Blaze");
      return target === "ruga" ? !isRugaClass : isRugaClass;
    });

    if (classesToDelete.length === 0) {
      return { done: true, target, remainingClasses: 0 };
    }

    // Process the first class to delete
    const cls = classesToDelete[0];
    const classId = cls._id;

    // 1. Delete class-level attendance and report card extras (indexed by classId)
    const attClassVals = await ctx.db
      .query("reportCardAttendanceClassValues")
      .withIndex("by_class_session_term", (q) => q.eq("classId", classId))
      .collect();
    for (const av of attClassVals) await ctx.db.delete(av._id);

    const attStudentVals = await ctx.db
      .query("reportCardAttendanceStudentValues")
      .withIndex("by_class_session_term", (q) => q.eq("classId", classId))
      .collect();
    for (const sv of attStudentVals) await ctx.db.delete(sv._id);

    const extraStudentVals = await ctx.db
      .query("reportCardExtraStudentValues")
      .withIndex("by_class_session_term", (q) => q.eq("classId", classId))
      .collect();
    for (const ev of extraStudentVals) await ctx.db.delete(ev._id);

    const extraClassAssignments = await ctx.db
      .query("reportCardExtraClassAssignments")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    for (const ea of extraClassAssignments) await ctx.db.delete(ea._id);

    const histTotals = await ctx.db
      .query("historicalTermTotals")
      .withIndex("by_class_session_term", (q) => q.eq("classId", classId))
      .collect();
    for (const h of histTotals) await ctx.db.delete(h._id);

    const subjectSelections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    for (const s of subjectSelections) await ctx.db.delete(s._id);

    const optOuts = await ctx.db
      .query("studentSubjectAggregationOptOuts")
      .withIndex("by_class_and_session", (q) => q.eq("classId", classId))
      .collect();
    for (const o of optOuts) await ctx.db.delete(o._id);

    const aggregations = await ctx.db
      .query("classSubjectAggregations")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    for (const agg of aggregations) {
      const comps = await ctx.db
        .query("classSubjectAggregationComponents")
        .withIndex("by_aggregation", (q) => q.eq("aggregationId", agg._id))
        .collect();
      for (const c of comps) await ctx.db.delete(c._id);
      await ctx.db.delete(agg._id);
    }

    const formTeachers = await ctx.db
      .query("classSessionFormTeachers")
      .withIndex("by_class_and_session", (q) => q.eq("classId", classId))
      .collect();
    for (const ft of formTeachers) await ctx.db.delete(ft._id);

    const assignments = await ctx.db
      .query("teacherAssignments")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);

    const offerings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();
    for (const o of offerings) await ctx.db.delete(o._id);

    const feeApps = await ctx.db
      .query("feePlanApplications")
      .withIndex("by_class_session_term", (q) => q.eq("classId", classId))
      .collect();
    for (const fa of feeApps) await ctx.db.delete(fa._id);

    // Invoices for this class
    const invoices = await ctx.db
      .query("studentInvoices")
      .withIndex("by_school_and_class", (q) => q.eq("schoolId", schoolId).eq("classId", classId))
      .collect();

    for (const inv of invoices) {
      const payments = await ctx.db
        .query("billingPayments")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", inv._id))
        .collect();
      for (const p of payments) {
        const allocs = await ctx.db
          .query("paymentAllocations")
          .withIndex("by_payment", (q) => q.eq("paymentId", p._id))
          .collect();
        for (const a of allocs) await ctx.db.delete(a._id);
        await ctx.db.delete(p._id);
      }

      const attempts = await ctx.db
        .query("billingPaymentAttempts")
        .withIndex("by_school_and_invoice", (q) => q.eq("schoolId", schoolId).eq("invoiceId", inv._id))
        .collect();
      for (const att of attempts) await ctx.db.delete(att._id);

      await ctx.db.delete(inv._id);
    }

    // 2. Find students in this class and delete their individual records
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();

    for (const student of students) {
      const studentId = student._id;

      // Comments
      const comments = await ctx.db
        .query("reportCardComments")
        .withIndex("by_student_session_term", (q) => q.eq("studentId", studentId))
        .collect();
      for (const c of comments) await ctx.db.delete(c._id);

      // Manual adjustments
      const adjustments = await ctx.db
        .query("reportCardManualAdjustments")
        .withIndex("by_student_and_report_term", (q) => q.eq("schoolId", schoolId).eq("studentId", studentId))
        .collect();
      for (const a of adjustments) await ctx.db.delete(a._id);

      const adjEvents = await ctx.db
        .query("reportCardManualAdjustmentEvents")
        .withIndex("by_student_and_report_term", (q) => q.eq("schoolId", schoolId).eq("studentId", studentId))
        .collect();
      for (const e of adjEvents) await ctx.db.delete(e._id);

      // Assessment records
      const assessments = await ctx.db
        .query("assessmentRecords")
        .withIndex("by_student_and_session", (q) => q.eq("schoolId", schoolId).eq("studentId", studentId))
        .collect();
      for (const a of assessments) await ctx.db.delete(a._id);

      // Promotions & graduations
      const promos = await ctx.db
        .query("studentPromotions")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .collect();
      for (const p of promos) await ctx.db.delete(p._id);

      const grads = await ctx.db
        .query("studentGraduations")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .collect();
      for (const g of grads) await ctx.db.delete(g._id);

      // Delete student user account if role === 'student'
      if (student.userId) {
        const user = await ctx.db.get(student.userId);
        if (user && user.role === "student" && user.schoolId === schoolId) {
          await ctx.db.delete(user._id);
        }
      }

      await ctx.db.delete(student._id);
    }

    // Report card term settings groups
    const termGroups = await ctx.db
      .query("reportCardTermSettingGroups")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    for (const g of termGroups) {
      if (g.classIds.includes(classId)) {
        const nextClassIds = g.classIds.filter((id) => id !== classId);
        if (nextClassIds.length === 0) {
          await ctx.db.delete(g._id);
        } else {
          await ctx.db.patch(g._id, { classIds: nextClassIds, updatedAt: Date.now() });
        }
      }
    }

    // Delete the class itself
    await ctx.db.delete(cls._id);

    // The caller owns the loop so each invocation stays observable and
    // cannot race a scheduled invocation against the next batch.
    const remainingCount = classesToDelete.length - 1;

    return {
      done: remainingCount === 0,
      target,
      deletedClass: cls.name,
      remainingClasses: remainingCount,
    };
  },
});


/**
 * 4. Wipe Knowledge Hub & AI Content (Both Schools)
 */
export const getRetainedSchoolIdsInternal = internalQuery({
  args: {},
  returns: v.array(v.id("schools")),
  handler: async (ctx): Promise<Array<Id<"schools">>> => {
    const schoolIds: Array<Id<"schools">> = [];
    for (const slug of ["obhis-fedrah", "obhis-ruga"]) {
      const school = await ctx.db
        .query("schools")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (school) schoolIds.push(school._id);
    }
    return schoolIds;
  },
});

export const wipeKnowledgeHubAndAiBatch = internalMutation({
  args: {
    schoolId: v.id("schools"),
    tableName: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const docs = await (ctx.db.query(args.tableName as any) as any)
      .filter((q: any) => q.eq(q.field("schoolId"), args.schoolId))
      .take(50);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return docs.length;
  },
});

export const wipeKnowledgeHubAndAi = internalAction({
  args: {},
  returns: v.object({
    totalDeleted: v.number(),
    tablesProcessed: v.number(),
  }),
  handler: async (ctx): Promise<{ totalDeleted: number; tablesProcessed: number }> => {
    const schoolIds = await ctx.runQuery(
      internal.functions.academic.branchSplitV2.getRetainedSchoolIdsInternal,
      {}
    );
    if (schoolIds.length !== 2) {
      throw new ConvexError("Both retained schools must exist before the Knowledge Hub wipe");
    }

    let totalDeleted = 0;
    for (const tableName of KNOWLEDGE_AI_TABLES) {
      for (const schoolId of schoolIds) {
        while (true) {
          const deleted = await ctx.runMutation(
            internal.functions.academic.branchSplitV2.wipeKnowledgeHubAndAiBatch,
            { schoolId, tableName }
          );
          totalDeleted += deleted;
          if (deleted === 0) break;
        }
      }
    }

    return {
      totalDeleted,
      tablesProcessed: KNOWLEDGE_AI_TABLES.length,
    };
  },
});

export const getKnowledgeHubAndAiCounts = internalQuery({
  args: {},
  returns: v.object({
    total: v.number(),
    byTable: v.record(v.string(), v.number()),
  }),
  handler: async (ctx) => {
    const schoolIds = await ctx.runQuery(
      internal.functions.academic.branchSplitV2.getRetainedSchoolIdsInternal,
      {}
    );
    const byTable: Record<string, number> = {};
    let total = 0;

    for (const tableName of KNOWLEDGE_AI_TABLES) {
      let tableCount = 0;
      for (const schoolId of schoolIds) {
        const docs = await (ctx.db.query(tableName as any) as any)
          .filter((q: any) => q.eq(q.field("schoolId"), schoolId))
          .collect();
        tableCount += docs.length;
      }
      byTable[tableName] = tableCount;
      total += tableCount;
    }

    return { total, byTable };
  },
});

const STORAGE_REFERENCE_TABLES = [
  "students",
  "schoolSiteAssets",
  "admissionsDocuments",
  "knowledgeMaterials",
  "knowledgeOcrJobs",
  "demoSeedRuns",
  "demoSeedStorageCleanup",
  "importWorkspaces",
] as const satisfies readonly TableNames[];

export const getRetainedStorageIdsInternal = internalQuery({
  args: {},
  returns: v.array(v.id("_storage")),
  handler: async (ctx): Promise<Array<Id<"_storage">>> => {
    const retainedSchools = (await ctx.db.query("schools").collect()).filter((school) =>
      RETAINED_SCHOOL_SLUGS.has(school.slug)
    );
    const retainedSchoolIds = retainedSchools.map((school) => school._id);
    const storageIds = new Set<string>();

    for (const school of retainedSchools) {
      if (school.logoStorageId) storageIds.add(String(school.logoStorageId));
    }

    if (retainedSchoolIds.length === 0) return [];

    for (const tableName of STORAGE_REFERENCE_TABLES) {
      const docs = await (ctx.db.query(tableName as any) as any)
        .filter((q: any) =>
          retainedSchoolIds.length === 1
            ? q.eq(q.field("schoolId"), retainedSchoolIds[0])
            : q.or(
                q.eq(q.field("schoolId"), retainedSchoolIds[0]),
                q.eq(q.field("schoolId"), retainedSchoolIds[1])
              )
        )
        .collect();
      for (const doc of docs) {
        for (const storageId of storageIdsOnDocument(doc)) {
          storageIds.add(String(storageId));
        }
      }
    }

    return [...storageIds].map((storageId) => storageId as Id<"_storage">);
  },
});

export const getNonRetainedAuthUsersInternal = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      authId: v.string(),
      email: v.string(),
    })
  ),
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    const platformAuthIds = new Set(
      (await ctx.db.query("platformAdmins").collect()).map((admin) => admin.authId)
    );
    const usersByAuthId = new Map<string, { authId: string; email: string }>();

    for (const school of schools) {
      if (RETAINED_SCHOOL_SLUGS.has(school.slug)) continue;
      const users = await ctx.db
        .query("users")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .collect();
      for (const user of users) {
        if (user.authId && !platformAuthIds.has(user.authId)) {
          usersByAuthId.set(user.authId, { authId: user.authId, email: user.email });
        }
      }
    }

    return [...usersByAuthId.values()];
  },
});

export const isAuthIdRetainedInternal = internalQuery({
  args: { authId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const platformAdmins = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth", (q) => q.eq("authId", args.authId))
      .take(1);
    if (platformAdmins.length > 0) return true;

    const users = await ctx.db
      .query("users")
      .withIndex("by_auth", (q) => q.eq("authId", args.authId))
      .collect();
    for (const user of users) {
      const school = await ctx.db.get(user.schoolId);
      if (school && RETAINED_SCHOOL_SLUGS.has(school.slug)) return true;
    }

    return false;
  },
});

const ADMISSIONS_GUARDIAN_REFERENCE_TABLES = [
  "admissionsPurchaseAttempts",
  "admissionsEntitlements",
  "admissionsApplications",
  "admissionsSubmissionSnapshots",
  "admissionsDocuments",
  "admissionsDocumentAccessAudits",
  "admissionsReviewEvents",
  "admissionsCommunicationOutbox",
  "admissionsAuditEvents",
] as const satisfies readonly TableNames[];

function collectReferencedGuardianIds(
  row: object,
  knownGuardianIds: ReadonlySet<string>,
  referencedGuardianIds: Set<string>
) {
  for (const value of Object.values(row as Record<string, unknown>)) {
    if (typeof value === "string" && knownGuardianIds.has(value)) {
      referencedGuardianIds.add(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && knownGuardianIds.has(item)) {
          referencedGuardianIds.add(item);
        }
      }
    }
  }
}

export const getOrphanAdmissionsGuardianIdsInternal = internalQuery({
  args: {},
  returns: v.array(v.id("admissionsGuardians")),
  handler: async (ctx): Promise<Array<Id<"admissionsGuardians">>> => {
    const guardians = await ctx.db.query("admissionsGuardians").collect();
    const knownGuardianIds = new Set(guardians.map((guardian) => String(guardian._id)));
    const referencedGuardianIds = new Set<string>();

    for (const tableName of ADMISSIONS_GUARDIAN_REFERENCE_TABLES) {
      const rows = await (ctx.db.query(tableName as any) as any).collect();
      for (const row of rows) {
        collectReferencedGuardianIds(row, knownGuardianIds, referencedGuardianIds);
      }
    }

    return guardians
      .filter((guardian) => !referencedGuardianIds.has(String(guardian._id)))
      .map((guardian) => guardian._id);
  },
});

export const deleteAdmissionsGuardiansBatch = internalMutation({
  args: {
    guardianIds: v.array(v.id("admissionsGuardians")),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    let deleted = 0;
    for (const guardianId of args.guardianIds) {
      if (await ctx.db.get(guardianId)) {
        await ctx.db.delete(guardianId);
        deleted++;
      }
    }
    return deleted;
  },
});

const purgePhaseValidator = v.union(
  v.literal("schools"),
  v.literal("billing"),
  v.literal("complete")
);

const purgeBatchResultValidator = v.object({
  done: v.boolean(),
  phase: purgePhaseValidator,
  deletedCount: v.number(),
  storageIds: v.array(v.id("_storage")),
  schoolSlug: v.optional(v.string()),
  tableName: v.optional(v.string()),
  deletedSchool: v.optional(v.string()),
});

export const purgeOtherSchoolsAndLegacyBilling = internalMutation({
  args: {},
  returns: purgeBatchResultValidator,
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    const nonRetainedSchools = schools.filter(
      (school) => !RETAINED_SCHOOL_SLUGS.has(school.slug)
    );

    // Delete one table batch at a time, then remove the school document only
    // after every school-scoped table is empty for that school.
    for (const school of nonRetainedSchools) {
      for (const tableName of SCHOOL_PURGE_TABLES) {
        const rows = await (ctx.db.query(tableName as any) as any)
          .filter((q: any) => q.eq(q.field("schoolId"), school._id))
          .take(50);
        if (rows.length === 0) continue;

        const storageIds = new Set<string>();
        for (const row of rows) {
          for (const storageId of storageIdsOnDocument(row)) {
            storageIds.add(String(storageId));
          }
          await ctx.db.delete(row._id);
        }

        return {
          done: false,
          phase: "schools" as const,
          deletedCount: rows.length,
          storageIds: [...storageIds].map((storageId) => storageId as Id<"_storage">),
          schoolSlug: school.slug,
          tableName,
        };
      }

      const storageIds = school.logoStorageId ? [school.logoStorageId] : [];
      await ctx.db.delete(school._id);
      return {
        done: false,
        phase: "schools" as const,
        deletedCount: 1,
        storageIds,
        deletedSchool: school.slug,
      };
    }

    const retainedSchools = schools.filter((school) =>
      RETAINED_SCHOOL_SLUGS.has(school.slug)
    );
    for (const tableName of LEGACY_BILLING_TABLES) {
      for (const school of retainedSchools) {
        const rows = await (ctx.db.query(tableName as any) as any)
          .filter((q: any) => q.eq(q.field("schoolId"), school._id))
          .take(50);
        if (rows.length === 0) continue;

        const storageIds = new Set<string>();
        for (const row of rows) {
          for (const storageId of storageIdsOnDocument(row)) {
            storageIds.add(String(storageId));
          }
          await ctx.db.delete(row._id);
        }

        return {
          done: false,
          phase: "billing" as const,
          deletedCount: rows.length,
          storageIds: [...storageIds].map((storageId) => storageId as Id<"_storage">),
          schoolSlug: school.slug,
          tableName,
        };
      }
    }

    return {
      done: true,
      phase: "complete" as const,
      deletedCount: 0,
      storageIds: [],
    };
  },
});

/**
 * 5. Prune Unused Subjects, Teachers, and Empty Families
 */
export const pruneSubjectsAndUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fedrahSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-fedrah"))
      .first();

    const rugaSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-ruga"))
      .first();

    if (!fedrahSchool || !rugaSchool) {
      throw new ConvexError("Schools not found");
    }

    const schools = [fedrahSchool._id, rugaSchool._id];
    let prunedSubjects = 0;
    let prunedTeachers = 0;
    let prunedFamilies = 0;

    for (const schoolId of schools) {
      // 1. Prune unused subjects
      const subjects = await ctx.db
        .query("subjects")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .collect();

      for (const sub of subjects) {
        const offerings = await ctx.db
          .query("classSubjects")
          .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
          .filter((q) => q.eq(q.field("subjectId"), sub._id))
          .first();

        if (!offerings) {
          // Also check if any umbrella subject aggregation references it
          const agg = await ctx.db
            .query("classSubjectAggregations")
            .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
            .filter((q) => q.eq(q.field("umbrellaSubjectId"), sub._id))
            .first();

          if (!agg) {
            await ctx.db.delete(sub._id);
            prunedSubjects++;
          }
        }
      }

      // 2. Prune empty families
      const families = await ctx.db
        .query("families")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .collect();

      for (const fam of families) {
        const members = await ctx.db
          .query("familyMembers")
          .withIndex("by_family", (q) => q.eq("familyId", fam._id))
          .first();

        const students = await ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
          .filter((q) => q.eq(q.field("familyId"), fam._id))
          .first();

        if (!members && !students) {
          await ctx.db.delete(fam._id);
          prunedFamilies++;
        }
      }
    }

    // 3. Prune teachers in Ruga with no assignments and no class subjects
    const rugaTeachers = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaSchool._id))
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .collect();

    for (const t of rugaTeachers) {
      const hasAssignments = await ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher", (q) => q.eq("teacherId", t._id))
        .first();

      const hasOfferings = await ctx.db
        .query("classSubjects")
        .withIndex("by_school", (q) => q.eq("schoolId", rugaSchool._id))
        .filter((q) => q.eq(q.field("teacherId"), t._id))
        .first();

      if (!hasAssignments && !hasOfferings) {
        await ctx.db.delete(t._id);
        prunedTeachers++;
      }
    }

    return {
      prunedSubjects,
      prunedTeachers,
      prunedFamilies,
    };
  },
});

export const activateRetainedStudents = internalMutation({
  args: {},
  returns: v.object({
    fedrahActivated: v.number(),
    rugaActivated: v.number(),
  }),
  handler: async (ctx) => {
    let fedrahActivated = 0;
    let rugaActivated = 0;

    for (const branch of [
      { slug: "obhis-fedrah", key: "fedrah" as const },
      { slug: "obhis-ruga", key: "ruga" as const },
    ]) {
      const school = await ctx.db
        .query("schools")
        .withIndex("by_slug", (q) => q.eq("slug", branch.slug))
        .unique();
      if (!school) throw new ConvexError(`School ${branch.slug} not found`);

      const students = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .collect();
      for (const student of students) {
        if (student.isArchived !== true) continue;
        await ctx.db.patch(student._id, {
          isArchived: false,
          archivedAt: undefined,
          archivedBy: undefined,
          updatedAt: Date.now(),
        });
        if (branch.key === "fedrah") fedrahActivated++;
        else rugaActivated++;
      }
    }

    return { fedrahActivated, rugaActivated };
  },
});

/**
 * 6. Split Integrity Check Query
 */
export const runSplitIntegrityCheck = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allSchools = await ctx.db.query("schools").collect();
    const fedrahSchool = allSchools.find((school) => school.slug === "obhis-fedrah");
    const rugaSchool = allSchools.find((school) => school.slug === "obhis-ruga");

    if (!fedrahSchool || !rugaSchool) {
      return {
        passed: false,
        error: "One or both schools not found (expected 'obhis-fedrah' and 'obhis-ruga')",
      };
    }

    const fedrahId = fedrahSchool._id;
    const rugaId = rugaSchool._id;

    const anomalies: string[] = [];

    const expectedSchoolSlugs = new Set(["obhis-fedrah", "obhis-ruga"]);
    if (
      allSchools.length !== 2 ||
      allSchools.some((school) => !expectedSchoolSlugs.has(school.slug))
    ) {
      anomalies.push(
        `Expected exactly the two retained schools; found ${allSchools
          .map((school) => school.slug)
          .join(", ")}`
      );
    }

    const retainedSchoolIds = new Set([String(fedrahId), String(rugaId)]);
    for (const tableName of SCHOOL_PURGE_TABLES) {
      const rows = await (ctx.db.query(tableName as any) as any).collect();
      for (const row of rows) {
        const schoolId = (row as Record<string, unknown>).schoolId;
        if (typeof schoolId === "string" && !retainedSchoolIds.has(schoolId)) {
          anomalies.push(
            `Table ${tableName} contains row ${String(row._id)} for school ${schoolId}`
          );
        }
      }
    }

    // Check 1: Cross-School Foreign Key Integrity
    const allStudents = await ctx.db.query("students").collect();
    for (const s of allStudents) {
      const cls = await ctx.db.get(s.classId);
      if (!cls) {
        anomalies.push(`Student ${s._id} (${s.admissionNumber}) has dangling classId ${s.classId}`);
      } else if (cls.schoolId !== s.schoolId) {
        anomalies.push(`Student ${s._id} schoolId (${s.schoolId}) !== class.schoolId (${cls.schoolId})`);
      }

      if (s.userId) {
        const u = await ctx.db.get(s.userId);
        if (!u) {
          anomalies.push(`Student ${s._id} has dangling userId ${s.userId}`);
        } else if (u.schoolId !== s.schoolId) {
          anomalies.push(`Student ${s._id} schoolId (${s.schoolId}) !== user.schoolId (${u.schoolId})`);
        }
      }
    }

    for (const tableName of LEGACY_BILLING_TABLES) {
      const legacyRows = await (ctx.db.query(tableName as any) as any).collect();
      if (legacyRows.length > 0) {
        anomalies.push(`Legacy billing table ${tableName} still contains ${legacyRows.length} rows`);
      }
    }

    const allInvoices = await ctx.db.query("studentInvoices").collect();
    for (const inv of allInvoices) {
      const s = await ctx.db.get(inv.studentId);
      if (s && s.schoolId !== inv.schoolId) {
        anomalies.push(`Invoice ${inv._id} schoolId (${inv.schoolId}) !== student.schoolId (${s.schoolId})`);
      }
    }

    const allAssessments = await ctx.db.query("assessmentRecords").collect();
    for (const a of allAssessments) {
      const s = await ctx.db.get(a.studentId);
      if (s && s.schoolId !== a.schoolId) {
        anomalies.push(`Assessment ${a._id} schoolId (${a.schoolId}) !== student.schoolId (${s.schoolId})`);
      }
      if (a.enteredBy) {
        const u = await ctx.db.get(a.enteredBy);
        if (u && u.schoolId !== a.schoolId) {
          anomalies.push(`Assessment ${a._id} schoolId (${a.schoolId}) !== enteredBy user.schoolId (${u.schoolId})`);
        }
      }
      if (a.updatedBy) {
        const u = await ctx.db.get(a.updatedBy);
        if (u && u.schoolId !== a.schoolId) {
          anomalies.push(`Assessment ${a._id} schoolId (${a.schoolId}) !== updatedBy user.schoolId (${u.schoolId})`);
        }
      }
    }

    const allAssessmentSettings = await ctx.db.query("schoolAssessmentSettings").collect();
    for (const st of allAssessmentSettings) {
      if (st.updatedBy) {
        const u = await ctx.db.get(st.updatedBy);
        if (u && u.schoolId !== st.schoolId) {
          anomalies.push(`AssessmentSettings ${st._id} schoolId (${st.schoolId}) !== updatedBy user.schoolId (${u.schoolId})`);
        }
      }
    }

    const allGradingBands = await ctx.db.query("gradingBands").collect();
    for (const gb of allGradingBands) {
      if (gb.updatedBy) {
        const u = await ctx.db.get(gb.updatedBy);
        if (u && u.schoolId !== gb.schoolId) {
          anomalies.push(`GradingBand ${gb._id} schoolId (${gb.schoolId}) !== updatedBy user.schoolId (${u.schoolId})`);
        }
      }
    }

    const allBillingSettings = await ctx.db.query("schoolBillingSettings").collect();
    for (const bs of allBillingSettings) {
      if (bs.updatedBy) {
        const u = await ctx.db.get(bs.updatedBy);
        if (u && u.schoolId !== bs.schoolId) {
          anomalies.push(`BillingSettings ${bs._id} schoolId (${bs.schoolId}) !== updatedBy user.schoolId (${u.schoolId})`);
        }
      }
    }

    const allEvents = await ctx.db.query("schoolEvents").collect();
    for (const ev of allEvents) {
      if (ev.updatedBy) {
        const u = await ctx.db.get(ev.updatedBy);
        if (u && u.schoolId !== ev.schoolId) {
          anomalies.push(`SchoolEvent ${ev._id} schoolId (${ev.schoolId}) !== updatedBy user.schoolId (${u.schoolId})`);
        }
      }
    }

    const allApprovalEvidence = await ctx.db.query("schoolApprovalEvidence").collect();
    for (const ae of allApprovalEvidence) {
      if (ae.approvedByUserId) {
        const u = await ctx.db.get(ae.approvedByUserId);
        if (u && u.schoolId !== ae.schoolId) {
          anomalies.push(`ApprovalEvidence ${ae._id} schoolId (${ae.schoolId}) !== approvedByUserId user.schoolId (${u.schoolId})`);
        }
      }
    }

    const allPaymentProviders = await ctx.db.query("schoolPaymentProviders").collect();
    for (const p of allPaymentProviders) {
      if (p.activeSecretId) {
        const sec = await ctx.db.get(p.activeSecretId);
        if (!sec) {
          anomalies.push(`PaymentProvider ${p._id} has dangling activeSecretId ${p.activeSecretId}`);
        } else if (sec.schoolId !== p.schoolId) {
          anomalies.push(`PaymentProvider ${p._id} schoolId (${p.schoolId}) !== activeSecret.schoolId (${sec.schoolId})`);
        }
      }
      if (p.pendingSecretId) {
        const sec = await ctx.db.get(p.pendingSecretId);
        if (!sec) {
          anomalies.push(`PaymentProvider ${p._id} has dangling pendingSecretId ${p.pendingSecretId}`);
        } else if (sec.schoolId !== p.schoolId) {
          anomalies.push(`PaymentProvider ${p._id} schoolId (${p.schoolId}) !== pendingSecret.schoolId (${sec.schoolId})`);
        }
      }
    }

    // Check 2: Class partitioning
    const fedrahClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .collect();

    const rugaClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect();

    const expectedFedrahClasses = [
      "Primary 1 - Olive Treasure",
      "Primary 2 - Olive Peak",
      "Primary 3 - Olive Great",
      "Primary 4 - Olive Vine",
      "Primary 5 - Olive Gold",
    ];
    const expectedRugaClasses = [
      "Primary 4 - Olive Fountain",
      "JSS 1 - Olive Blaze",
    ];
    const sortedNames = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b));
    if (JSON.stringify(sortedNames(fedrahClasses.map((c) => c.name))) !== JSON.stringify(sortedNames(expectedFedrahClasses))) {
      anomalies.push(`Fedrah classes do not match the expected five-class partition`);
    }
    if (JSON.stringify(sortedNames(rugaClasses.map((c) => c.name))) !== JSON.stringify(sortedNames(expectedRugaClasses))) {
      anomalies.push(`Ruga classes do not match the expected two-class partition`);
    }

    // Check 3: Auth & Admin accounts
    const fedrahAdmins = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .filter((q) => q.and(q.eq(q.field("role"), "admin"), q.neq(q.field("isArchived"), true)))
      .collect();

    const rugaAdmins = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.and(q.eq(q.field("role"), "admin"), q.neq(q.field("isArchived"), true)))
      .collect();

    const johnUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), "johnoke2005@gmail.com"))
      .collect();

    if (johnUsers.length > 0) {
      anomalies.push(`johnoke2005@gmail.com still exists in ${johnUsers.length} user records!`);
    }

    const johnPlatformAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", "johnoke2005@gmail.com"))
      .first();
    if (!johnPlatformAdmin?.isActive || !johnPlatformAdmin.authId) {
      anomalies.push("johnoke2005@gmail.com is missing or inactive in platformAdmins");
    }

    const expectedFedrahAdmins = [
      "admin.fedrah@oliveblessed.com",
      "obhischool@gmail.com",
    ];
    const expectedRugaAdmins = ["admin.ruga@oliveblessed.com"];
    if (JSON.stringify(sortedNames(fedrahAdmins.map((a) => a.email.toLowerCase()))) !== JSON.stringify(expectedFedrahAdmins)) {
      anomalies.push("Fedrah active admin membership does not match the expected two accounts");
    }
    if (JSON.stringify(sortedNames(rugaAdmins.map((a) => a.email.toLowerCase()))) !== JSON.stringify(expectedRugaAdmins)) {
      anomalies.push("Ruga active admin membership does not match the expected lead account");
    }

    const fedrahLeadership = await ctx.db
      .query("schoolAdminLeadership")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .collect();
    const rugaLeadership = await ctx.db
      .query("schoolAdminLeadership")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect();
    const fedrahLead = fedrahAdmins.find((admin) => admin.email.toLowerCase() === "obhischool@gmail.com");
    const rugaLead = rugaAdmins.find((admin) => admin.email.toLowerCase() === "admin.ruga@oliveblessed.com");
    if (fedrahLeadership.length !== 1 || !fedrahLead || fedrahLeadership[0]?.leadAdminUserId !== fedrahLead._id) {
      anomalies.push("Fedrah schoolAdminLeadership does not point to obhischool@gmail.com");
    }
    if (rugaLeadership.length !== 1 || !rugaLead || rugaLeadership[0]?.leadAdminUserId !== rugaLead._id) {
      anomalies.push("Ruga schoolAdminLeadership does not point to admin.ruga@oliveblessed.com");
    }

    // Check 4: Knowledge Hub tables
    let remainingKnowledgeCount = 0;
    for (const t of KNOWLEDGE_AI_TABLES) {
      const docs = await (ctx.db.query(t as any) as any).collect();
      if (docs.length > 0) {
        remainingKnowledgeCount += docs.length;
        anomalies.push(`Knowledge/AI table ${t} still contains ${docs.length} documents.`);
      }
    }

    const fedrahStudents = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .collect();

    const rugaStudents = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect();

    const fedrahSubjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .collect();

    const rugaSubjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect();

    const fedrahActiveStudentCount = fedrahStudents.filter((student) => student.isArchived !== true).length;
    const rugaActiveStudentCount = rugaStudents.filter((student) => student.isArchived !== true).length;
    if (fedrahActiveStudentCount !== 36) {
      anomalies.push(`Fedrah active student count is ${fedrahActiveStudentCount}, expected 36`);
    }
    if (rugaActiveStudentCount !== 10) {
      anomalies.push(`Ruga active student count is ${rugaActiveStudentCount}, expected 10`);
    }
    if (fedrahSubjects.length !== 18) {
      anomalies.push(`Fedrah subject count is ${fedrahSubjects.length}, expected 18`);
    }
    if (rugaSubjects.length !== 20) {
      anomalies.push(`Ruga subject count is ${rugaSubjects.length}, expected 20`);
    }

    const rugaStudentPrefix = `student:${rugaId}:`;
    const rugaStudentUsers = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.eq(q.field("role"), "student"))
      .collect();
    const invalidRugaStudentAuthIds = rugaStudentUsers.filter(
      (user) => !user.authId.startsWith(rugaStudentPrefix)
    );
    if (invalidRugaStudentAuthIds.length > 0) {
      anomalies.push(
        `Ruga has ${invalidRugaStudentAuthIds.length} student auth IDs without the required prefix`
      );
    }

    const rugaTeachers = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .collect();
    for (const teacher of rugaTeachers) {
      const assignment = await ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher", (q) => q.eq("teacherId", teacher._id))
        .first();
      const offering = await ctx.db
        .query("classSubjects")
        .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
        .filter((q) => q.eq(q.field("teacherId"), teacher._id))
        .first();
      if (!assignment && !offering) {
        anomalies.push(`Ruga teacher ${teacher._id} is unassigned`);
      }
    }

    return {
      passed: anomalies.length === 0,
      anomalies,
      schoolCount: allSchools.length,
      remainingKnowledgeCount,
      fedrah: {
        id: fedrahId,
        name: fedrahSchool.name,
        slug: fedrahSchool.slug,
        classCount: fedrahClasses.length,
        classes: fedrahClasses.map((c) => c.name),
        studentCount: fedrahStudents.length,
        activeStudentCount: fedrahActiveStudentCount,
        subjectCount: fedrahSubjects.length,
        adminEmails: sortedNames(fedrahAdmins.map((a) => a.email)),
      },
      ruga: {
        id: rugaId,
        name: rugaSchool.name,
        slug: rugaSchool.slug,
        classCount: rugaClasses.length,
        classes: rugaClasses.map((c) => c.name),
        studentCount: rugaStudents.length,
        activeStudentCount: rugaActiveStudentCount,
        subjectCount: rugaSubjects.length,
        adminEmails: sortedNames(rugaAdmins.map((a) => a.email)),
      },
    };
  },
});

async function repointUserReferencesForSchool(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  replacements: Readonly<Record<string, string>>
) {
  if (Object.keys(replacements).length === 0) return;

  for (const tableName of SCHOOL_PURGE_TABLES) {
    if (tableName === "users") continue;
    const rows = await (ctx.db.query(tableName as any) as any)
      .filter((q: any) => q.eq(q.field("schoolId"), schoolId))
      .collect();

    for (const row of rows) {
      const patch: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(row as Record<string, unknown>)) {
        if (field.startsWith("_")) continue;
        if (typeof value === "string" && replacements[value]) {
          patch[field] = replacements[value];
        } else if (Array.isArray(value)) {
          const nextValue = value.map((item) =>
            typeof item === "string" && replacements[item] ? replacements[item] : item
          );
          if (nextValue.some((item, index) => item !== value[index])) {
            patch[field] = nextValue;
          }
        }
      }

      if (Object.keys(patch).length > 0) {
        await (ctx.db.patch as any)(tableName, row._id, patch);
      }
    }
  }
}

export const reconcileConvexUsersInternal = internalMutation({
  args: {
    fedrahLeadAuthId: v.string(),
    fedrahSecondAuthId: v.string(),
    rugaLeadAuthId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const fedrahSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-fedrah"))
      .first();

    const rugaSchool = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "obhis-ruga"))
      .first();

    if (!fedrahSchool || !rugaSchool) {
      throw new ConvexError("Schools not found for admin reconciliation");
    }

    const fedrahId = fedrahSchool._id;
    const rugaId = rugaSchool._id;

    // Step 5.2: Reconcile Fedrah Lead Admin (obhischool@gmail.com)

    let obhiUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .filter((q) => q.eq(q.field("email"), "obhischool@gmail.com"))
      .first();

    if (obhiUser) {
      await ctx.db.patch(obhiUser._id, {
        authId: args.fedrahLeadAuthId,
        name: "Olive Blessed Hands Lead Admin",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        updatedAt: now,
      });
    } else {
      const newId = await ctx.db.insert("users", {
        schoolId: fedrahId,
        authId: args.fedrahLeadAuthId,
        name: "Olive Blessed Hands Lead Admin",
        email: "obhischool@gmail.com",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      obhiUser = await ctx.db.get(newId);
    }

    if (obhiUser) {
      await ctx.runMutation(
        internal.functions.academic.adminLeadershipHelpers.ensureSchoolLeadAdminInternal,
        {
          schoolId: fedrahId,
          leadAdminUserId: obhiUser._id,
          updatedBy: obhiUser._id,
        }
      );
    }

    // Step 5.3: Provision Fedrah Second Admin (admin.fedrah@oliveblessed.com)
    let fedrahSecondUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .filter((q) => q.eq(q.field("email"), "admin.fedrah@oliveblessed.com"))
      .first();

    if (fedrahSecondUser) {
      await ctx.db.patch(fedrahSecondUser._id, {
        authId: args.fedrahSecondAuthId,
        name: "Fedrah Admin",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("users", {
        schoolId: fedrahId,
        authId: args.fedrahSecondAuthId,
        name: "Fedrah Admin",
        email: "admin.fedrah@oliveblessed.com",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Step 5.4: Provision Ruga Lead Admin (admin.ruga@oliveblessed.com)
    let rugaAdminUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.eq(q.field("email"), "admin.ruga@oliveblessed.com"))
      .first();

    if (rugaAdminUser) {
      await ctx.db.patch(rugaAdminUser._id, {
        authId: args.rugaLeadAuthId,
        name: "Ruga Admin",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        updatedAt: now,
      });
    } else {
      const newId = await ctx.db.insert("users", {
        schoolId: rugaId,
        authId: args.rugaLeadAuthId,
        name: "Ruga Admin",
        email: "admin.ruga@oliveblessed.com",
        role: "admin",
        isSchoolAdmin: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      rugaAdminUser = await ctx.db.get(newId);
    }

    if (rugaAdminUser) {
      await ctx.runMutation(
        internal.functions.academic.adminLeadershipHelpers.ensureSchoolLeadAdminInternal,
        {
          schoolId: rugaId,
          leadAdminUserId: rugaAdminUser._id,
          updatedBy: rugaAdminUser._id,
        }
      );
    }

    if (!obhiUser || !rugaAdminUser) {
      throw new ConvexError("Failed to materialize the retained branch admin users");
    }

    // Remove every duplicated/source admin from the retained partitions after
    // replacing its references with the canonical branch admin. This keeps
    // John in Better Auth and platformAdmins while removing only school users.
    const fedrahAllowedAdminEmails = new Set([
      "obhischool@gmail.com",
      "admin.fedrah@oliveblessed.com",
    ]);
    const fedrahUsersToRemove = (await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", fedrahId))
      .collect()).filter(
        (user) =>
          user._id !== obhiUser._id &&
          (user.email.toLowerCase() === "johnoke2005@gmail.com" ||
            (user.role === "admin" &&
              !fedrahAllowedAdminEmails.has(user.email.toLowerCase())))
      );

    const rugaUsersToRemove = (await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect()).filter(
        (user) =>
          user._id !== rugaAdminUser._id &&
          (user.email.toLowerCase() === "johnoke2005@gmail.com" || user.role === "admin")
      );

    const fedrahReplacements: Record<string, string> = {};
    for (const user of fedrahUsersToRemove) {
      fedrahReplacements[user._id] = obhiUser._id;
    }

    const rugaReplacements: Record<string, string> = {};
    for (const user of rugaUsersToRemove) {
      rugaReplacements[user._id] = rugaAdminUser._id;
    }

    await repointUserReferencesForSchool(ctx, fedrahId, fedrahReplacements);
    await repointUserReferencesForSchool(ctx, rugaId, rugaReplacements);

    for (const user of [...fedrahUsersToRemove, ...rugaUsersToRemove]) {
      await ctx.db.delete(user._id);
    }

    // Step 5.5: Reconcile Ruga Payment Providers to reference Ruga Payment Provider Secrets
    const rugaProviders = await ctx.db
      .query("schoolPaymentProviders")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect();

    const rugaSecrets = await ctx.db
      .query("schoolPaymentProviderSecrets")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .collect();

    for (const prov of rugaProviders) {
      const matchingSecret = rugaSecrets.find(
        (s) => s.mode === prov.mode && s.provider === prov.provider
      );
      if (matchingSecret) {
        await ctx.db.patch(prov._id, {
          activeSecretId: prov.activeSecretId ? matchingSecret._id : null,
          pendingSecretId: prov.pendingSecretId ? matchingSecret._id : null,
          updatedAt: now,
        });
      }
    }

    // Step 5.6: Reconcile Ruga Student User authId prefixes
    const rugaStudentUsers = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.eq(q.field("role"), "student"))
      .collect();

    for (const su of rugaStudentUsers) {
      const requiredPrefix = `student:${rugaId}:`;
      const sourcePrefix = `student:${fedrahId}:`;
      let nextAuthId = su.authId;

      if (su.authId.startsWith(sourcePrefix)) {
        nextAuthId = `${requiredPrefix}${su.authId.slice(sourcePrefix.length)}`;
      } else if (!su.authId.startsWith(requiredPrefix)) {
        const suffix = su.authId.startsWith("student:")
          ? su.authId.slice("student:".length)
          : su.authId;
        nextAuthId = `${requiredPrefix}${suffix}`;
      }

      if (nextAuthId !== su.authId) {
        await ctx.db.patch(su._id, {
          authId: nextAuthId,
          updatedAt: now,
        });
      }
    }

    return { success: true };
  },
});

export const syncPlatformAdminAuthIdInternal = internalMutation({
  args: {
    email: v.string(),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        authId: args.authId,
        isActive: true,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("platformAdmins", {
        email: args.email,
        authId: args.authId,
        name: "Supreme Leader Oluleke-Oke John",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
