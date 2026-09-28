import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { getAuthenticatedSchoolMembership, assertAdminForSchool, resolveActiveMembership } from "./auth";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";

// Deliberately smaller than the transaction limit: a release must freeze every row
// in one transaction. Oversized or uncertain rosters need reviewed reconciliation.
const MAX_ROSTER = 80;
const MAX_SCHOOL_STUDENTS = 512;
const MAX_EVIDENCE = 512;
type Ctx = QueryCtx | MutationCtx;
type Tuple = {
  schoolId: Id<"schools">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  classId: Id<"classes">;
};
type Row = {
  studentId: Id<"students">;
  name: string;
  admissionNumber: string;
  status: "certified" | "blocked" | "excluded";
  reason: string | null;
  approvedBy: Id<"users"> | null;
  issuedReportCardId: Id<"issuedReportCards"> | null;
  // Changes to any evidence, including an ambiguous second class, invalidate review.
  evidence: string;
};

async function assertReadTuple(ctx: Ctx, tuple: Tuple) {
  const [school, session, term, klass] = await Promise.all([
    ctx.db.get(tuple.schoolId), ctx.db.get(tuple.sessionId), ctx.db.get(tuple.termId), ctx.db.get(tuple.classId),
  ]);
  if (!school || school.status !== "active" || !session || !term || !klass ||
      session.schoolId !== tuple.schoolId || term.schoolId !== tuple.schoolId ||
      klass.schoolId !== tuple.schoolId || term.sessionId !== session._id) {
    throw new ConvexError("Invalid class, session or term");
  }
  return { school, session, term, klass };
}

async function assertTuple(ctx: Ctx, tuple: Tuple) {
  const docs = await assertReadTuple(ctx, tuple);
  if (docs.session.isArchived || docs.term.isArchived || docs.klass.isArchived) {
    throw new ConvexError("Archived class, session or term");
  }
  return docs;
}

async function publicationFor(ctx: Ctx, tuple: Tuple) {
  const rows = await ctx.db.query("classResultPublications")
    .withIndex("by_school_and_session_and_term_and_class", q => q.eq("schoolId", tuple.schoolId)
      .eq("sessionId", tuple.sessionId).eq("termId", tuple.termId).eq("classId", tuple.classId)).take(2);
  if (rows.length > 1) throw new ConvexError("Conflicting releases require reconciliation");
  return rows[0] ?? null;
}

function bounded<T>(rows: T[], limit: number): T[] {
  if (rows.length > limit) throw new ConvexError("Roster exceeds atomic review limit; reconcile before release");
  return rows;
}

function validIssued(report: Doc<"issuedReportCards">, tuple: Tuple, studentId: Id<"students">) {
  const r = report.report;
  return report.schoolId === tuple.schoolId && report.studentId === studentId &&
    report.sessionId === tuple.sessionId && report.termId === tuple.termId && report.classId === tuple.classId &&
    r.student._id === studentId && r.classId === tuple.classId && r.certifiedAt === report.issuedAt &&
    r.gradingPolicy?.source === "snapshot" && r.gradingPolicy.version >= 1 && r.gradingPolicy.bands.length > 0 &&
    r.results.length > 0 && r.summary.totalSubjects > 0 && r.summary.pendingSubjects === 0 &&
    r.results.every(result => result.isRecorded &&
      (result.calculationMode !== "cumulative_annual" || result.isCumulativeComplete));
}

async function buildReadiness(ctx: Ctx, tuple: Tuple) {
  const { school, session, term, klass } = await assertTuple(ctx, tuple);
  const [students, promotions, selections, records, issued, exclusions] = await Promise.all([
    ctx.db.query("students").withIndex("by_school", q => q.eq("schoolId", tuple.schoolId)).take(MAX_SCHOOL_STUDENTS + 1),
    ctx.db.query("studentPromotions").withIndex("by_school", q => q.eq("schoolId", tuple.schoolId)).take(MAX_EVIDENCE + 1),
    ctx.db.query("studentSubjectSelections").withIndex("by_class_and_session", q => q.eq("classId", tuple.classId).eq("sessionId", tuple.sessionId)).take(MAX_EVIDENCE + 1),
    ctx.db.query("assessmentRecords").withIndex("by_sheet", q => q.eq("schoolId", tuple.schoolId).eq("sessionId", tuple.sessionId).eq("termId", tuple.termId).eq("classId", tuple.classId)).take(MAX_EVIDENCE + 1),
    ctx.db.query("issuedReportCards").withIndex("by_school", q => q.eq("schoolId", tuple.schoolId)).take(MAX_EVIDENCE + 1),
    ctx.db.query("classResultExclusions").withIndex("by_school_and_session_and_term_and_class", q => q.eq("schoolId", tuple.schoolId).eq("sessionId", tuple.sessionId).eq("termId", tuple.termId).eq("classId", tuple.classId)).take(MAX_ROSTER + 1),
  ]);
  bounded(students, MAX_SCHOOL_STUDENTS);
  bounded(promotions, MAX_EVIDENCE);
  bounded(selections, MAX_EVIDENCE);
  bounded(records, MAX_EVIDENCE);
  bounded(issued, MAX_EVIDENCE);
  bounded(exclusions, MAX_ROSTER);
  const candidates = new Set<Id<"students">>();
  for (const student of students) {
    // A current class assignment is only candidate evidence, not historical proof.
    if (session.isActive && student.classId === tuple.classId) candidates.add(student._id);
  }
  for (const promotion of promotions) {
    if (promotion.toSessionId === tuple.sessionId && promotion.toClassId === tuple.classId ||
        promotion.fromSessionId === tuple.sessionId && promotion.fromClassId === tuple.classId) candidates.add(promotion.studentId);
  }
  for (const selection of selections) if (selection.schoolId === tuple.schoolId) candidates.add(selection.studentId);
  for (const record of records) candidates.add(record.studentId);
  for (const report of issued) if (report.sessionId === tuple.sessionId && report.termId === tuple.termId && report.classId === tuple.classId) candidates.add(report.studentId);
  for (const exclusion of exclusions) candidates.add(exclusion.studentId);
  if (candidates.size > MAX_ROSTER) throw new ConvexError("Roster exceeds atomic review limit; reconcile before release");

  const rows: Row[] = [];
  for (const studentId of [...candidates].sort()) {
    const student = students.find(s => s._id === studentId);
    // Never omit missing, archived, withdrawn or cross-school candidate evidence.
    const ownPromotions = promotions.filter(p => p.studentId === studentId &&
      (p.toSessionId === tuple.sessionId || p.fromSessionId === tuple.sessionId));
    const ownSelections = bounded(await ctx.db.query("studentSubjectSelections")
      .withIndex("by_student_and_session", q => q.eq("studentId", studentId).eq("sessionId", tuple.sessionId)).take(MAX_EVIDENCE + 1), MAX_EVIDENCE);
    const ownRecords = bounded(await ctx.db.query("assessmentRecords")
      .withIndex("by_student_and_term", q => q.eq("schoolId", tuple.schoolId).eq("studentId", studentId).eq("sessionId", tuple.sessionId).eq("termId", tuple.termId)).take(MAX_EVIDENCE + 1), MAX_EVIDENCE);
    const termReports = bounded(await ctx.db.query("issuedReportCards")
      .withIndex("by_student_session_term", q => q.eq("studentId", studentId).eq("sessionId", tuple.sessionId).eq("termId", tuple.termId)).take(MAX_ROSTER + 1), MAX_ROSTER);
    const ownExclusions = exclusions.filter(e => e.studentId === studentId);
    const user = student ? await ctx.db.get(student.userId) : null;
    const classEvidence = new Set<string>([
      ...ownPromotions.filter(p => p.toSessionId === tuple.sessionId).map(p => String(p.toClassId)),
      ...ownPromotions.filter(p => p.fromSessionId === tuple.sessionId).map(p => String(p.fromClassId)),
      ...ownSelections.map(s => String(s.classId)),
      ...ownRecords.map(r => String(r.classId)),
      ...termReports.map(r => String(r.classId)),
    ]);
    // For an active session, an unpromoted current student with both session
    // enrollment and term assessment evidence can be proved for this class.
    const promotionProof = ownPromotions.some(p => p.schoolId === tuple.schoolId &&
      (p.toSessionId === tuple.sessionId && p.toClassId === tuple.classId ||
       p.fromSessionId === tuple.sessionId && p.fromClassId === tuple.classId));
    const enrollmentProof = ownSelections.some(s => s.schoolId === tuple.schoolId && s.classId === tuple.classId);
    const termProof = ownRecords.some(r => r.classId === tuple.classId);
    const currentProof = session.isActive && student?.classId === tuple.classId &&
      student.createdAt <= term.endDate && enrollmentProof && termProof;
    let reason: string | null = null;
    if (!student || student.schoolId !== tuple.schoolId) reason = "Student enrollment needs review";
    else if (classEvidence.size > 1 || ownPromotions.some(p => p.schoolId !== tuple.schoolId) ||
      ownSelections.some(s => s.schoolId !== tuple.schoolId) || termReports.some(r => r.schoolId !== tuple.schoolId)) reason = "Conflicting within-term class history";
    else if (!promotionProof && !currentProof) reason = "Historical enrollment needs review";
    else if (!termProof || !enrollmentProof) reason = "Missing term or subject enrollment evidence";
    else if (student.isArchived || student.enrollmentStatus === "withdrawn" ||
      student.enrollmentStatus === "transferred_out" || student.enrollmentStatus === "graduated") reason = "Enrollment status needs review";
    const matching = termReports.filter(r => r.classId === tuple.classId);
    if (!reason && matching.length !== 1) reason = matching.length ? "Conflicting report records" : "Report not certified";
    if (!reason && !validIssued(matching[0], tuple, studentId)) reason = "Certified report or historical grading policy needs review";
    if (ownExclusions.length > 1) reason = "Conflicting exclusions require review";
    // Exclusions can resolve a known missing certification or status, but never
    // a disputed class, tenant or absent enrollment proof.
    const unexcludable = !student || student.schoolId !== tuple.schoolId || classEvidence.size > 1 ||
      matching.length > 1 || (!promotionProof && !currentProof) || !enrollmentProof || !termProof || ownExclusions.length > 1;
    const exclusion = ownExclusions.length === 1 ? ownExclusions[0] : null;
    if (exclusion && unexcludable) reason = "Enrollment or exclusion needs review";
    const status: Row["status"] = exclusion && !unexcludable ? "excluded" : reason ? "blocked" : "certified";
    rows.push({ studentId, name: user?.name ?? student?.admissionNumber ?? "Unknown student", admissionNumber: student?.admissionNumber ?? "Unknown",
      status, reason: status === "excluded" ? exclusion!.reason : reason,
      approvedBy: status === "excluded" ? exclusion!.approvedBy : null,
      issuedReportCardId: status === "certified" ? matching[0]._id : null,
      evidence: JSON.stringify([student, ownPromotions, ownSelections, ownRecords, termReports, ownExclusions]),
    });
  }
  const eligibleCount = rows.filter(row => row.status !== "excluded").length;
  const certifiedCount = rows.filter(row => row.status === "certified").length;
  const excludedCount = rows.filter(row => row.status === "excluded").length;
  const ready = rows.length > 0 && certifiedCount > 0 && eligibleCount === certifiedCount;
  // This is an opaque equality token, not a secret: server recomputes inside release.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
    school, session, term, klass, rows,
  ])));
  const reviewKey = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return { rows, eligibleCount, certifiedCount, excludedCount, ready, reviewKey };
}

const tupleArgs = { sessionId: v.id("academicSessions"), termId: v.id("academicTerms"), classId: v.id("classes") };

// The Admin screen uses server-derived authority and selectors. Admin-only
// selectors elsewhere cannot serve exam officers with publish-final access.
export const getReleaseContext = query({
  args: {},
  handler: async (ctx) => {
    const { schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx, {
      capability: "academic.report_cards.preview",
    });
    await requireCapability(ctx, schoolId, "academic.report_cards.preview");
    let canRelease = false;
    try {
      await requireCapability(ctx, schoolId, "academic.report_cards.publish_final");
      canRelease = true;
    } catch { /* Read-only staff can still inspect readiness. */ }
    const [school, sessions, terms, classes] = await Promise.all([
      ctx.db.get(schoolId),
      ctx.db.query("academicSessions").withIndex("by_school", q => q.eq("schoolId", schoolId)).take(257),
      ctx.db.query("academicTerms").withIndex("by_school", q => q.eq("schoolId", schoolId)).take(257),
      ctx.db.query("classes").withIndex("by_school", q => q.eq("schoolId", schoolId)).take(257),
    ]);
    if (!school || sessions.length > 256 || terms.length > 256 || classes.length > 256)
      throw new ConvexError("Release selectors need review");
    return {
      schoolId, schoolName: school.name, canRelease, canExclude: role === "admin" || isSchoolAdmin,
      sessions: sessions.filter(s => !s.isArchived).map(s => ({ id: s._id, name: s.name })),
      terms: terms.filter(t => !t.isArchived).map(t => ({ id: t._id, sessionId: t.sessionId, name: t.name })),
      classes: classes.filter(c => !c.isArchived).map(c => ({ id: c._id, name: c.name })),
    };
  },
});

export const getClassReadiness = query({
  args: tupleArgs,
  handler: async (ctx, args) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.report_cards.preview" });
    await requireCapability(ctx, schoolId, "academic.report_cards.preview");
    const tuple = { ...args, schoolId };
    await assertTuple(ctx, tuple);
    const released = await publicationFor(ctx, tuple);
    if (released) {
      const [included, excluded] = await Promise.all([
        ctx.db.query("classResultPublicationStudents").withIndex("by_publication_and_student", q =>
          q.eq("publicationId", released._id)).take(MAX_ROSTER + 1),
        ctx.db.query("classResultExclusions").withIndex("by_school_and_session_and_term_and_class", q =>
          q.eq("schoolId", schoolId).eq("sessionId", args.sessionId).eq("termId", args.termId).eq("classId", args.classId)).take(MAX_ROSTER + 1),
      ]);
      bounded(included, MAX_ROSTER);
      bounded(excluded, MAX_ROSTER);
      const rows = await Promise.all([...included.map(i => ({ studentId: i.studentId,
        status: "certified" as const, reason: null as string | null, approvedBy: null as Id<"users"> | null })),
        ...excluded.map(e => ({ studentId: e.studentId, status: "excluded" as const,
          reason: e.reason as string | null, approvedBy: e.approvedBy as Id<"users"> | null }))]
        .map(async row => {
          const student = await ctx.db.get(row.studentId);
          const user = student ? await ctx.db.get(student.userId) : null;
          return { ...row, name: user?.name ?? student?.admissionNumber ?? "Unknown student",
            admissionNumber: student?.admissionNumber ?? "Unknown" };
        }));
      if (included.length !== released.eligibleCount || excluded.length !== released.excludedCount)
        throw new ConvexError("Frozen roster requires reconciliation");
      return { released, rows, eligibleCount: released.eligibleCount,
        certifiedCount: released.certifiedCount, excludedCount: released.excludedCount,
        ready: false, reviewKey: null };
    }
    const { rows, ...readiness } = await buildReadiness(ctx, tuple);
    // Evidence includes assessment and issued documents for the digest. It is
    // never part of the staff readiness payload, which contains no marks.
    return { released, ...readiness, rows: rows.map(({ evidence, issuedReportCardId, ...row }) => row) };
  },
});

export const excludeStudent = mutation({
  args: { ...tupleArgs, studentId: v.id("students"), reason: v.string() },
  handler: async (ctx, args) => {
    const { schoolId, userId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const tuple = { schoolId, sessionId: args.sessionId, termId: args.termId, classId: args.classId };
    await assertTuple(ctx, tuple);
    if (await publicationFor(ctx, tuple)) throw new ConvexError("Released roster cannot be changed");
    const reason = args.reason.trim();
    if (reason.length < 10 || reason.length > 500) throw new ConvexError("Provide a specific reason (10-500 characters)");
    const readiness = await buildReadiness(ctx, tuple);
    const row = readiness.rows.find(r => r.studentId === args.studentId);
    if (!row || row.status === "excluded" || row.reason === "Conflicting within-term class history" ||
      row.reason === "Historical enrollment needs review" || row.reason === "Enrollment or exclusion needs review" ||
      row.reason === "Missing term or subject enrollment evidence" || row.reason === "Student enrollment needs review") {
      throw new ConvexError("Student enrollment needs review before exclusion");
    }
    const actor = await resolveActiveMembership(ctx, schoolId);
    const approvedAt = Date.now();
    await ctx.db.insert("classResultExclusions", { ...tuple, studentId: args.studentId, reason, approvedBy: userId, approvedAt });
    await recordAuditEventHelper(ctx, { schoolId, actorKind: "user", actorPersonId: actor.personId,
      actorMembershipId: actor.membershipId, actorEmailSnapshot: role, module: "academic",
      action: "result_release.exclude", targetType: "students", targetId: args.studentId,
      outcome: "success", safeSummary: "Reasoned class result exclusion approved (reason stored on exclusion record)", alertTier: "tier1_critical" });
    return approvedAt;
  },
});

export const releaseClassResults = mutation({
  args: { ...tupleArgs, reviewedKey: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    const { schoolId, userId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.report_cards.publish_final" });
    const auth = await requireCapability(ctx, schoolId, "academic.report_cards.publish_final");
    const tuple = { schoolId, sessionId: args.sessionId, termId: args.termId, classId: args.classId };
    const { school, session, term, klass } = await assertTuple(ctx, tuple);
    const existing = await publicationFor(ctx, tuple);
    if (existing) {
      if (existing.reviewKey !== args.reviewedKey) throw new ConvexError("Already released with a different review");
      return existing;
    }
    if (args.confirmation !== "I reviewed this roster and understand that releasing it makes these reports visible to families.")
      throw new ConvexError("Confirm the reviewed release");
    const readiness = await buildReadiness(ctx, tuple);
    if (!readiness.ready || readiness.reviewKey !== args.reviewedKey) throw new ConvexError("Roster changed or is not ready; review again");
    const releasedAt = Date.now();
    const publicationId = await ctx.db.insert("classResultPublications", { ...tuple, releasedAt, releasedBy: userId,
      releasedByPersonId: auth.personId, releasedByMembershipId: auth.membershipId,
      reviewKey: readiness.reviewKey, eligibleCount: readiness.eligibleCount,
      certifiedCount: readiness.certifiedCount, excludedCount: readiness.excludedCount });
    for (const row of readiness.rows) {
      if (row.status === "certified" && row.issuedReportCardId) await ctx.db.insert("classResultPublicationStudents", {
        schoolId, publicationId, studentId: row.studentId, issuedReportCardId: row.issuedReportCardId,
      });
    }
    await recordAuditEventHelper(ctx, { schoolId, actorKind: "user", actorPersonId: auth.personId,
      actorMembershipId: auth.membershipId, actorEmailSnapshot: role, module: "academic",
      action: "result_release.publish", targetType: "classResultPublications", targetId: publicationId,
      outcome: "success", safeSummary: `Released ${school.name} / ${session.name} / ${term.name} / ${klass.name}: ${readiness.certifiedCount} certified, ${readiness.excludedCount} excluded`,
      alertTier: "tier1_critical" });
    return (await ctx.db.get(publicationId))!;
  },
});

/** B2 must authenticate portal membership and student access before calling this.
 * This helper returns only an exact, frozen, graded issued copy. It never builds drafts.
 * Narrative mode must be resolved separately before graded fallback. */
export async function getReleasedGradedReport(ctx: QueryCtx, tuple: Tuple & { studentId: Id<"students"> }) {
  try {
    // Archived historical tuples remain readable after release. Archival still
    // blocks a new release through assertTuple, but cannot unpublish a frozen one.
    await assertReadTuple(ctx, tuple);
    const student = await ctx.db.get(tuple.studentId);
    if (!student || student.schoolId !== tuple.schoolId || student.isArchived) return null;
    const release = await publicationFor(ctx, tuple);
    if (!release) return null;
    const included = await ctx.db.query("classResultPublicationStudents")
      .withIndex("by_publication_and_student", q => q.eq("publicationId", release._id).eq("studentId", tuple.studentId)).take(2);
    if (included.length !== 1 || included[0].schoolId !== tuple.schoolId) return null;
    // The frozen inclusion pins one issued copy. Draft evidence and later issued
    // rows cannot change which certified card this release exposes.
    const report = await ctx.db.get(included[0].issuedReportCardId);
    if (!report || !validIssued(report, tuple, tuple.studentId)) return null;
    return report;
  } catch {
    return null;
  }
}
