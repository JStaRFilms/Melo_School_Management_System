import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { getAuthenticatedSchoolMembership } from "./auth";
import { assertTeacherAssignment, teacherHasClassAccess } from "./teacherAccess";
import { listActiveClassSubjectAggregations } from "./subjectAggregationHelpers";
import { deriveNarrativeSubjectSelectionIds } from "./subjectAggregationSelectionHelpers";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import { resolvePortalStudentContext } from "./portalIdentity";
import { getReadableUserName } from "./studentNameCompat";
import { formatClassDisplayName } from "@school/shared/name-format";
import schema from "../../schema";

const selection = {
  classId: v.id("classes"),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  studentId: v.id("students"),
};
const period = { studentId: selection.studentId, sessionId: selection.sessionId, termId: selection.termId };
// Preview returns the snapshot and a review key containing that snapshot; keep
// both the response and the eventual issued document safely below Convex's 1MB limit.
const MAX_NARRATIVE_SNAPSHOT_BYTES = 256 * 1024;
const MAX_NARRATIVE_BATCH_RESPONSE_BYTES = 512 * 1024;
function assertSnapshotFits(snapshot: unknown) {
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_NARRATIVE_SNAPSHOT_BYTES)
    throw new ConvexError("Report comments exceed the 256 KB report limit; shorten comments before reviewing or publishing");
}
const subjectSelection = { ...selection, subjectId: v.id("subjects") };
const snapshotValidator = schema.tables.issuedNarrativeReports.validator.fields.snapshot;
const issuedValidator = v.object({ ...schema.tables.issuedNarrativeReports.validator.fields,
  _id: v.id("issuedNarrativeReports"), _creationTime: v.number() });
const portalIssuedValidator = v.object({ snapshot: snapshotValidator, issuedAt: v.number() });
type Context = QueryCtx | MutationCtx;
type Selection = {
  classId: Id<"classes">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  studentId: Id<"students">;
};

async function modeFor(ctx: Context, classId: Id<"classes">, sessionId: Id<"academicSessions">) {
  return ctx.db.query("classSessionReportModes")
    .withIndex("by_classId_and_sessionId", q => q.eq("classId", classId).eq("sessionId", sessionId))
    .unique();
}
async function issuedFor(ctx: Context, args: {
  studentId: Id<"students">; sessionId: Id<"academicSessions">; termId: Id<"academicTerms">;
}) {
  return ctx.db.query("issuedNarrativeReports")
    .withIndex("by_studentId_and_sessionId_and_termId", q =>
      q.eq("studentId", args.studentId).eq("sessionId", args.sessionId).eq("termId", args.termId))
    .unique();
}
async function schoolContext(ctx: Context, classId: Id<"classes">) {
  const classDoc = await ctx.db.get(classId);
  if (!classDoc) throw new ConvexError("Class not found");
  const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId: classDoc.schoolId, capability: "academic.report_cards.preview" });
  if (auth.schoolId !== classDoc.schoolId) throw new ConvexError("Class not found");
  return { classDoc, auth };
}
async function assertAdmin(ctx: Context, schoolId: Id<"schools">) {
  const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId });
  if (!auth.isSchoolAdmin) throw new ConvexError("Admin access required");
  return auth;
}
async function assertStaff(ctx: Context, args: Selection, options?: { allowIssuedHistory?: boolean }) {
  const { classDoc, auth } = await schoolContext(ctx, args.classId);
  if (!auth.isSchoolAdmin) {
    if (auth.role !== "teacher") throw new ConvexError("Staff access required");
    const historicalTeacher = await ctx.db.query("classSessionFormTeachers")
      .withIndex("by_class_and_session", q => q.eq("classId", args.classId).eq("sessionId", args.sessionId))
      .unique();
    if (!(historicalTeacher?.schoolId === auth.schoolId && historicalTeacher.formTeacherId === auth.userId) &&
        !(await teacherHasClassAccess(ctx, auth.userId, auth.schoolId, args.classId)))
      throw new ConvexError("Not assigned to this class");
  }
  const [student, session, term] = await Promise.all([
    ctx.db.get(args.studentId), ctx.db.get(args.sessionId), ctx.db.get(args.termId),
  ]);
  if (!student || student.schoolId !== auth.schoolId || student.isArchived ||
      !session || session.schoolId !== auth.schoolId ||
      !term || term.schoolId !== auth.schoolId || term.sessionId !== session._id ||
      classDoc.schoolId !== auth.schoolId)
    throw new ConvexError("Invalid report selection");
  if (options?.allowIssuedHistory) {
    // An exact issued snapshot is enrollment evidence for historical staff reads
    // only. Draft endpoints and new publication still require enrollment history.
    const issued = await issuedFor(ctx, args);
    if (issued) {
      if (issued.schoolId !== auth.schoolId || issued.classId !== args.classId ||
          issued.studentId !== student._id || issued.sessionId !== session._id ||
          issued.termId !== term._id)
        throw new ConvexError("Invalid issued report selection");
      return { auth, classDoc, student, session, term };
    }
  }
  // Promotion records are explicit enrollment history. A current class alone is
  // not evidence that the pupil belonged to it in an earlier session.
  const [to, from] = await Promise.all([
    ctx.db.query("studentPromotions").withIndex("by_student_and_to_session", q =>
      q.eq("studentId", student._id).eq("toSessionId", session._id)).take(100),
    ctx.db.query("studentPromotions").withIndex("by_student_and_from_session", q =>
      q.eq("studentId", student._id).eq("fromSessionId", session._id)).take(100),
  ]);
  if (to.length === 100 || from.length === 100) throw new ConvexError("Enrollment history requires review");
  const enrolled = [...to, ...from].some(row => row.schoolId === auth.schoolId &&
    (row.toSessionId === session._id && row.toClassId === args.classId ||
     row.fromSessionId === session._id && row.fromClassId === args.classId)) ||
    (session.isActive && to.length === 0 && student.classId === args.classId) ||
    (student.graduatingSessionId === session._id && student.graduatingClassId === args.classId);
  if (!enrolled) throw new ConvexError("Student is not enrolled in this class and session");
  return { auth, classDoc, student, session, term };
}
async function assertNarrative(ctx: Context, args: Selection, options?: { allowIssuedHistory?: boolean }) {
  const context = await assertStaff(ctx, args, options);
  if (!(await modeFor(ctx, args.classId, args.sessionId)))
    throw new ConvexError("This class uses graded reports for this session");
  return context;
}
// One bounded scan per request. A partial school history must never authorize
// changing a mode, even if the target class is absent from the first page.
async function gradedIssuedClasses(ctx: Context, schoolId: Id<"schools">, sessionId: Id<"academicSessions">) {
  const rows = await ctx.db.query("issuedReportCards").withIndex("by_school", q => q.eq("schoolId", schoolId)).take(1001);
  if (rows.length > 1000) throw new ConvexError("Report history exceeds mode-change scan limit");
  return new Set(rows.filter(row => row.sessionId === sessionId).map(row => row.classId));
}
async function hasIssuedInClass(ctx: Context, gradedClasses: ReadonlySet<Id<"classes">>, classId: Id<"classes">, sessionId: Id<"academicSessions">) {
  if (gradedClasses.has(classId)) return true;
  return Boolean(await ctx.db.query("issuedNarrativeReports").withIndex("by_classId_and_sessionId", q =>
    q.eq("classId", classId).eq("sessionId", sessionId)).first());
}

export const listClassModes = query({
  args: { sessionId: v.id("academicSessions") },
  returns: v.array(v.object({ classId: v.id("classes"), mode: v.union(v.literal("graded"), v.literal("narrative")), locked: v.boolean() })),
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.isArchived) throw new ConvexError("Session not found");
    await assertAdmin(ctx, session.schoolId);
    await requireCapability(ctx, session.schoolId, "academic.classes.manage");
    const classes = await ctx.db.query("classes").withIndex("by_school", q => q.eq("schoolId", session.schoolId)).take(501);
    if (classes.length > 500) throw new ConvexError("Class list exceeds supported size");
    const gradedClasses = await gradedIssuedClasses(ctx, session.schoolId, sessionId);
    return Promise.all(classes.filter(c => !c.isArchived).map(async c => ({
      classId: c._id,
      mode: (await modeFor(ctx, c._id, sessionId)) ? "narrative" as const : "graded" as const,
      locked: await hasIssuedInClass(ctx, gradedClasses, c._id, sessionId),
    })));
  },
});

export const setClassModes = mutation({
  args: { sessionId: v.id("academicSessions"), classIds: v.array(v.id("classes")), mode: v.union(v.literal("graded"), v.literal("narrative")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.isArchived) throw new ConvexError("Session not found");
    const auth = await assertAdmin(ctx, session.schoolId);
    await requireCapability(ctx, session.schoolId, "academic.classes.manage");
    if (!args.classIds.length || args.classIds.length > 50 || new Set(args.classIds).size !== args.classIds.length)
      throw new ConvexError("Select between 1 and 50 distinct classes");
    const changes = [];
    let gradedClasses: ReadonlySet<Id<"classes">> | null = null;
    for (const id of args.classIds) {
      const classDoc = await ctx.db.get(id);
      if (!classDoc || classDoc.schoolId !== auth.schoolId || classDoc.isArchived)
        throw new ConvexError("Invalid class selection");
      const existing = await modeFor(ctx, id, args.sessionId);
      if (Boolean(existing) === (args.mode === "narrative")) continue;
      gradedClasses ??= await gradedIssuedClasses(ctx, auth.schoolId, args.sessionId);
      if (await hasIssuedInClass(ctx, gradedClasses, id, args.sessionId))
        throw new ConvexError("Mode locked after a report was issued in this class and session");
      changes.push({ id, existing });
    }
    for (const { id, existing } of changes) {
      if (existing) await ctx.db.delete(existing._id);
      else await ctx.db.insert("classSessionReportModes", {
        schoolId: auth.schoolId, classId: id, sessionId: args.sessionId,
        mode: "narrative", updatedAt: Date.now(), updatedBy: auth.userId,
      });
    }
    return null;
  },
});

// Entry navigation is not a report preview. A stale class selector must be
// able to learn the mode without granting teacher access to a subject or draft.
export const getEntryClassMode = query({
  args: { schoolId: v.optional(v.id("schools")), classId: selection.classId, sessionId: selection.sessionId },
  returns: v.object({ mode: v.union(v.literal("graded"), v.literal("narrative")), canEnterNarrative: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId, capability: "academic.assessments.enter",
    });
    if (!auth.isSchoolAdmin && auth.role !== "admin" && auth.role !== "teacher" && auth.role !== "staff")
      throw new ConvexError("Staff access required");
    // Legacy staff have no role-based assessment-entry fallback; require an
    // explicit grant even before the school's permission migration.
    if (auth.role === "staff") await requireCapability(ctx, auth.schoolId, "academic.assessments.enter");
    const [classDoc, session] = await Promise.all([ctx.db.get(args.classId), ctx.db.get(args.sessionId)]);
    if (!classDoc || classDoc.schoolId !== auth.schoolId || !session || session.schoolId !== auth.schoolId)
      throw new ConvexError("Invalid entry selection");
    const mode = await modeFor(ctx, args.classId, args.sessionId);
    if (mode && mode.schoolId !== auth.schoolId) throw new ConvexError("Invalid entry selection");
    if (!mode || classDoc.isArchived || (auth.role !== "teacher" && !auth.isSchoolAdmin))
      return { mode: mode ? "narrative" as const : "graded" as const, canEnterNarrative: false };
    let hasPreview = true;
    try {
      // Match the actual getSubjectOptions/getSheet permission gate. Do not
      // infer narrative access from assessment-entry permission or admin title.
      await getAuthenticatedSchoolMembership(ctx, {
        schoolId: auth.schoolId, capability: "academic.report_cards.preview",
      });
    } catch (error) {
      if (!(error instanceof ConvexError) || error.data !== "Forbidden: Required operation capability is missing") throw error;
      hasPreview = false;
    }
    const hasClassAccess = auth.isSchoolAdmin || await teacherHasClassAccess(ctx, auth.userId, auth.schoolId, args.classId);
    return { mode: "narrative" as const, canEnterNarrative: hasPreview && hasClassAccess };
  },
});

export const getClassMode = query({
  args: { classId: selection.classId, sessionId: selection.sessionId },
  returns: v.union(v.literal("graded"), v.literal("narrative")),
  handler: async (ctx, args) => {
    const { auth } = await schoolContext(ctx, args.classId);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== auth.schoolId) throw new ConvexError("Session not found");
    if (!auth.isSchoolAdmin) {
      const historical = await ctx.db.query("classSessionFormTeachers")
        .withIndex("by_class_and_session", q => q.eq("classId", args.classId).eq("sessionId", args.sessionId)).unique();
      if (auth.role !== "teacher" ||
          !(historical?.schoolId === auth.schoolId && historical.formTeacherId === auth.userId) &&
          !(await teacherHasClassAccess(ctx, auth.userId, auth.schoolId, args.classId)))
        throw new ConvexError("Not assigned to this class");
    }
    return (await modeFor(ctx, args.classId, args.sessionId)) ? "narrative" : "graded";
  },
});

async function applicableSubjects(ctx: Context, args: Selection, schoolId: Id<"schools">) {
  const [assignments, selections, aggregations] = await Promise.all([
    ctx.db.query("classSubjects").withIndex("by_class", q => q.eq("classId", args.classId)).take(101),
    ctx.db.query("studentSubjectSelections").withIndex("by_student_and_class_and_session", q =>
      q.eq("studentId", args.studentId).eq("classId", args.classId).eq("sessionId", args.sessionId)).take(101),
    listActiveClassSubjectAggregations(ctx, { schoolId, classId: args.classId }),
  ]);
  if (assignments.length > 100 || selections.length > 100) throw new ConvexError("Subject list exceeds supported size");
  const ids = deriveNarrativeSubjectSelectionIds({
    explicitSubjectIds: (selections.length ? selections : assignments)
      .filter(row => row.schoolId === schoolId).map(row => String(row.subjectId)),
    aggregations,
  });
  if (ids.size > 100) throw new ConvexError("Subject list exceeds supported size");
  const subjects = await Promise.all([...ids].map(id => ctx.db.get(id as Id<"subjects">)));
  if (subjects.some(subject => !subject || subject.schoolId !== schoolId))
    throw new ConvexError("Invalid subject selection");
  // Match getSubjectOptions: archived subjects have no entry sheet and must not
  // become unfulfillable required comments. Issued reports retain their snapshot.
  return subjects.filter((subject): subject is NonNullable<typeof subject> => subject !== null && !subject.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name) || String(a._id).localeCompare(String(b._id)));
}
async function subjectAccess(ctx: Context, args: Selection & { subjectId: Id<"subjects"> }) {
  const { auth } = await assertNarrative(ctx, args);
  const subjects = await applicableSubjects(ctx, args, auth.schoolId);
  if (!subjects.some(subject => subject._id === args.subjectId)) throw new ConvexError("Subject not selected for student");
  if (!auth.isSchoolAdmin) await assertTeacherAssignment(ctx, auth.userId, args.classId, args.subjectId);
  return auth;
}
async function draftFor(ctx: Context, args: Selection & { subjectId: Id<"subjects"> }) {
  return ctx.db.query("narrativeReportDrafts")
    .withIndex("by_studentId_and_sessionId_and_termId_and_classId_and_subjectId", q =>
      q.eq("studentId", args.studentId).eq("sessionId", args.sessionId).eq("termId", args.termId)
        .eq("classId", args.classId).eq("subjectId", args.subjectId)).unique();
}
async function preview(ctx: Context, args: Selection) {
  const { auth, classDoc, student, session, term } = await assertNarrative(ctx, args, { allowIssuedHistory: true });
  const issued = await issuedFor(ctx, args);
  if (issued && issued.classId !== args.classId) throw new ConvexError("Report already issued for another class");
  if (issued) return { issued, snapshot: issued.snapshot, reviewedKey: "" };
  // Teachers assigned to the class may read an issued copy, never the full
  // multi-subject draft preview (which contains other teachers' comments).
  if (!auth.isSchoolAdmin) throw new ConvexError("Admin access required for full report preview");
  const subjects = await applicableSubjects(ctx, args, auth.schoolId);
  const drafts = await Promise.all(subjects.map(subject => draftFor(ctx, { ...args, subjectId: subject._id })));
  if (drafts.some(draft => draft && (draft.schoolId !== auth.schoolId || draft.classId !== args.classId)))
    throw new ConvexError("Report draft belongs to another class");
  const [school, studentUser] = await Promise.all([ctx.db.get(auth.schoolId), ctx.db.get(student.userId)]);
  if (!school) throw new ConvexError("School not found");
  const snapshot = {
    schoolName: school.name,
    primaryColor: school.theme?.primaryColor,
    accentColor: school.theme?.accentColor,
    studentName: getReadableUserName(studentUser).displayName,
    admissionNumber: student.admissionNumber,
    className: formatClassDisplayName({ name: classDoc.name, gradeName: classDoc.gradeName, classLabel: classDoc.classLabel }),
    sessionName: session.name,
    termName: term.name,
    subjects: subjects.map((subject, order) => ({ subjectId: subject._id, name: subject.name, order, comment: drafts[order]?.comment ?? "" })),
  };
  assertSnapshotFits(snapshot);
  const reviewedKey = JSON.stringify([snapshot, drafts.map(draft => [draft?._id, draft?.updatedAt])]);
  return { issued, snapshot, reviewedKey };
}

// Batch printing never builds a live preview. A large roster or issued set must
// fail closed rather than print a partial class without warning.
export const getIssuedClassBatch = query({
  args: { classId: selection.classId, sessionId: selection.sessionId, termId: selection.termId },
  returns: v.object({ reports: v.array(portalIssuedValidator), skipped: v.number() }),
  handler: async (ctx, args) => {
    const { classDoc, auth } = await schoolContext(ctx, args.classId);
    if (!auth.isSchoolAdmin) throw new ConvexError("Admin access required");
    const [session, term] = await Promise.all([ctx.db.get(args.sessionId), ctx.db.get(args.termId)]);
    if (classDoc.schoolId !== auth.schoolId || !session || session.schoolId !== auth.schoolId ||
        !term || term.schoolId !== auth.schoolId || term.sessionId !== session._id)
      throw new ConvexError("Invalid report selection");
    if (!(await modeFor(ctx, args.classId, args.sessionId))) throw new ConvexError("Class is not in comment mode");
    const limit = 40;
    const [issued, current, arrivals, departures, graduations] = await Promise.all([
      ctx.db.query("issuedNarrativeReports").withIndex("by_classId_and_sessionId_and_termId", q =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId).eq("termId", args.termId)).take(limit + 1),
      session.isActive ? ctx.db.query("students").withIndex("by_school_and_class", q =>
        q.eq("schoolId", auth.schoolId).eq("classId", args.classId)).take(limit + 1) : Promise.resolve([]),
      ctx.db.query("studentPromotions").withIndex("by_to_class_and_to_session", q =>
        q.eq("toClassId", args.classId).eq("toSessionId", args.sessionId)).take(limit + 1),
      ctx.db.query("studentPromotions").withIndex("by_from_class_and_from_session", q =>
        q.eq("fromClassId", args.classId).eq("fromSessionId", args.sessionId)).take(limit + 1),
      ctx.db.query("studentGraduations").withIndex("by_class_and_session", q =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId)).take(limit + 1),
    ]);
    if ([issued, current, arrivals, departures, graduations].some(rows => rows.length > limit))
      throw new ConvexError("Class exceeds 40 students; print reports individually");
    const roster = new Set<Id<"students">>();
    for (const row of [...arrivals, ...departures]) {
      if (row.schoolId !== auth.schoolId) throw new ConvexError("Invalid enrollment history");
      roster.add(row.studentId);
    }
    for (const row of graduations) {
      if (row.schoolId !== auth.schoolId) throw new ConvexError("Invalid enrollment history");
      roster.add(row.studentId);
    }
    if (session.isActive) for (const student of current) {
      if (!student.isArchived) roster.add(student._id);
    }
    for (const row of issued) {
      if (row.schoolId !== auth.schoolId || row.classId !== args.classId ||
          row.sessionId !== args.sessionId || row.termId !== args.termId)
        throw new ConvexError("Invalid issued report");
      roster.add(row.studentId);
    }
    if (roster.size > limit) throw new ConvexError("Class exceeds 40 students; print reports individually");
    const reports = [...issued].sort((a, b) =>
      a.snapshot.studentName.localeCompare(b.snapshot.studentName) || String(a.studentId).localeCompare(String(b.studentId)))
      .map(row => ({ snapshot: row.snapshot, issuedAt: row.issuedAt }));
    const response = { reports, skipped: roster.size - issued.length };
    // Check the entire response, not each report: 40 valid snapshots can
    // exceed Convex's response limit even when every document is valid.
    if (new TextEncoder().encode(JSON.stringify(response)).length > MAX_NARRATIVE_BATCH_RESPONSE_BYTES)
      throw new ConvexError("Print smaller batches/individually; issued reports exceed the 512 KiB class print limit");
    return response;
  },
});

export const getDraft = query({
  args: subjectSelection,
  returns: v.object({ comment: v.string(), issued: v.boolean() }),
  handler: async (ctx, args) => {
    const auth = await subjectAccess(ctx, args);
    const issued = await issuedFor(ctx, args);
    if (issued && issued.classId !== args.classId) throw new ConvexError("Report already issued for another class");
    const draft = issued ? null : await draftFor(ctx, args);
    if (draft && (draft.schoolId !== auth.schoolId || draft.classId !== args.classId)) throw new ConvexError("Invalid draft");
    return { comment: issued?.snapshot.subjects.find(s => s.subjectId === args.subjectId)?.comment ?? draft?.comment ?? "", issued: Boolean(issued) };
  },
});
export const saveDraft = mutation({
  args: { ...subjectSelection, comment: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = await subjectAccess(ctx, args);
    if (args.comment.length > 10000) throw new ConvexError("Comment cannot exceed 10000 characters");
    if (await issuedFor(ctx, args)) throw new ConvexError("Published reports cannot be edited");
    const draft = await draftFor(ctx, args);
    if (draft && (draft.schoolId !== auth.schoolId || draft.classId !== args.classId))
      throw new ConvexError("Report draft belongs to another class");
    const value = { comment: args.comment, updatedAt: Date.now(), updatedBy: auth.userId };
    if (draft) await ctx.db.patch(draft._id, value);
    else await ctx.db.insert("narrativeReportDrafts", { ...value, schoolId: auth.schoolId, classId: args.classId,
      studentId: args.studentId, sessionId: args.sessionId, termId: args.termId, subjectId: args.subjectId });
    return null;
  },
});
export const getStaffPreview = query({
  args: selection,
  returns: v.object({ status: v.union(v.literal("issued"), v.literal("draft")),
    snapshot: snapshotValidator, reviewedKey: v.union(v.string(), v.null()),
    issuedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    const result = await preview(ctx, args);
    return result.issued
      ? { status: "issued" as const, snapshot: result.issued.snapshot, reviewedKey: null, issuedAt: result.issued.issuedAt }
      : { status: "draft" as const, snapshot: result.snapshot, reviewedKey: result.reviewedKey, issuedAt: null };
  },
});
export const publish = mutation({
  args: { ...selection, reviewedKey: v.string() },
  returns: issuedValidator,
  handler: async (ctx, args) => {
    const { auth } = await assertNarrative(ctx, args);
    if (!auth.isSchoolAdmin) throw new ConvexError("Admin access required");
    const actor = await requireCapability(ctx, auth.schoolId, "academic.report_cards.publish_final");
    const result = await preview(ctx, args);
    if (result.issued) return result.issued;
    if (await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q =>
      q.eq("studentId", args.studentId).eq("sessionId", args.sessionId).eq("termId", args.termId)).first())
      throw new ConvexError("A graded report was already issued for this period");
    assertSnapshotFits(result.snapshot);
    if (result.reviewedKey !== args.reviewedKey) throw new ConvexError("Report changed since review");
    if (!result.snapshot.subjects.length) throw new ConvexError("Assign subjects before publishing");
    if (result.snapshot.subjects.some(subject => !subject.comment.trim()))
      throw new ConvexError("Add a comment for every subject before publishing");
    const id = await ctx.db.insert("issuedNarrativeReports", {
      schoolId: auth.schoolId, classId: args.classId, studentId: args.studentId,
      sessionId: args.sessionId, termId: args.termId, snapshot: result.snapshot,
      issuedAt: Date.now(), issuedBy: auth.userId,
    });
    await recordAuditEventHelper(ctx, { schoolId: auth.schoolId, actorKind: "user",
      actorPersonId: actor.personId, actorMembershipId: actor.membershipId,
      actorEmailSnapshot: auth.role, module: "academic", action: "narrative_report.publish",
      targetType: "students", targetId: args.studentId, outcome: "success",
      safeSummary: "Published immutable narrative report", alertTier: "tier1_critical" });
    return (await ctx.db.get(id))!;
  },
});

async function portalSelection(ctx: QueryCtx, args: {
  studentId: Id<"students">; sessionId: Id<"academicSessions">; termId: Id<"academicTerms">;
}) {
  const { student, schoolId } = await resolvePortalStudentContext(ctx, { studentId: args.studentId });
  const [session, term] = await Promise.all([ctx.db.get(args.sessionId), ctx.db.get(args.termId)]);
  if (!session || session.schoolId !== schoolId || !term || term.schoolId !== schoolId || term.sessionId !== session._id)
    throw new ConvexError("Invalid report selection");
  const issued = await issuedFor(ctx, args);
  if (issued && (issued.studentId !== student._id || issued.schoolId !== schoolId))
    throw new ConvexError("Invalid report selection");
  return { student, schoolId, session, issued };
}

// Linked family/student only. Never return publication actors or mutable drafts.
export const getIssuedForPortal = query({
  args: period,
  returns: v.union(portalIssuedValidator, v.null()),
  handler: async (ctx, args) => {
    const issued = (await portalSelection(ctx, args)).issued;
    return issued ? { snapshot: issued.snapshot, issuedAt: issued.issuedAt } : null;
  },
});

// Resolve historical membership from bounded, same-school period evidence. An
// inactive session without evidence must not inherit today's class by guesswork.
async function resolvePeriodClass(ctx: QueryCtx, args: {
  schoolId: Id<"schools">; studentId: Id<"students">; sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">; currentClassId: Id<"classes">; isActive: boolean;
  graduatingClassId?: Id<"classes">; graduatingSessionId?: Id<"academicSessions">;
  transferredOut?: boolean;
}) {
  const { schoolId, studentId, sessionId, termId } = args;
  const narrativeIssue = await issuedFor(ctx, { studentId, sessionId, termId });
  const gradedIssue = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q =>
    q.eq("studentId", studentId).eq("sessionId", sessionId).eq("termId", termId)).first();
  if (narrativeIssue && gradedIssue) throw new ConvexError("Conflicting issued reports");
  for (const row of [narrativeIssue, gradedIssue]) {
    if (row && (row.schoolId !== schoolId || row.studentId !== studentId || row.sessionId !== sessionId || row.termId !== termId))
      throw new ConvexError("Invalid report selection");
  }
  const issuedClass = narrativeIssue?.classId ?? gradedIssue?.classId;
  if (issuedClass) return { classId: issuedClass, narrativeIssue, gradedIssue };
  const [arrivals, departures, graduations, records, selections] = await Promise.all([
    ctx.db.query("studentPromotions").withIndex("by_student_and_to_session", q => q.eq("studentId", studentId).eq("toSessionId", sessionId)).take(101),
    ctx.db.query("studentPromotions").withIndex("by_student_and_from_session", q => q.eq("studentId", studentId).eq("fromSessionId", sessionId)).take(101),
    ctx.db.query("studentGraduations").withIndex("by_student_and_session", q => q.eq("studentId", studentId).eq("sessionId", sessionId)).take(101),
    ctx.db.query("assessmentRecords").withIndex("by_student_and_term", q => q.eq("schoolId", schoolId).eq("studentId", studentId).eq("sessionId", sessionId).eq("termId", termId)).take(101),
    ctx.db.query("studentSubjectSelections").withIndex("by_student_and_session", q => q.eq("studentId", studentId).eq("sessionId", sessionId)).take(101),
  ]);
  if ([arrivals, departures, graduations, records, selections].some(rows => rows.length > 100))
    throw new ConvexError("Enrollment history requires review");
  if ([...arrivals, ...departures, ...graduations, ...selections].some(row => row.schoolId !== schoolId))
    throw new ConvexError("Invalid enrollment history");
  const candidates = new Set([
    ...arrivals.map(row => row.toClassId), ...departures.map(row => row.fromClassId),
    ...graduations.map(row => row.classId), ...records.map(row => row.classId),
    ...selections.map(row => row.classId),
    ...(args.graduatingSessionId === sessionId && args.graduatingClassId ? [args.graduatingClassId] : []),
  ]);
  if (candidates.size > 1) throw new ConvexError("Enrollment history requires review");
  const classId = [...candidates][0] ?? ((args.isActive || args.transferredOut) ? args.currentClassId : null);
  return { classId, narrativeIssue, gradedIssue };
}

// Legacy staff links specify a pupil and period but no class. Return only the
// verified class and mode; never return draft contents through this selector.
export const getStaffPeriodReportMode = query({
  args: period,
  returns: v.union(v.object({ classId: v.id("classes"), mode: v.union(v.literal("graded"), v.literal("narrative")) }), v.null()),
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student || student.isArchived) throw new ConvexError("Student not found");
    const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId: student.schoolId, capability: "academic.report_cards.preview" });
    if (!auth.isSchoolAdmin && auth.role !== "teacher") throw new ConvexError("Staff access required");
    const [session, term] = await Promise.all([ctx.db.get(args.sessionId), ctx.db.get(args.termId)]);
    if (!session || session.schoolId !== auth.schoolId || !term || term.schoolId !== auth.schoolId || term.sessionId !== session._id)
      throw new ConvexError("Invalid report selection");
    const { classId, narrativeIssue, gradedIssue } = await resolvePeriodClass(ctx, {
      schoolId: auth.schoolId, studentId: student._id, sessionId: session._id, termId: term._id,
      currentClassId: student.classId, isActive: session.isActive,
      graduatingClassId: student.graduatingClassId, graduatingSessionId: student.graduatingSessionId,
      transferredOut: student.enrollmentStatus === "transferred_out",
    });
    if (!classId) return null;
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.schoolId !== auth.schoolId) throw new ConvexError("Invalid report selection");
    if (!auth.isSchoolAdmin) {
      const historical = await ctx.db.query("classSessionFormTeachers")
        .withIndex("by_class_and_session", q => q.eq("classId", classId).eq("sessionId", session._id)).unique();
      if (!(historical?.schoolId === auth.schoolId && historical.formTeacherId === auth.userId) &&
          !(await teacherHasClassAccess(ctx, auth.userId, auth.schoolId, classId)))
        throw new ConvexError("Not assigned to this class");
    }
    return { classId, mode: narrativeIssue ? "narrative" as const : gradedIssue ? "graded" as const :
      await modeFor(ctx, classId, session._id) ? "narrative" as const : "graded" as const };
  },
});

// Resolve before either the portal or staff touches a graded report builder.
export async function resolveAuthorizedPortalReportSelection(ctx: QueryCtx, args: {
  studentId: Id<"students">; sessionId: Id<"academicSessions">; termId: Id<"academicTerms">;
}) {
    const { student, schoolId, session, issued } = await portalSelection(ctx, args);
    const { classId, gradedIssue } = await resolvePeriodClass(ctx, {
      schoolId, studentId: student._id, sessionId: session._id, termId: args.termId,
      currentClassId: student.classId, isActive: session.isActive,
      graduatingClassId: student.graduatingClassId, graduatingSessionId: student.graduatingSessionId,
      transferredOut: student.enrollmentStatus === "transferred_out",
    });
    if (!classId) throw new ConvexError("Student has no enrollment in this session");
    const classDoc = await ctx.db.get(classId);
    if (!classDoc || classDoc.schoolId !== schoolId || issued && issued.classId !== classId)
      throw new ConvexError("Invalid report selection");
    return { classId, classDoc, mode: issued ? "narrative" as const : gradedIssue ? "graded" as const :
      await modeFor(ctx, classId, session._id) ? "narrative" as const : "graded" as const, issued };
}

export const getPortalReportSelection = query({
  args: period,
  returns: v.object({ mode: v.union(v.literal("graded"), v.literal("narrative")),
    classId: v.id("classes"), issued: v.union(portalIssuedValidator, v.null()) }),
  handler: async (ctx, args) => {
    const { classId, mode, issued } = await resolveAuthorizedPortalReportSelection(ctx, args);
    return { classId, mode, issued: issued ? { snapshot: issued.snapshot, issuedAt: issued.issuedAt } : null };
  },
});
