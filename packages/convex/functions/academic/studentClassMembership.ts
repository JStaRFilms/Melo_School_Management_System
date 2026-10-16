import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { ConvexError } from "convex/values";
import { isCurrentEnrollment } from "./studentEnrollmentCounts";

export async function studentPeriodClasses(
  ctx: QueryCtx | MutationCtx,
  args: { student: Doc<"students">; sessionId: Id<"academicSessions">; termId?: Id<"academicTerms"> },
): Promise<Id<"classes">[]> {
  const [periods, session, term] = await Promise.all([
    ctx.db.query("studentEnrollmentPeriods").withIndex("by_student", q => q.eq("studentId", args.student._id)).take(201),
    ctx.db.get(args.sessionId),
    args.termId ? ctx.db.get(args.termId) : null,
  ]);
  if (periods.length > 200) throw new ConvexError("Enrollment history requires review");
  if (!session || session.schoolId !== args.student.schoolId || (term && (term.schoolId !== session.schoolId || term.sessionId !== session._id))) return [];
  const start = new Date(term?.startDate ?? session.startDate).toISOString().slice(0, 10);
  const end = new Date(term?.endDate ?? session.endDate).toISOString().slice(0, 10);
  return [...new Set(periods.filter(period => period.schoolId === args.student.schoolId &&
    // Unknown starts attest only their recorded context, never a guessed prior session.
    (period.startDay ? period.startDay <= end && (!period.endDay || period.endDay > start) :
      period.sessionId === session._id && (!term || !period.termId || period.termId === term._id))
  ).map(period => period.classId))];
}

export async function isStudentPromotionSupersededByDeparture(
  ctx: QueryCtx | MutationCtx, promotion: Doc<"studentPromotions">,
): Promise<boolean> {
  const revision = promotion.enrollmentRevision;
  if (revision === undefined) return false;
  const staged = await ctx.db.query("studentEnrollmentEvents").withIndex("by_student_revision", q =>
    q.eq("studentId", promotion.studentId).eq("revision", revision)).unique();
  const period = staged?.periodId ? await ctx.db.get(staged.periodId) : null;
  const departure = period?.closedByEventId ? await ctx.db.get(period.closedByEventId) : null;
  if (!departure || departure.schoolId !== promotion.schoolId || departure.studentId !== promotion.studentId ||
      departure.revision <= revision || departure.afterStatus === "active") return false;
  const [departureSession, targetSession] = await Promise.all([
    departure.sessionId ? ctx.db.get(departure.sessionId) : null, ctx.db.get(promotion.toSessionId),
  ]);
  // Compare recorded academic contexts, not today's revision or wall clock.
  // A later activation cannot fulfil a promotion after its participation period closed.
  return !departureSession || departureSession.schoolId !== promotion.schoolId ||
    !!(targetSession?.schoolId === promotion.schoolId && targetSession.startDate > departureSession.startDate);
}

async function studentPromotionContext(
  ctx: QueryCtx | MutationCtx,
  args: { student: Doc<"students">; schoolId: Id<"schools">; sessionId: Id<"academicSessions"> },
) {
  const promotions = await ctx.db.query("studentPromotions")
    .withIndex("by_student_and_to_session", q => q.eq("studentId", args.student._id).eq("toSessionId", args.sessionId)).take(101);
  if (promotions.length > 100) throw new ConvexError("Enrollment history requires review");
  const promotion = promotions.filter(entry => entry.schoolId === args.schoolId)
    .sort((left, right) => right.createdAt - left.createdAt || right._creationTime - left._creationTime)[0];
  // Departure clears the current pointer, but not the latest reviewed opening.
  const period = args.student.currentEnrollmentPeriodId ? await ctx.db.get(args.student.currentEnrollmentPeriodId) :
    !isCurrentEnrollment(args.student) ? await ctx.db.query("studentEnrollmentPeriods")
      .withIndex("by_student", q => q.eq("studentId", args.student._id)).order("desc").first() : null;
  const openingEvent = period?.openedByEventId ? await ctx.db.get(period.openedByEventId) : null;
  const supersededByDeparture = promotion ? await isStudentPromotionSupersededByDeparture(ctx, promotion) : false;
  const promotionStillCurrent = !supersededByDeparture && (!openingEvent || openingEvent.type === "admitted" ||
    openingEvent.type === "imported" || (promotion?.enrollmentRevision ?? 0) >= openingEvent.revision);
  return { promotion, period, promotionStillCurrent, supersededByDeparture };
}

export async function isStudentEnrolledInClassForSession(
  ctx: QueryCtx | MutationCtx,
  args: {
    student: Doc<"students">;
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
    termId?: Id<"academicTerms">;
    currentOperation?: boolean;
  },
) {
  if (args.student.schoolId !== args.schoolId || args.student.isArchived ||
      (args.currentOperation && !isCurrentEnrollment(args.student))) return false;

  const { promotion, period: latestReturn, promotionStillCurrent, supersededByDeparture } = await studentPromotionContext(ctx, args);
  if (args.currentOperation) {
    if (promotion && promotionStillCurrent) return promotion.toClassId === args.classId;
    return args.student.classId === args.classId;
  }
  const classes = await studentPeriodClasses(ctx, args);
  if (classes.includes(args.classId)) return true;
  const requestedPeriod = args.termId ? await ctx.db.get(args.termId) : await ctx.db.get(args.sessionId);
  const startsAfterReturn = latestReturn?.startDay && requestedPeriod && new Date(requestedPeriod.startDate).toISOString().slice(0, 10) >= latestReturn.startDay;
  if (promotion && !supersededByDeparture && (!startsAfterReturn || promotionStillCurrent)) return promotion.toClassId === args.classId;
  if (args.student.enrollmentRevision !== undefined) {
    // New history cannot borrow a returning student's present class for older dates.
    const [records, selections] = await Promise.all([
      ctx.db.query("assessmentRecords").withIndex("by_student_and_session", q => q.eq("schoolId", args.schoolId).eq("studentId", args.student._id).eq("sessionId", args.sessionId)).take(201),
      ctx.db.query("studentSubjectSelections").withIndex("by_student_and_session", q => q.eq("studentId", args.student._id).eq("sessionId", args.sessionId)).take(201),
    ]);
    if (records.length > 200 || selections.length > 200) throw new ConvexError("Enrollment history requires review");
    return records.some(record => record.classId === args.classId && (!args.termId || record.termId === args.termId)) ||
      (!(supersededByDeparture && promotion?.toClassId === args.classId) &&
        selections.some(selection => selection.schoolId === args.schoolId && selection.classId === args.classId));
  }
  return args.student.classId === args.classId;
}

export async function getStudentClassForSession(
  ctx: QueryCtx | MutationCtx,
  args: { student: Doc<"students">; schoolId: Id<"schools">; sessionId: Id<"academicSessions"> },
): Promise<Id<"classes">> {
  const { promotion, promotionStillCurrent } = await studentPromotionContext(ctx, args);
  if (promotion && promotionStillCurrent) {
    return promotion.toClassId;
  }

  return args.student.classId;
}
