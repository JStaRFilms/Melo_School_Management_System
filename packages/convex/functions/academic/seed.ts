import { internalMutation, internalQuery } from "../../_generated/server";
import type { MutationCtx } from "../../_generated/server";
import type { Id, TableNames } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import {
  DEMO_BANDS,
  DEMO_CLASSES,
  DEMO_CREATED_AT,
  DEMO_EVENTS,
  DEMO_SCHOOL_SLUG,
  DEMO_STUDENTS,
  DEMO_SUBJECTS,
  getSchoolSeedProfile,
  type SchoolSeedProfileKey,
  scoreFor,
} from "./demoData";
import { populateJudgeCurriculumFixture } from "./judgeCurriculumSeed";
import { populateJudgeLessonFixture } from "./judgeLessonSeed";
import { ADMISSIONS_PERMISSIONS_V1 } from "@school/shared";
import { digest } from "../admissions/helpers";

const DAY = 24 * 60 * 60 * 1000;
const timestamp = (date: string) => Date.parse(`${date}T09:00:00.000Z`);
const seedProfileValidator = v.union(v.literal("demo"), v.literal("judge"));
const profileKey = (value?: SchoolSeedProfileKey): SchoolSeedProfileKey => value ?? "demo";

// Every table here is school-scoped and has a by_school index. Deliberately omit
// Better Auth component tables and platformAdmins: a demo reset must never erase
// identities or platform-wide data belonging to another workflow.
// Children deliberately precede their parents. Every entry has an actual
// `by_school` schema index (including rateLimitCounters); auth component and
// platform tables are never part of a tenant reset.
const DEMO_SCHOOL_TABLES = [
  "demoSeedRuns", "contentAuditEvents", "aiRunLogs", "rateLimitCounters",
  "assessmentBankItems", "assessmentBanks", "assessmentGenerationProfiles",
  "instructionArtifactSources", "instructionArtifactRevisions", "instructionArtifactDocuments", "instructionArtifacts", "instructionTemplates",
  "curriculumUnits", "curriculumImports",
  "knowledgeOcrJobs", "knowledgeMaterialChunks", "knowledgeMaterialClassBindings", "knowledgeMaterials", "knowledgeTopics",
  "paymentAllocations", "billingPaymentAttempts", "paymentGatewayEvents", "billingPayments", "studentInvoices", "feePlanApplications", "feePlans", "schoolPaymentProviderSecrets", "schoolPaymentProviders", "schoolBillingSettings",
  "reportCardManualAdjustmentEvents", "reportCardManualAdjustments", "reportCardExtraStudentValues", "reportCardExtraClassAssignments", "reportCardExtraBundles", "reportCardExtraScaleTemplates", "reportCardComments", "reportCardAttendanceStudentValues", "reportCardAttendanceClassValues", "reportCardTermSettingGroups",
  "assessmentRecords", "historicalTermTotals", "assessmentEditingPolicies", "schoolAssessmentSettings", "gradingBands",
  "studentSubjectAggregationOptOuts", "studentSubjectSelections", "studentPromotions", "classSubjectAggregationComponents", "classSubjectAggregations", "teacherAssignments", "classSubjects",
  "academicTimelineAuditEvents", "academicTerms", "academicSessions", "schoolEvents",
  "familyMembers", "students", "schoolAdminLeadership", "classes", "families", "users", "subjects",
] as const satisfies readonly TableNames[];

function gradeFor(total: number) {
  return DEMO_BANDS.find((band) => total >= band.minScore && total <= band.maxScore) ?? DEMO_BANDS[0];
}

function storageIdsOnRow(row: object): Id<"_storage">[] {
  const candidate = row as Record<string, unknown>;
  const singular = ["photoStorageId", "logoStorageId", "storageId"].flatMap((key) =>
    typeof candidate[key] === "string" ? [candidate[key] as Id<"_storage">] : []
  );
  const portraits = Array.isArray(candidate.portraitStorageIds)
    ? candidate.portraitStorageIds.filter((value): value is string => typeof value === "string").map((value) => value as Id<"_storage">)
    : [];
  return [...singular, ...portraits];
}

/**
 * Deletes one bounded batch. The public runner repeatedly invokes this mutation,
 * so a stale or unusually large demo tenant cannot exceed a transaction limit.
 */
export const inspectDemoAuthUsageInternal = internalQuery({
  args: { authIds: v.array(v.string()), emails: v.array(v.string()), seedProfile: v.optional(seedProfileValidator) },
  returns: v.object({ conflicts: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const profile = getSchoolSeedProfile(profileKey(args.seedProfile));
    const conflicts = new Set<string>();
    for (const authId of args.authIds) {
      const user = await ctx.db.query("users").withIndex("by_auth", (q) => q.eq("authId", authId)).unique();
      if (user) {
        const school = await ctx.db.get(user.schoolId);
        if (school?.slug !== profile.schoolSlug) conflicts.add(`auth id ${authId} is linked to ${school?.slug ?? "a missing school"}`);
      }
      const platformAdmin = await ctx.db.query("platformAdmins").withIndex("by_auth", (q) => q.eq("authId", authId)).unique();
      if (platformAdmin) conflicts.add(`auth id ${authId} is linked to a platform admin`);
    }
    for (const email of args.emails) {
      const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
      if (user) {
        const school = await ctx.db.get(user.schoolId);
        if (school?.slug !== profile.schoolSlug) conflicts.add(`email ${email} is linked to ${school?.slug ?? "a missing school"}`);
      }
      const platformAdmin = await ctx.db.query("platformAdmins").withIndex("by_email", (q) => q.eq("email", email)).unique();
      if (platformAdmin) conflicts.add(`email ${email} is linked to a platform admin`);
    }
    return { conflicts: [...conflicts] };
  },
});

export const getPendingDemoStorageCleanupInternal = internalQuery({
  args: { seedProfile: v.optional(seedProfileValidator) },
  returns: v.array(v.id("_storage")),
  handler: async (ctx, args) => {
    const profile = getSchoolSeedProfile(profileKey(args.seedProfile));
    const rows = await ctx.db.query("demoSeedStorageCleanup").withIndex("by_school_slug", (q) => q.eq("schoolSlug", profile.schoolSlug)).take(75);
    return [...new Set(rows.map((row) => String(row.storageId)))].map((storageId) => storageId as Id<"_storage">);
  },
});

export const acknowledgeDemoStorageCleanupInternal = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const storageId of new Set(args.storageIds.map(String))) {
      const cleanupRows = ctx.db
        .query("demoSeedStorageCleanup")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId as Id<"_storage">));
      for await (const cleanup of cleanupRows) {
        await ctx.db.delete(cleanup._id);
      }
    }
    return null;
  },
});

async function recordStorageCleanup(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  schoolSlug: string,
  storageIds: Id<"_storage">[]
) {
  for (const storageId of new Set(storageIds.map(String))) {
    const existing = await ctx.db
      .query("demoSeedStorageCleanup")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId as Id<"_storage">))
      .first();
    if (!existing) {
      await ctx.db.insert("demoSeedStorageCleanup", {
        schoolId,
        schoolSlug,
        storageId: storageId as Id<"_storage">,
        createdAt: Date.now(),
      });
    }
  }
}

export const clearDemoSchoolBatchInternal = internalMutation({
  args: { seedProfile: v.optional(seedProfileValidator) },
  returns: v.object({
    complete: v.boolean(),
    deletedCount: v.number(),
    storageIds: v.array(v.id("_storage")),
  }),
  handler: async (ctx, args) => {
    const profile = getSchoolSeedProfile(profileKey(args.seedProfile));
    const school = await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", profile.schoolSlug))
      .unique();
    if (!school) return { complete: true, deletedCount: 0, storageIds: [] };

    for (const tableName of DEMO_SCHOOL_TABLES) {
      const rows = await ctx.db
        .query(tableName)
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .take(75);
      if (rows.length === 0) continue;

      const storageIds: Id<"_storage">[] = [];
      for (const row of rows) {
        storageIds.push(...storageIdsOnRow(row));
        await ctx.db.delete(row._id);
      }
      await recordStorageCleanup(ctx, school._id, profile.schoolSlug, storageIds);
      return { complete: false, deletedCount: rows.length, storageIds };
    }

    const storageIds = school.logoStorageId ? [school.logoStorageId] : [];
    await recordStorageCleanup(ctx, school._id, profile.schoolSlug, storageIds);
    await ctx.db.delete(school._id);
    return { complete: true, deletedCount: 1, storageIds };
  },
});


type SeedRunContext = {
  schoolId: Id<"schools">;
  adminUserId: Id<"users">;
  teacherIds: Id<"users">[];
  portalUserId: Id<"users">;
  sessionId: Id<"academicSessions">;
  termIds: Id<"academicTerms">[];
  classIds: Id<"classes">[];
  subjectIds: Id<"subjects">[];
  familyIds: Id<"families">[];
};

const runPhaseValidator = v.union(
  v.literal("foundation"), v.literal("students"), v.literal("assessments"),
  v.literal("billing"), v.literal("knowledge"), v.literal("complete"),
);

async function requireRun(ctx: MutationCtx, runId: Id<"demoSeedRuns">) {
  const run = await ctx.db.get(runId);
  if (!run || run.status !== "running") throw new ConvexError("Demo seed run is not active.");
  return run;
}

async function loadContext(ctx: MutationCtx, runId: Id<"demoSeedRuns">): Promise<SeedRunContext> {
  const run = await requireRun(ctx, runId);
  const profile = getSchoolSeedProfile(profileKey(run.seedProfile));
  const schoolId = run.schoolId;
  const users = await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(80);
  const byEmail = new Map(users.map((user) => [user.email, user]));
  const adminUserId = byEmail.get(profile.accounts.admin.email)?._id;
  const teacherIds = [profile.accounts.teacher.email, ...profile.extraTeachers.map((teacher) => teacher.email)]
    .map((email) => byEmail.get(email)?._id);
  const portalUserId = byEmail.get(profile.accounts.portal.email)?._id;
  const sessionId = (await ctx.db.query("academicSessions").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2))[0]?._id;
  const termIds = await ctx.db.query("academicTerms").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(5).then((rows) => rows.map((row) => row._id));
  const classIds = await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(10).then((rows) => rows.map((row) => row._id));
  const subjectIds = await ctx.db.query("subjects").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(10).then((rows) => rows.map((row) => row._id));
  const familyIds = await ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(30).then((rows) => rows.map((row) => row._id));
  if (!adminUserId || teacherIds.some((id) => !id) || !portalUserId || !sessionId || termIds.length !== 3 || classIds.length !== profile.classes.length || subjectIds.length !== profile.subjects.length || familyIds.length !== 18) {
    throw new ConvexError("Demo seed foundation is incomplete; reset and retry the run.");
  }
  return { schoolId, adminUserId, teacherIds: teacherIds as Id<"users">[], portalUserId, sessionId, termIds, classIds, subjectIds, familyIds };
}

function updateRunPhase(ctx: MutationCtx, runId: Id<"demoSeedRuns">, phase: "students" | "assessments" | "billing" | "knowledge" | "complete", cursor?: Partial<Pick<{ studentCursor: number; assessmentCursor: number; billingCursor: number }, "studentCursor" | "assessmentCursor" | "billingCursor">>) {
  return ctx.db.patch(runId, { phase, ...(cursor ?? {}), updatedAt: Date.now() });
}

export const startDemoSeedRunInternal = internalMutation({
  args: { seedProfile: v.optional(seedProfileValidator), adminAuthId: v.string(), teacherAuthId: v.string(), portalAuthId: v.string(), logoStorageId: v.id("_storage"), portraitStorageIds: v.array(v.id("_storage")) },
  returns: v.id("demoSeedRuns"),
  handler: async (ctx, args) => {
    const profile = getSchoolSeedProfile(profileKey(args.seedProfile));
    if (args.portraitStorageIds.length !== profile.students.length) throw new ConvexError(`Expected ${profile.students.length} portrait PNG assets.`);
    const existing = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", profile.schoolSlug)).unique();
    if (existing) throw new ConvexError(`${profile.schoolSlug} must be reset before a new seed run starts.`);
    const schoolId = await ctx.db.insert("schools", { name: profile.schoolName, slug: profile.schoolSlug, status: "active", logoStorageId: args.logoStorageId, logoFileName: `${profile.schoolSlug}-crest.png`, logoContentType: "image/png", logoUpdatedAt: profile.createdAt, createdAt: profile.createdAt, updatedAt: profile.createdAt });
    return await ctx.db.insert("demoSeedRuns", { schoolId, status: "running", phase: "foundation", studentCursor: 0, assessmentCursor: 0, billingCursor: 0, ...args, seedProfile: profile.key, createdAt: Date.now(), updatedAt: Date.now() });
  },
});

export const populateDemoFoundationInternal = internalMutation({
  args: { runId: v.id("demoSeedRuns") }, returns: runPhaseValidator,
  handler: async (ctx, { runId }) => {
    const run = await requireRun(ctx, runId);
    if (run.phase !== "foundation") return run.phase;
    const profile = getSchoolSeedProfile(profileKey(run.seedProfile));
    const now = profile.createdAt; const schoolId = run.schoolId;
    const [adminFirstName, adminLastName] = profile.accounts.admin.name.split(" ");
    const [teacherFirstName, teacherLastName] = profile.accounts.teacher.name.split(" ");
    const [portalFirstName, portalLastName] = profile.accounts.portal.name.split(" ");
    const adminUserId = await ctx.db.insert("users", { schoolId, authId: run.adminAuthId, name: profile.accounts.admin.name, firstName: adminFirstName, lastName: adminLastName, email: profile.accounts.admin.email, role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    const teacherUserId = await ctx.db.insert("users", { schoolId, authId: run.teacherAuthId, name: profile.accounts.teacher.name, firstName: teacherFirstName, lastName: teacherLastName, email: profile.accounts.teacher.email, role: "teacher", createdAt: now, updatedAt: now });
    const extraTeacherIds: Id<"users">[] = [];
    for (let index = 0; index < profile.extraTeachers.length; index += 1) { const teacher = profile.extraTeachers[index]; const [firstName, lastName] = teacher.name.split(" "); extraTeacherIds.push(await ctx.db.insert("users", { schoolId, authId: `${profile.authPrefix}-teacher-${index + 2}`, name: teacher.name, firstName, lastName, email: teacher.email, role: "teacher", createdAt: now, updatedAt: now })); }
    const portalUserId = await ctx.db.insert("users", { schoolId, authId: run.portalAuthId, name: profile.accounts.portal.name, firstName: portalFirstName, lastName: portalLastName, email: profile.accounts.portal.email, role: "parent", createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolAdminLeadership", { schoolId, leadAdminUserId: adminUserId, createdAt: now, updatedAt: now, updatedBy: adminUserId });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025/2026", startDate: timestamp("2025-09-01"), endDate: timestamp("2026-07-31"), isActive: true, createdAt: now, updatedAt: now });
    const termIds: Id<"academicTerms">[] = [];
    for (const [name, startDate, endDate, active] of [["First Term", "2025-09-01", "2025-12-19", false], ["Second Term", "2026-01-12", "2026-03-27", false], ["Third Term", "2026-04-13", "2026-07-24", true]] as const) termIds.push(await ctx.db.insert("academicTerms", { schoolId, sessionId, name, startDate: timestamp(startDate), endDate: timestamp(endDate), nextTermBegins: active ? timestamp("2026-09-07") : undefined, defaultTimesSchoolOpened: 62, reportCardCalculationMode: "cumulative_annual", isActive: active, createdAt: now, updatedAt: now }));
    const teachers = [teacherUserId, ...extraTeacherIds]; const classIds: Id<"classes">[] = [];
    for (let index = 0; index < profile.classes.length; index += 1) classIds.push(await ctx.db.insert("classes", { schoolId, ...profile.classes[index], formTeacherId: teachers[index], isArchived: false, createdAt: now, updatedAt: now }));
    const subjectIds: Id<"subjects">[] = [];
    for (const [name, code] of profile.subjects) subjectIds.push(await ctx.db.insert("subjects", { schoolId, name, code, isArchived: false, createdAt: now, updatedAt: now }));
    for (let classIndex = 0; classIndex < classIds.length; classIndex += 1) for (let subjectIndex = 0; subjectIndex < subjectIds.length; subjectIndex += 1) { const teacherId = teachers[(classIndex + subjectIndex) % teachers.length]; await ctx.db.insert("classSubjects", { schoolId, classId: classIds[classIndex], subjectId: subjectIds[subjectIndex], teacherId, createdAt: now, updatedAt: now }); await ctx.db.insert("teacherAssignments", { schoolId, teacherId, classId: classIds[classIndex], subjectId: subjectIds[subjectIndex], createdAt: now, updatedAt: now }); }
    for (let familyIndex = 0; familyIndex < 18; familyIndex += 1) { const parentId = familyIndex === 0 ? portalUserId : await ctx.db.insert("users", { schoolId, authId: `${profile.authPrefix}-parent-${familyIndex + 1}`, name: `Parent ${familyIndex + 1} ${profile.familyLabel}`, email: `family${familyIndex + 1}@${profile.schoolSlug}.school`, role: "parent", createdAt: now, updatedAt: now }); const familyId = await ctx.db.insert("families", { schoolId, name: familyIndex === 0 ? profile.portalFamilyName : `${profile.familyLabel} Family ${String(familyIndex + 1).padStart(2, "0")}`, createdAt: now, updatedAt: now, createdBy: adminUserId, updatedBy: adminUserId }); await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, relationship: familyIndex % 2 === 0 ? "Mother" : "Father", isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: adminUserId, updatedBy: adminUserId }); }
    await ctx.db.insert("schoolAssessmentSettings", { schoolId, examInputMode: "raw40", ca1Max: 20, ca2Max: 20, ca3Max: 20, examContributionMax: 40, isActive: true, createdAt: now, updatedAt: now, updatedBy: adminUserId });
    for (const band of profile.bands) await ctx.db.insert("gradingBands", { schoolId, ...band, isActive: true, createdAt: now, updatedAt: now, updatedBy: adminUserId });
    await ctx.db.insert("assessmentEditingPolicies", { schoolId, sessionId, termId: termIds[2], editingWindowEnabled: false, finalizationEnabled: false, createdAt: now, updatedAt: now, updatedBy: adminUserId });
    const scaleTemplateId = await ctx.db.insert("reportCardExtraScaleTemplates", { schoolId, name: "Learning Disposition", description: "Teacher observation scale", options: [{ id: "excellent", label: "Excellent", order: 0 }, { id: "secure", label: "Secure", order: 1 }, { id: "developing", label: "Developing", order: 2 }], createdAt: now, createdBy: adminUserId, updatedAt: now, updatedBy: adminUserId });
    const bundleId = await ctx.db.insert("reportCardExtraBundles", { schoolId, name: "Whole Child Snapshot", description: "Attendance and enrichment commentary", sections: [{ id: "learning-habits", label: "Learning Habits", order: 0, fields: [{ id: "collaboration", label: "Collaboration", type: "scale", scaleTemplateId, printable: true, source: "teacher_manual", order: 0 }, { id: "club-note", label: "Club contribution", type: "text", printable: true, source: "teacher_manual", order: 1 }] }], createdAt: now, createdBy: adminUserId, updatedAt: now, updatedBy: adminUserId });
    for (const classId of classIds) { await ctx.db.insert("reportCardExtraClassAssignments", { schoolId, classId, bundleId, order: 0, createdAt: now, assignedBy: adminUserId, updatedAt: now, updatedBy: adminUserId }); await ctx.db.insert("reportCardAttendanceClassValues", { schoolId, classId, sessionId, termId: termIds[2], timesSchoolOpened: 62, createdAt: now, updatedAt: now, updatedBy: adminUserId }); }
    await ctx.db.insert("schoolBillingSettings", { schoolId, invoicePrefix: profile.schoolCode, defaultCurrency: "NGN", defaultDueDays: 30, preferredProvider: "manual", paymentProviderMode: "test", allowManualPayments: true, allowOnlinePayments: false, createdAt: now, updatedAt: now, updatedBy: adminUserId });
    for (let classIndex = 0; classIndex < classIds.length; classIndex += 1) { const feePlanId = await ctx.db.insert("feePlans", { schoolId, name: `${profile.classes[classIndex].gradeName} Third Term Fees`, description: "Tuition, learning resources, and activities", currency: "NGN", billingMode: "class_default", targetClassIds: [classIds[classIndex]], lineItems: [{ id: "tuition", label: "Tuition", amount: 85000, category: "tuition", order: 0 }, { id: "learning", label: "Learning resources", amount: 12000, category: "activity", order: 1 }, { id: "assessment", label: "Assessment", amount: 5000, category: "exam", order: 2 }], installmentPolicy: { enabled: true, installmentCount: 2, intervalDays: 30, firstDueDays: 14 }, isActive: true, createdAt: now, updatedAt: now, createdBy: adminUserId, updatedBy: adminUserId }); await ctx.db.insert("feePlanApplications", { schoolId, feePlanId, classId: classIds[classIndex], sessionId, termId: termIds[2], studentCount: 12, createdInvoiceCount: 12, skippedInvoiceCount: 0, notes: `Deterministic ${profile.familyLabel.toLowerCase()} application`, createdAt: now, updatedAt: now, createdBy: adminUserId }); }
    for (const [title, description, location, date] of profile.events) await ctx.db.insert("schoolEvents", { schoolId, title, description, location, startDate: timestamp(date), endDate: timestamp(date) + DAY, isAllDay: true, isArchived: false, createdAt: now, updatedAt: now, updatedBy: adminUserId });
    await updateRunPhase(ctx, runId, "students", { studentCursor: 0 }); return "students";
  },
});

export const populateDemoStudentsBatchInternal = internalMutation({
  args: { runId: v.id("demoSeedRuns") }, returns: v.object({ phase: runPhaseValidator, cursor: v.number() }),
  handler: async (ctx, { runId }) => {
    const run = await requireRun(ctx, runId); if (run.phase !== "students") return { phase: run.phase, cursor: run.studentCursor };
    const profile = getSchoolSeedProfile(profileKey(run.seedProfile)); const data = await loadContext(ctx, runId); const end = Math.min(run.studentCursor + 12, profile.students.length); const now = profile.createdAt;
    for (let index = run.studentCursor; index < end; index += 1) { const student = profile.students[index]; const [firstName, lastName] = student.name.split(" "); const userId = await ctx.db.insert("users", { schoolId: data.schoolId, authId: `${profile.authPrefix}-student-${student.admissionNumber}`, name: student.name, firstName, lastName, email: student.email, role: "student", createdAt: now, updatedAt: now }); const studentId = await ctx.db.insert("students", { schoolId: data.schoolId, classId: data.classIds[student.classIndex], userId, familyId: data.familyIds[student.familyIndex], admissionNumber: student.admissionNumber, houseName: ["Courage", "Unity", "Integrity", "Discovery"][index % 4], gender: student.gender, dateOfBirth: timestamp(`201${index % 4 + 1}-0${index % 8 + 1}-15`), guardianName: student.familyIndex === 0 ? profile.accounts.portal.name : `Parent ${student.familyIndex + 1} ${profile.familyLabel}`, guardianPhone: `+234 800 555 ${String(1000 + index)}`, address: `${index + 1} Learning Lane, ${profile.cityName}`, photoStorageId: run.portraitStorageIds[index], photoFileName: `portrait-${String(index + 1).padStart(2, "0")}.png`, photoContentType: "image/png", photoUpdatedAt: now, isArchived: false, createdAt: now, updatedAt: now }); for (const subjectId of data.subjectIds) await ctx.db.insert("studentSubjectSelections", { schoolId: data.schoolId, studentId, classId: data.classIds[student.classIndex], subjectId, sessionId: data.sessionId, createdAt: now, updatedAt: now }); }
    const phase: "students" | "assessments" = end === profile.students.length ? "assessments" : "students"; await updateRunPhase(ctx, runId, phase, { studentCursor: end, assessmentCursor: phase === "assessments" ? 0 : run.assessmentCursor }); return { phase, cursor: end };
  },
});

export const populateDemoAssessmentsBatchInternal = internalMutation({
  args: { runId: v.id("demoSeedRuns") }, returns: v.object({ phase: runPhaseValidator, cursor: v.number() }),
  handler: async (ctx, { runId }) => {
    const run = await requireRun(ctx, runId); if (run.phase !== "assessments") return { phase: run.phase, cursor: run.assessmentCursor };
    const profile = getSchoolSeedProfile(profileKey(run.seedProfile)); const data = await loadContext(ctx, runId); const students = await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(50); const bundleId = (await ctx.db.query("reportCardExtraBundles").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(2))[0]?._id; if (!bundleId) throw new ConvexError("Missing report card bundle."); const end = Math.min(run.assessmentCursor + 6, students.length); const now = profile.createdAt;
    for (let index = run.assessmentCursor; index < end; index += 1) { const studentId = students[index]._id; const classId = data.classIds[profile.students[index].classIndex]; for (let subjectIndex = 0; subjectIndex < data.subjectIds.length; subjectIndex += 1) { for (const termOffset of [0, 1, 2]) { const score = scoreFor(index, subjectIndex, termOffset); const grade = gradeFor(score.total); await ctx.db.insert("assessmentRecords", { schoolId: data.schoolId, sessionId: data.sessionId, termId: data.termIds[termOffset], classId, subjectId: data.subjectIds[subjectIndex], studentId, ...score, examScaledScore: score.examRawScore, gradeLetter: grade.gradeLetter, remark: grade.remark, examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft", enteredBy: data.teacherIds[subjectIndex % 3], updatedBy: data.teacherIds[subjectIndex % 3], createdAt: now, updatedAt: now }); if (termOffset < 2) await ctx.db.insert("historicalTermTotals", { schoolId: data.schoolId, sessionId: data.sessionId, termId: data.termIds[termOffset], classId, subjectId: data.subjectIds[subjectIndex], studentId, total: score.total, source: "manual_backfill", notes: `${profile.schoolName} term snapshot`, createdAt: now, updatedAt: now, updatedBy: data.adminUserId }); } } await ctx.db.insert("reportCardComments", { schoolId: data.schoolId, studentId, sessionId: data.sessionId, termId: data.termIds[2], classTeacherComment: "Shows steady effort and contributes positively in class.", headTeacherComment: "Keep building strong learning habits next term.", createdAt: now, updatedAt: now, updatedBy: data.teacherIds[profile.students[index].classIndex] }); await ctx.db.insert("reportCardAttendanceStudentValues", { schoolId: data.schoolId, classId, studentId, sessionId: data.sessionId, termId: data.termIds[2], timesPresent: 54 + (index % 8), attendanceCode: index % 9 === 0 ? "Late twice" : "Regular", createdAt: now, updatedAt: now, updatedBy: data.teacherIds[profile.students[index].classIndex] }); await ctx.db.insert("reportCardExtraStudentValues", { schoolId: data.schoolId, classId, studentId, sessionId: data.sessionId, termId: data.termIds[2], bundleId, values: [{ fieldId: "collaboration", scaleOptionId: index % 3 === 0 ? "excellent" : "secure" }, { fieldId: "club-note", textValue: index % 2 === 0 ? "Active library club member" : "Enthusiastic STEM club contributor" }], createdAt: now, updatedAt: now, updatedBy: data.teacherIds[profile.students[index].classIndex] }); }
    const phase: "assessments" | "billing" = end === students.length ? "billing" : "assessments"; await updateRunPhase(ctx, runId, phase, { assessmentCursor: end, billingCursor: phase === "billing" ? 0 : run.billingCursor }); return { phase, cursor: end };
  },
});

export const populateDemoBillingBatchInternal = internalMutation({
  args: { runId: v.id("demoSeedRuns") }, returns: v.object({ phase: runPhaseValidator, cursor: v.number() }),
  handler: async (ctx, { runId }) => {
    const run = await requireRun(ctx, runId); if (run.phase !== "billing") return { phase: run.phase, cursor: run.billingCursor }; const profile = getSchoolSeedProfile(profileKey(run.seedProfile)); const data = await loadContext(ctx, runId); const students = await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(50); const feePlanIds = await ctx.db.query("feePlans").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(5).then((rows) => rows.map((row) => row._id)); const applicationIds = await ctx.db.query("feePlanApplications").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(5).then((rows) => rows.map((row) => row._id)); if (feePlanIds.length !== 3 || applicationIds.length !== 3) throw new ConvexError("Missing billing foundation."); const end = Math.min(run.billingCursor + 12, students.length); const now = profile.createdAt;
    for (let index = run.billingCursor; index < end; index += 1) { const classIndex = profile.students[index].classIndex; const totalAmount = 102000; const amountPaid = index % 5 === 0 ? totalAmount : index % 3 === 0 ? 51000 : 0; const status = amountPaid === totalAmount ? "paid" : amountPaid > 0 ? "partially_paid" : index % 4 === 0 ? "overdue" : "issued" as const; const invoiceId = await ctx.db.insert("studentInvoices", { schoolId: data.schoolId, feePlanId: feePlanIds[classIndex], feePlanApplicationId: applicationIds[classIndex], studentId: students[index]._id, classId: data.classIds[classIndex], sessionId: data.sessionId, termId: data.termIds[2], invoiceNumber: `${profile.schoolCode}-2026-3-${String(index + 1).padStart(3, "0")}`, feePlanNameSnapshot: `${profile.classes[classIndex].gradeName} Third Term Fees`, currency: "NGN", lineItems: [{ id: "tuition", label: "Tuition", amount: 85000, category: "tuition", order: 0 }, { id: "learning", label: "Learning resources", amount: 12000, category: "activity", order: 1 }, { id: "assessment", label: "Assessment", amount: 5000, category: "exam", order: 2 }], installmentSchedule: [{ id: "installment-1", label: "First installment", dueAt: timestamp("2026-05-15"), amount: 51000, isPaid: amountPaid >= 51000 }, { id: "installment-2", label: "Final installment", dueAt: timestamp("2026-06-15"), amount: 51000, isPaid: amountPaid === totalAmount }], subtotal: totalAmount, waiverAmount: 0, discountAmount: 0, totalAmount, amountPaid, balanceDue: totalAmount - amountPaid, status, dueDate: timestamp("2026-06-15"), issuedAt: timestamp("2026-04-20"), issuedBy: data.adminUserId, notes: `${profile.schoolName} seeded invoice — recorded payments are manual only.`, createdAt: now, updatedAt: now }); if (amountPaid > 0) { const paymentId = await ctx.db.insert("billingPayments", { schoolId: data.schoolId, invoiceId, reference: `${profile.schoolCode}-MANUAL-${String(index + 1).padStart(3, "0")}`, provider: "manual", paymentMethod: index % 2 ? "bank_transfer" : "cash", amountReceived: amountPaid, amountApplied: amountPaid, unappliedAmount: 0, applicationStatus: "applied", status: "successful", payerName: index < 2 ? profile.accounts.portal.name : `Parent ${profile.students[index].familyIndex + 1} ${profile.familyLabel}`, payerEmail: index < 2 ? profile.accounts.portal.email : undefined, receivedAt: timestamp("2026-05-20") + index * DAY, recordedBy: data.adminUserId, reconciliationStatus: "reconciled", reconciledBy: data.adminUserId, reconciledAt: now, notes: "Seeded manual payment; no gateway transaction.", createdAt: now, updatedAt: now }); await ctx.db.insert("paymentAllocations", { schoolId: data.schoolId, invoiceId, paymentId, amountApplied: amountPaid, createdAt: now, createdBy: data.adminUserId }); await ctx.db.patch(invoiceId, { lastPaymentId: paymentId, lastPaymentAt: timestamp("2026-05-20") + index * DAY }); } }
    const phase: "billing" | "knowledge" = end === students.length ? "knowledge" : "billing"; await updateRunPhase(ctx, runId, phase, { billingCursor: end }); return { phase, cursor: end };
  },
});

export const populateDemoKnowledgeAndFinalizeInternal = internalMutation({
  args: { runId: v.id("demoSeedRuns") }, returns: v.object({ schoolId: v.id("schools"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number() }),
  handler: async (ctx, { runId }) => {
    const run = await requireRun(ctx, runId); const profile = getSchoolSeedProfile(profileKey(run.seedProfile)); if (run.phase === "complete") return { schoolId: run.schoolId, studentCount: profile.students.length, classCount: profile.classes.length, invoiceCount: profile.students.length, assessmentRecordCount: profile.students.length * profile.subjects.length * 3 }; if (run.phase !== "knowledge") throw new ConvexError(`Cannot finalize demo seed from ${run.phase}.`); const data = await loadContext(ctx, runId); const now = profile.createdAt; const topicIds: Id<"knowledgeTopics">[] = [];
    for (const [title, subjectIndex] of [["Fractions in Everyday Life", 0], ["Reading for Meaning", 1], ["Living Things and Habitats", 2], ["Digital Citizenship", 4], ["Community and Leadership", 5], ["Colour and Pattern", 6]] as const) topicIds.push(await ctx.db.insert("knowledgeTopics", { schoolId: data.schoolId, subjectId: data.subjectIds[subjectIndex], level: "JSS 1", termId: data.termIds[2], title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/g, ""), summary: `Class-ready ${title.toLowerCase()} resources.`, searchText: `${title} JSS 1 third term demo`, status: "active", createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] }));
    const materialIds: Id<"knowledgeMaterials">[] = [];
    for (let index = 0; index < topicIds.length; index += 1) { const title = `Teacher notes: ${index % 2 ? "Explore" : "Teach"} ${index + 1}`; const materialId = await ctx.db.insert("knowledgeMaterials", { schoolId: data.schoolId, ownerUserId: data.teacherIds[0], ownerRole: "teacher", sourceType: "text_entry", visibility: "student_approved", reviewStatus: "approved", title, description: "A reviewed, locally seeded teaching resource for the demo workspace.", subjectId: data.subjectIds[[0, 1, 2, 4, 5, 6][index]], level: "JSS 1", topicLabel: ["Fractions in Everyday Life", "Reading for Meaning", "Living Things and Habitats", "Digital Citizenship", "Community and Leadership", "Colour and Pattern"][index], topicId: topicIds[index], searchStatus: "indexed", searchText: `${title} classroom activity discussion practice ${index + 1}`, processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: ["demo", "classroom", "third term"], chunkCount: 2, indexedAt: now, createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] }); materialIds.push(materialId); for (let chunkIndex = 0; chunkIndex < 2; chunkIndex += 1) await ctx.db.insert("knowledgeMaterialChunks", { schoolId: data.schoolId, materialId, topicId: topicIds[index], chunkIndex, chunkText: `Demo learning chunk ${chunkIndex + 1}: discuss, practise, and reflect on key ideas.`, searchText: `demo learning chunk ${chunkIndex + 1} ${title}`, visibility: "student_approved", reviewStatus: "approved", searchStatus: "indexed", tokenEstimate: 20, createdAt: now, updatedAt: now }); for (const classId of data.classIds.slice(0, 2)) await ctx.db.insert("knowledgeMaterialClassBindings", { schoolId: data.schoolId, materialId, classId, bindingPurpose: "topic_attachment", bindingStatus: "active", createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] }); }
    const templateId = await ctx.db.insert("instructionTemplates", { schoolId: data.schoolId, templateKey: "demo-jss1-lesson-plan", outputType: "lesson_plan", title: "JSS 1 Active Learning Plan", description: "A concise demonstration lesson-plan template", templateScope: "school_default", isSchoolDefault: true, requiredSectionIds: ["objectives", "activities", "assessment"], sectionDefinitions: [{ id: "objectives", label: "Learning objectives", order: 0, required: true, minimumWordCount: 20 }, { id: "activities", label: "Learning activities", order: 1, required: true, minimumWordCount: 40 }, { id: "assessment", label: "Check for understanding", order: 2, required: true, minimumWordCount: 20 }], objectiveMinimums: { minimumObjectives: 2, minimumSourceMaterials: 1, minimumSections: 3 }, searchText: "JSS 1 active learning lesson plan demo", isActive: true, createdAt: now, updatedAt: now, createdBy: data.adminUserId, updatedBy: data.adminUserId });
    const artifactId = await ctx.db.insert("instructionArtifacts", { schoolId: data.schoolId, ownerUserId: data.teacherIds[0], ownerRole: "teacher", outputType: "lesson_plan", artifactStatus: "active", visibility: "staff_shared", reviewStatus: "approved", templateId, templateResolutionPath: "school_default", subjectId: data.subjectIds[0], level: "JSS 1", topicId: topicIds[0], searchStatus: "indexed", searchText: "Fractions in Everyday Life lesson plan demo", createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] }); const documentState = "# Fractions in Everyday Life\n\n## Learning objectives\nLearners will model and compare familiar fractions.\n\n## Learning activities\nUse recipe cards and number strips in pairs, then share a strategy.\n\n## Check for understanding\nStudents explain one equivalent fraction."; const documentId = await ctx.db.insert("instructionArtifactDocuments", { schoolId: data.schoolId, artifactId, documentFormat: "markdown", documentState, plainText: documentState.replace(/#/g, ""), searchText: "Fractions lesson plan recipe cards number strips", visibility: "staff_shared", reviewStatus: "approved", outputType: "lesson_plan", topicId: topicIds[0], searchStatus: "indexed", createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] }); const revisionId = await ctx.db.insert("instructionArtifactRevisions", { schoolId: data.schoolId, artifactId, revisionNumber: 1, revisionKind: "manual_save", documentFormat: "markdown", documentState, plainText: documentState.replace(/#/g, ""), searchText: "Fractions lesson plan recipe cards number strips", visibility: "staff_shared", reviewStatus: "approved", outputType: "lesson_plan", templateId, templateResolutionPath: "school_default", sourceSelectionSnapshot: "demo-source:fractions", sourceCount: 1, createdAt: now, createdBy: data.teacherIds[0] }); await ctx.db.patch(artifactId, { currentDocumentId: documentId, currentRevisionId: revisionId }); await ctx.db.insert("instructionArtifactSources", { schoolId: data.schoolId, artifactId, materialId: materialIds[0], sourceOrder: 0, createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] });
    const profileId = await ctx.db.insert("assessmentGenerationProfiles", { schoolId: data.schoolId, name: "Balanced JSS 1 Quiz", description: "A locally seeded profile; it does not invoke an AI provider.", questionStyle: "balanced", totalQuestions: 8, questionMix: { multiple_choice: 4, short_answer: 2, essay: 1, true_false: 1, fill_in_the_blank: 0 }, allowTeacherOverrides: true, isDefault: true, isActive: true, searchText: "balanced JSS 1 quiz demo", createdAt: now, updatedAt: now, createdBy: data.adminUserId, updatedBy: data.adminUserId }); const bankId = await ctx.db.insert("assessmentBanks", { schoolId: data.schoolId, ownerUserId: data.teacherIds[0], ownerRole: "teacher", outputType: "question_bank_draft", draftMode: "class_test", sourceSelectionSnapshot: "demo-source:fractions", effectiveGenerationSettings: { profileId, profileName: "Balanced JSS 1 Quiz", questionStyle: "balanced", totalQuestions: 8, questionMix: { multiple_choice: 4, short_answer: 2, essay: 1, true_false: 1, fill_in_the_blank: 0 }, allowTeacherOverrides: true }, bankStatus: "active", title: "Fractions Checkpoint Bank", description: "Teacher-reviewed sample questions for a class checkpoint.", visibility: "staff_shared", reviewStatus: "approved", subjectId: data.subjectIds[0], level: "JSS 1", topicId: topicIds[0], searchStatus: "indexed", searchText: "Fractions checkpoint assessment bank demo", createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] }); for (let itemOrder = 0; itemOrder < 8; itemOrder += 1) await ctx.db.insert("assessmentBankItems", { schoolId: data.schoolId, bankId, itemOrder, questionType: itemOrder < 4 ? "multiple_choice" : itemOrder < 6 ? "short_answer" : itemOrder === 6 ? "essay" : "true_false", difficulty: itemOrder < 3 ? "easy" : itemOrder < 6 ? "medium" : "hard", promptText: `Demo fractions question ${itemOrder + 1}: explain or select the best representation.`, answerText: `Model answer for fractions question ${itemOrder + 1}.`, explanationText: "This checks conceptual understanding using a familiar context.", marks: itemOrder === 6 ? 5 : 2, tags: ["fractions", "jss-1", "demo"], visibility: "staff_shared", reviewStatus: "approved", searchStatus: "indexed", searchText: `fractions demo question ${itemOrder + 1}`, createdAt: now, updatedAt: now, createdBy: data.teacherIds[0], updatedBy: data.teacherIds[0] });
    if (profile.key === "judge") {
      const fixture = await populateJudgeCurriculumFixture(ctx, { schoolId: data.schoolId, adminUserId: data.adminUserId, teacherUserId: data.teacherIds[0], socialStudiesSubjectId: data.subjectIds[3], secondTermId: data.termIds[1], jssOneClassIds: data.classIds.slice(0, 2), now });
      await populateJudgeLessonFixture(ctx, { schoolId: data.schoolId, teacherUserId: data.teacherIds[0], subjectId: data.subjectIds[3], topicId: fixture.topicId, materialId: fixture.materialId, now });
    }
    const studentCount = (await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(50)).length; const invoiceCount = (await ctx.db.query("studentInvoices").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(50)).length; const assessmentRecordCount = (await ctx.db.query("assessmentRecords").withIndex("by_school", (q) => q.eq("schoolId", data.schoolId)).take(800)).length; if (studentCount !== profile.students.length || invoiceCount !== profile.students.length || assessmentRecordCount !== profile.students.length * profile.subjects.length * 3) throw new ConvexError(`${profile.schoolName} seed final validation failed.`); await ctx.db.patch(runId, { status: "succeeded", phase: "complete", updatedAt: Date.now() }); return { schoolId: data.schoolId, studentCount, classCount: data.classIds.length, invoiceCount, assessmentRecordCount };
  },
});

/**
 * Operator-only development fixture for the existing Demo Academy tenant.
 * It is idempotent, never creates or stores payment credentials, and is not
 * reachable from a browser client because it is an internal mutation.
 */
export const provisionDemoAdmissionsFixtureInternal = internalMutation({
  args: {},
  returns: v.object({
    schoolId: v.id("schools"),
    adminUserId: v.id("users"),
    intakeId: v.id("admissionsIntakes"),
    productId: v.id("admissionsProducts"),
    grantedCapabilityCount: v.number(),
  }),
  handler: async (ctx) => {
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", DEMO_SCHOOL_SLUG)).unique();
    if (!school || school.status !== "active") throw new ConvexError("Seed Demo Academy before provisioning admissions.");
    const users = await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(100);
    const admin = users.find((user) => user.email === "admin@demo-academy.school" && !user.isArchived);
    if (!admin) throw new ConvexError("Demo Academy admin is unavailable.");

    const now = Date.now();
    const existingGrants = await ctx.db.query("schoolCapabilityGrants").withIndex("by_school_and_user", (q) => q.eq("schoolId", school._id).eq("userId", admin._id)).take(100);
    const granted = new Set(existingGrants.filter((grant) => !grant.revokedAt && grant.scope === "school").map((grant) => grant.capability));
    let grantedCapabilityCount = 0;
    for (const capability of ADMISSIONS_PERMISSIONS_V1) {
      if (granted.has(capability)) continue;
      await ctx.db.insert("schoolCapabilityGrants", {
        schoolId: school._id,
        userId: admin._id,
        capability,
        scope: "school",
        grantedByUserId: admin._id,
        reason: "Development-only Demo Academy admissions fixture",
        isBreakGlass: false,
        createdAt: now,
      });
      grantedCapabilityCount += 1;
    }

    let programme = await ctx.db.query("admissionsProgrammes").withIndex("by_school_and_slug", (q) => q.eq("schoolId", school._id).eq("slug", "demo-admissions")).unique();
    if (!programme) {
      const id = await ctx.db.insert("admissionsProgrammes", { schoolId: school._id, slug: "demo-admissions", name: "Demo Academy admissions", description: "Development-only admissions workflow fixture.", status: "published", createdAt: now, updatedAt: now });
      programme = await ctx.db.get("admissionsProgrammes", id);
    } else if (programme.status !== "published") await ctx.db.patch(programme._id, { status: "published", updatedAt: now });
    if (!programme) throw new ConvexError("Failed to provision the demo programme.");

    let intake = await ctx.db.query("admissionsIntakes").withIndex("by_school_and_slug", (q) => q.eq("schoolId", school._id).eq("slug", "development-intake")).unique();
    const opensAt = now - DAY;
    const closesAt = now + 180 * DAY;
    if (!intake) {
      const id = await ctx.db.insert("admissionsIntakes", { schoolId: school._id, programmeId: programme._id, slug: "development-intake", name: "Development admissions intake", cycleLabel: "Development fixture", opensAt, closesAt, status: "open", createdAt: now, updatedAt: now });
      intake = await ctx.db.get("admissionsIntakes", id);
    } else await ctx.db.patch(intake._id, { programmeId: programme._id, opensAt, closesAt, status: "open", updatedAt: now });
    if (!intake) throw new ConvexError("Failed to provision the demo intake.");

    let form = (await ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "published")).take(1))[0];
    if (!form) {
      const id = await ctx.db.insert("admissionsFormVersions", { schoolId: school._id, programmeId: programme._id, intakeId: intake._id, version: 1, schemaVersion: "demo-v1", status: "published", publishedAt: now, publishedBy: admin._id, createdAt: now, updatedAt: now });
      const createdForm = await ctx.db.get("admissionsFormVersions", id);
      if (!createdForm) throw new ConvexError("Failed to provision the demo form.");
      form = createdForm;
    }
    const preferredName = await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_field_key", (q) => q.eq("formVersionId", form._id).eq("fieldKey", "preferred-name")).unique();
    if (!preferredName) await ctx.db.insert("admissionsFormFields", { schoolId: school._id, formVersionId: form._id, fieldKey: "preferred-name", sectionKey: "child", kind: "text", label: "Preferred name", helpText: "Optional development fixture field.", requiredMode: "optional", dataClass: "personal", purpose: "Address the applicant correctly during review.", validationJson: "{}", order: 10, status: "active", createdAt: now, updatedAt: now });
    const birthCertificate = await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q) => q.eq("formVersionId", form._id).eq("requirementKey", "birth-certificate")).unique();
    if (!birthCertificate) await ctx.db.insert("admissionsDocumentRequirements", { schoolId: school._id, formVersionId: form._id, requirementKey: "birth-certificate", category: "identity", label: "Birth certificate (optional demo upload)", requiredMode: "optional", acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5_000_000, maxFiles: 1, sensitivity: "child_confidential", purpose: "Exercise the private admissions upload workflow in development.", order: 20, createdAt: now, updatedAt: now });

    let declaration = await ctx.db.query("admissionsDeclarationVersions").withIndex("by_school_and_programme_and_version", (q) => q.eq("schoolId", school._id).eq("programmeId", programme._id).eq("version", 1)).unique();
    if (!declaration) {
      const body = "I confirm that the information in this development application is accurate for testing purposes.";
      const id = await ctx.db.insert("admissionsDeclarationVersions", { schoolId: school._id, programmeId: programme._id, version: 1, title: "Development application declaration", body, bodyDigest: await digest(body), purpose: "Record the guardian's test submission declaration.", status: "published", publishedAt: now, publishedBy: admin._id, createdAt: now, updatedAt: now });
      declaration = await ctx.db.get("admissionsDeclarationVersions", id);
    } else if (declaration.status !== "published") await ctx.db.patch(declaration._id, { status: "published", publishedAt: now, publishedBy: admin._id, updatedAt: now });

    let product = await ctx.db.query("admissionsProducts").withIndex("by_school_and_slug", (q) => q.eq("schoolId", school._id).eq("slug", "one-application-slot")).unique();
    if (!product) {
      const id = await ctx.db.insert("admissionsProducts", { schoolId: school._id, intakeId: intake._id, slug: "one-application-slot", name: "One child application", slotCount: 1, status: "active", createdAt: now, updatedAt: now });
      product = await ctx.db.get("admissionsProducts", id);
    } else await ctx.db.patch(product._id, { intakeId: intake._id, status: "active", updatedAt: now });
    if (!product) throw new ConvexError("Failed to provision the demo product.");

    let financeEvidence = (await ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_approval_class", (q) => q.eq("schoolId", school._id).eq("approvalClass", "finance")).take(100)).find((evidence) => evidence.subjectType === "admissions_price" && evidence.subjectKey === `${String(product._id)}:1` && !evidence.revokedAt);
    if (!financeEvidence) {
      const approvedValueDigest = await digest(JSON.stringify({ amountMinor: 100_000, currency: "NGN", refundPolicyKey: "demo-non-refundable", feeDisclosure: "Development-only non-refundable test application fee." }));
      const id = await ctx.db.insert("schoolApprovalEvidence", { schoolId: school._id, approvalClass: "finance", subjectType: "admissions_price", subjectKey: `${String(product._id)}:1`, evidenceReference: "demo-fixture:finance-v1", approvedValueDigest, approvedByUserId: admin._id, approvalProvenance: "accountable_school_approver", approvedAt: now, expiresAt: now + 365 * DAY, createdAt: now });
      financeEvidence = await ctx.db.get("schoolApprovalEvidence", id) ?? undefined;
    }
    let price = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_version", (q) => q.eq("productId", product._id).eq("version", 1)).unique();
    if (!price) {
      await ctx.db.insert("admissionsProductPrices", { schoolId: school._id, productId: product._id, version: 1, amountMinor: 100_000, currency: "NGN", refundPolicyKey: "demo-non-refundable", feeDisclosure: "Development-only non-refundable test application fee.", effectiveFrom: now - DAY, effectiveTo: now + 180 * DAY, status: "published", ...(financeEvidence ? { approvalEvidenceId: financeEvidence._id } : {}), createdAt: now, updatedAt: now });
    } else await ctx.db.patch(price._id, { effectiveFrom: now - DAY, effectiveTo: now + 180 * DAY, status: "published", ...(financeEvidence ? { approvalEvidenceId: financeEvidence._id } : {}), updatedAt: now });

    return { schoolId: school._id, adminUserId: admin._id, intakeId: intake._id, productId: product._id, grantedCapabilityCount };
  },
});

export const markDemoSeedRunFailedInternal = internalMutation({
  args: { runId: v.id("demoSeedRuns"), errorMessage: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { const run = await ctx.db.get(args.runId); if (run && run.status === "running") await ctx.db.patch(args.runId, { status: "failed", errorMessage: args.errorMessage.slice(0, 500), updatedAt: Date.now() }); return null; },
});
