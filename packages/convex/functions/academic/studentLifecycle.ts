import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { adjustSchoolEnrollmentCount, isCurrentEnrollment } from "./studentEnrollmentCounts";

type Status = NonNullable<Doc<"students">["enrollmentStatus"]>;
type EventType = Doc<"studentEnrollmentEvents">["type"];
type Context = Pick<Doc<"studentEnrollmentEvents">, "classId" | "className" | "sessionId" | "sessionName" | "termId" | "termName">;

export function assertStudentParticipating(student: Doc<"students">): void {
  if (!isCurrentEnrollment(student)) {
    throw new ConvexError("Student is inactive. Use enrollment return controls before current participation.");
  }
}

export function effectiveStudentDay(day: string | undefined, now = Date.now()): string {
  const today = new Date(now).toISOString().slice(0, 10);
  const value = day ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value) {
    throw new ConvexError("Effective date must be a valid calendar day in YYYY-MM-DD format");
  }
  if (value > today) throw new ConvexError("Future enrollment dates are not supported");
  return value;
}

export async function currentStudentLifecycleContext(
  ctx: QueryCtx | MutationCtx, schoolId: Id<"schools">, classId: Id<"classes">,
): Promise<Context> {
  const [classDoc, sessions, terms] = await Promise.all([
    ctx.db.get(classId),
    ctx.db.query("academicSessions").withIndex("by_school_active", q => q.eq("schoolId", schoolId).eq("isActive", true)).take(2),
    ctx.db.query("academicTerms").withIndex("by_school_active", q => q.eq("schoolId", schoolId).eq("isActive", true)).take(2),
  ]);
  const availableSessions = sessions.filter(session => !session.isArchived);
  const availableTerms = terms.filter(term => !term.isArchived);
  if (availableSessions.length > 1 || availableTerms.length > 1) {
    throw new ConvexError("Academic context is ambiguous. Review the active session and term setup.");
  }
  const session = availableSessions[0];
  const term = availableTerms[0]?.sessionId === session?._id ? availableTerms[0] : undefined;
  return {
    classId,
    ...(classDoc?.schoolId === schoolId ? { className: classDoc.name } : {}),
    ...(session ? { sessionId: session._id, sessionName: session.name } : {}),
    ...(term ? { termId: term._id, termName: term.name } : {}),
  };
}

export async function assertNoOpenStudentTransfer(ctx: MutationCtx, studentId: Id<"students">): Promise<void> {
  for (const status of ["initiated", "source_released"] as const) {
    const open = await ctx.db.query("studentTransfers")
      .withIndex("by_student_and_status", q => q.eq("studentId", studentId).eq("status", status)).first();
    if (open) throw new ConvexError("Resolve the open governed transfer before changing enrollment");
  }
}

/** State, period, immutable evidence and initialized headcount commit together. */
export async function recordStudentEnrollmentEvent(
  ctx: MutationCtx,
  student: Doc<"students">,
  args: {
    type: EventType;
    afterStatus?: Status;
    effectiveDay?: string;
    unknownStart?: "import_unknown";
    reason: string;
    actorUserId?: Id<"users">;
    operationKey?: string;
    intentFingerprint?: string;
    context?: Context;
    subjectIds?: Id<"subjects">[];
    graduation?: Doc<"studentEnrollmentEvents">["graduation"];
    promotion?: Pick<Doc<"studentEnrollmentEvents">, "promotionFromClassId" | "promotionFromSessionId" | "promotionToClassId" | "promotionToSessionId">;
    transferId?: Id<"studentTransfers">;
    isArchived?: boolean;
  },
): Promise<{ eventId: Id<"studentEnrollmentEvents">; revision: number; status: Status; periodId: Id<"studentEnrollmentPeriods"> | null }> {
  const now = Date.now();
  const day = args.unknownStart ? undefined : effectiveStudentDay(args.effectiveDay, now);
  const before = student.enrollmentStatus ?? "active";
  const after = args.afterStatus ?? before;
  const revision = (student.enrollmentRevision ?? 0) + 1;
  const context = args.context ?? await currentStudentLifecycleContext(ctx, student.schoolId, student.classId);
  const opening = ["admitted", "imported", "re_enrol", "reinstate", "graduation_corrected", "transfer_in"].includes(args.type) ||
    (args.type === "transfer_reversed" && after === "active");
  const closing = before === "active" && after !== "active";
  const participationChange = opening || before !== after;
  if (participationChange && day && student.enrollmentEffectiveDay && day < student.enrollmentEffectiveDay) {
    throw new ConvexError("Effective date precedes the latest enrollment action");
  }
  let periodId = student.currentEnrollmentPeriodId;
  if (periodId) {
    const period = await ctx.db.get(periodId);
    if (!period || period.studentId !== student._id || period.schoolId !== student.schoolId || period.closedByEventId) {
      throw new ConvexError("Enrollment period is inconsistent. Reviewed repair required.");
    }
  }
  if (opening) {
    if (periodId) throw new ConvexError("Student already has an open enrollment period");
    periodId = await ctx.db.insert("studentEnrollmentPeriods", {
      schoolId: student.schoolId, studentId: student._id,
      startDay: day, startProvenance: args.unknownStart ?? "recorded", recordedAt: now,
      ...context, ...(args.subjectIds ? { subjectIds: args.subjectIds } : {}),
    });
  } else if (before === "active" && !periodId && args.type !== "archive" && args.type !== "restore") {
    // Database creation time is not a historical joining date. Staged promotion is not today's placement.
    const legacyContext = args.type === "promote" ? await currentStudentLifecycleContext(ctx, student.schoolId, student.classId) : context;
    const sessionId = legacyContext.sessionId;
    const selections = sessionId ? await ctx.db.query("studentSubjectSelections")
      .withIndex("by_student_and_class_and_session", q => q.eq("studentId", student._id).eq("classId", student.classId).eq("sessionId", sessionId)).take(201) : [];
    if (selections.length > 200) throw new ConvexError("Subject history requires review");
    periodId = await ctx.db.insert("studentEnrollmentPeriods", {
      schoolId: student.schoolId, studentId: student._id,
      startProvenance: "legacy_unknown", recordedAt: now, ...legacyContext,
      subjectIds: selections.map(selection => selection.subjectId),
    });
  }
  const eventId = await ctx.db.insert("studentEnrollmentEvents", {
    schoolId: student.schoolId, studentId: student._id, type: args.type,
    ...(args.type === "admitted" || args.type === "imported" || args.type === "transfer_in" ? {} : { beforeStatus: before }),
    afterStatus: after, revision, effectiveDay: day, recordedAt: now,
    reason: args.reason, actorUserId: args.actorUserId,
    operationKey: args.operationKey ?? `system:${revision}:${args.type}`,
    intentFingerprint: args.intentFingerprint, periodId, transferId: args.transferId,
    ...context, ...(args.subjectIds ? { subjectIds: args.subjectIds } : {}),
    ...(args.graduation ? { graduation: args.graduation } : {}),
    ...args.promotion,
  });
  if (periodId && opening) await ctx.db.patch(periodId, { openedByEventId: eventId });
  if (periodId && closing) await ctx.db.patch(periodId, { endDay: day, closedByEventId: eventId });
  await ctx.db.patch(student._id, {
    enrollmentStatus: after, enrollmentRevision: revision,
    ...(participationChange && day ? { enrollmentEffectiveDay: day } : {}),
    currentEnrollmentPeriodId: closing ? undefined : periodId,
    ...(args.isArchived !== undefined ? { isArchived: args.isArchived } : {}), updatedAt: now,
  });
  await adjustSchoolEnrollmentCount(ctx, student.schoolId,
    Number(isCurrentEnrollment({ enrollmentStatus: after, isArchived: args.isArchived ?? student.isArchived })) - Number(isCurrentEnrollment(student)));
  return { eventId, revision, status: after, periodId: periodId ?? null };
}
