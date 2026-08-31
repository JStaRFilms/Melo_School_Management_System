import { internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";

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

export const TABLES_WITHOUT_BY_SCHOOL_INDEX = new Set([

  "schoolApprovalEvidence",
  "schoolDomains",
  "schoolSiteAssets",
  "schoolSiteRevisions",
  "schoolSiteAuditEvents",
]);

// Foreign key remapping definitions per table

const FK_DEFINITIONS: Record<string, Array<{ field: string; targetTable: string; isArray?: boolean }>> = {
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

/**
 * 2. Batched Duplication
 */
export const duplicateBatch = internalMutation({
  args: {
    stateId: v.id("migrationState"),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db.get(args.stateId);
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
      await ctx.db.patch(args.stateId, {
        cursor: page.continueCursor,
        idMaps: JSON.stringify(idMaps),
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.functions.academic.branchSplitV2.duplicateBatch, {
        stateId: args.stateId,
      });
      return { done: false, currentTable, progress: "in_progress" };
    }

    // Current table completed!
    const completed = [...state.tablesCompleted, currentTable];
    const nextTableIndex = ALL_DUPLICATION_TABLES.indexOf(currentTable) + 1;

    if (nextTableIndex < ALL_DUPLICATION_TABLES.length) {
      const nextTable = ALL_DUPLICATION_TABLES[nextTableIndex];
      await ctx.db.patch(args.stateId, {
        currentTable: nextTable,
        cursor: undefined,
        idMaps: JSON.stringify(idMaps),
        tablesCompleted: completed,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.functions.academic.branchSplitV2.duplicateBatch, {
        stateId: args.stateId,
      });
      return { done: false, currentTable: nextTable, progress: "next_table" };
    }

    // All duplication finished!
    await ctx.db.patch(args.stateId, {
      phase: "duplication_completed",
      status: "completed",
      cursor: undefined,
      idMaps: JSON.stringify(idMaps),
      tablesCompleted: completed,
      updatedAt: Date.now(),
    });

    return { done: true, tablesCompletedCount: completed.length };
  },
});

/**
 * 3. Cascade Delete Wrong-Branch Data (1 class per invocation to guarantee small transactions)
 */
export const cascadeDeleteWrongBranchData = internalMutation({
  args: {
    target: v.union(v.literal("ruga"), v.literal("fedrah")),
  },
  handler: async (ctx, args) => {
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

    const schoolId = args.target === "ruga" ? rugaSchool._id : fedrahSchool._id;

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
      return args.target === "ruga" ? !isRugaClass : isRugaClass;
    });

    if (classesToDelete.length === 0) {
      return { done: true, target: args.target, remainingClasses: 0 };
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

    // Schedule next class deletion if more remain
    const remainingCount = classesToDelete.length - 1;
    if (remainingCount > 0) {
      await ctx.scheduler.runAfter(0, internal.functions.academic.branchSplitV2.cascadeDeleteWrongBranchData, {
        target: args.target,
      });
    }

    return {
      done: remainingCount === 0,
      target: args.target,
      deletedClass: cls.name,
      remainingClasses: remainingCount,
    };
  },
});


/**
 * 4. Wipe Knowledge Hub & AI Content (Both Schools)
 */
export const wipeKnowledgeHubAndAi = internalMutation({
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

    const schoolIds: Array<Id<"schools">> = [];
    if (fedrahSchool) schoolIds.push(fedrahSchool._id);
    if (rugaSchool) schoolIds.push(rugaSchool._id);

    let totalDeleted = 0;
    for (const tableName of KNOWLEDGE_AI_TABLES) {
      for (const sId of schoolIds) {
        let docs = await (ctx.db.query(tableName as any) as any)
          .filter((q: any) => q.eq(q.field("schoolId"), sId))
          .take(100);

        while (docs.length > 0) {
          for (const doc of docs) {
            await ctx.db.delete(doc._id);
            totalDeleted++;
          }
          docs = await (ctx.db.query(tableName as any) as any)
            .filter((q: any) => q.eq(q.field("schoolId"), sId))
            .take(100);
        }
      }
    }

    return { totalDeleted };
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

/**
 * 6. Split Integrity Check Query
 */
export const runSplitIntegrityCheck = internalQuery({
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
      return {
        passed: false,
        error: "One or both schools not found (expected 'obhis-fedrah' and 'obhis-ruga')",
      };
    }

    const fedrahId = fedrahSchool._id;
    const rugaId = rugaSchool._id;

    const anomalies: string[] = [];

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
    }

    const allPaymentProviders = await ctx.db.query("schoolPaymentProviders").collect();
    for (const p of allPaymentProviders) {
      if (p.activeSecretId) {
        const sec = await ctx.db.get(p.activeSecretId);
        if (sec && sec.schoolId !== p.schoolId) {
          anomalies.push(`PaymentProvider ${p._id} schoolId (${p.schoolId}) !== activeSecret.schoolId (${sec.schoolId})`);
        }
      }
      if (p.pendingSecretId) {
        const sec = await ctx.db.get(p.pendingSecretId);
        if (sec && sec.schoolId !== p.schoolId) {
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

    const fedrahViolations = fedrahClasses.filter(
      (c) => c.name.includes("Olive Fountain") || c.name.includes("Olive Blaze")
    );
    if (fedrahViolations.length > 0) {
      anomalies.push(`Fedrah still contains Ruga classes: ${fedrahViolations.map((c) => c.name).join(", ")}`);
    }

    const rugaViolations = rugaClasses.filter(
      (c) => !c.name.includes("Olive Fountain") && !c.name.includes("Olive Blaze")
    );
    if (rugaViolations.length > 0) {
      anomalies.push(`Ruga contains non-Ruga classes: ${rugaViolations.map((c) => c.name).join(", ")}`);
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

    // Check 4: Knowledge Hub tables
    let remainingKnowledgeCount = 0;
    for (const t of KNOWLEDGE_AI_TABLES) {
      const docs = await (ctx.db.query(t as any) as any)
        .filter((q: any) =>
          q.or(q.eq(q.field("schoolId"), fedrahId), q.eq(q.field("schoolId"), rugaId))
        )
        .take(10);
      if (docs.length > 0) {
        remainingKnowledgeCount += docs.length;
        anomalies.push(`Knowledge table ${t} still contains ${docs.length} documents for branches.`);
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

    return {
      passed: anomalies.length === 0,
      anomalies,
      fedrah: {
        id: fedrahId,
        name: fedrahSchool.name,
        slug: fedrahSchool.slug,
        classCount: fedrahClasses.length,
        classes: fedrahClasses.map((c) => c.name),
        studentCount: fedrahStudents.length,
        subjectCount: fedrahSubjects.length,
        adminEmails: fedrahAdmins.map((a) => a.email),
      },
      ruga: {
        id: rugaId,
        name: rugaSchool.name,
        slug: rugaSchool.slug,
        classCount: rugaClasses.length,
        classes: rugaClasses.map((c) => c.name),
        studentCount: rugaStudents.length,
        subjectCount: rugaSubjects.length,
        adminEmails: rugaAdmins.map((a) => a.email),
      },
    };
  },
});

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

    // Hard delete johnoke2005@gmail.com in Convex users across ALL schools
    const johnUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), "johnoke2005@gmail.com"))
      .collect();
    for (const j of johnUsers) {
      await ctx.db.delete(j._id);
    }

    // Step 5.2: Reconcile Fedrah Lead Admin (obhischool@gmail.com)
    // Remove obhischool@gmail.com from Ruga if duplicated there
    const rugaObhis = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.eq(q.field("email"), "obhischool@gmail.com"))
      .collect();
    for (const ro of rugaObhis) {
      await ctx.db.delete(ro._id);
    }

    // Remove any extra admin from Ruga like essienaniefiok31@gmail.com if duplicated
    const rugaEssien = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", rugaId))
      .filter((q) => q.eq(q.field("email"), "essienaniefiok31@gmail.com"))
      .collect();
    for (const re of rugaEssien) {
      await ctx.db.delete(re._id);
    }

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
      if (su.authId && su.authId.includes(fedrahId)) {
        const nextAuthId = su.authId.replace(fedrahId, rugaId);
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



