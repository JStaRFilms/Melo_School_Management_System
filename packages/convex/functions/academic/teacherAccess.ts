import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { getDerivedUmbrellaSubjectIdsForClass } from "./subjectAggregationHelpers";

type TeacherAccessCtx = Pick<QueryCtx, "db">;

/**
 * Teacher assignment checks (consolidation P8). Extracted unchanged from
 * academic/auth.ts; auth.ts owns identity/membership, this module owns
 * teacher-to-class/subject authorization.
 *
 * Granularity policy (class vs class+subject):
 * - Score entry (assessmentRecords) uses the strict class+subject pair via
 *   assertTeacherAssignment: a teacher must own the exact pair to record.
 * - Report cards, extras, and enrollment use class-level teacherHasClassAccess:
 *   form teachers own the class but not every subject, so tightening those
 *   calls to pair level would block legitimate form-teacher reads/writes.
 * - Selectors and knowledge surfaces use the assignable-id listings.
 */
/**
 * Assert that a teacher is assigned to a class-subject pair
 *
 * @throws ConvexError "Not assigned to this class-subject" if no matching assignment
 */
export async function assertTeacherAssignment(
  ctx: TeacherAccessCtx,
  teacherId: Id<"users">,
  classId: Id<"classes">,
  subjectId: Id<"subjects">
): Promise<void> {
  const hasAssignment = await teacherHasClassSubjectAccess(
    ctx,
    teacherId,
    classId,
    subjectId
  );

  if (!hasAssignment) {
    throw new ConvexError("Not assigned to this class-subject");
  }
}

export async function getTeacherAssignableClassIds(
  ctx: TeacherAccessCtx,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Array<Id<"classes">>> {
  const linkedTeacherIds = await getLinkedTeacherIds(ctx, teacherId, schoolId);
  const teacherAssignments = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher", (q) => q.eq("teacherId", teacherId))
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();
  const schoolClasses = await ctx.db
    .query("classes")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();
  const schoolSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();

  const activeClassIds = new Set(
    schoolClasses
      .filter((classDoc) => !classDoc.isArchived)
      .map((classDoc) => String(classDoc._id))
  );
  const activeSubjectIds = new Set(
    schoolSubjects
      .filter((subject) => !subject.isArchived)
      .map((subject) => String(subject._id))
  );

  const classIds = new Set<string>();

  for (const assignment of teacherAssignments) {
    if (
      String(assignment.schoolId) === String(schoolId) &&
      linkedTeacherIds.has(String(assignment.teacherId)) &&
      activeClassIds.has(String(assignment.classId)) &&
      activeSubjectIds.has(String(assignment.subjectId))
    ) {
      classIds.add(String(assignment.classId));
    }
  }

  for (const offering of classOfferings) {
    if (
      activeClassIds.has(String(offering.classId)) &&
      activeSubjectIds.has(String(offering.subjectId)) &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
    ) {
      classIds.add(String(offering.classId));
    }
  }

  for (const classDoc of schoolClasses) {
    if (
      !classDoc.isArchived &&
      classDoc.formTeacherId &&
      linkedTeacherIds.has(String(classDoc.formTeacherId))
    ) {
      classIds.add(String(classDoc._id));
    }
  }

  return [...classIds] as Array<Id<"classes">>;
}

export async function getTeacherAssignableSubjectIds(
  ctx: TeacherAccessCtx,
  teacherId: Id<"users">,
  schoolId: Id<"schools">,
  classId: Id<"classes">
): Promise<Array<Id<"subjects">>> {
  const linkedTeacherIds = await getLinkedTeacherIds(ctx, teacherId, schoolId);
  const classDoc = await ctx.db.get(classId);
  if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
    return [];
  }
  const teacherAssignments = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher_and_class", (q) =>
      q.eq("teacherId", teacherId).eq("classId", classId)
    )
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  const schoolSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();

  const activeSubjectIds = new Set(
    schoolSubjects
      .filter((subject) => !subject.isArchived)
      .map((subject) => String(subject._id))
  );

  const subjectIds = new Set<string>();

  for (const assignment of teacherAssignments) {
    if (
      String(assignment.schoolId) === String(schoolId) &&
      linkedTeacherIds.has(String(assignment.teacherId)) &&
      activeSubjectIds.has(String(assignment.subjectId))
    ) {
      subjectIds.add(String(assignment.subjectId));
    }
  }

  for (const offering of classOfferings) {
    if (
      String(offering.schoolId) === String(schoolId) &&
      activeSubjectIds.has(String(offering.subjectId)) &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
    ) {
      subjectIds.add(String(offering.subjectId));
    }
  }

  const isFormTeacher =
    classDoc &&
    String(classDoc.schoolId) === String(schoolId) &&
    classDoc.formTeacherId &&
    linkedTeacherIds.has(String(classDoc.formTeacherId));

  if (isFormTeacher) {
    for (const offering of classOfferings) {
      if (
        String(offering.schoolId) === String(schoolId) &&
        activeSubjectIds.has(String(offering.subjectId))
      ) {
        subjectIds.add(String(offering.subjectId));
      }
    }
  }

  const derivedUmbrellaIds = await getDerivedUmbrellaSubjectIdsForClass(ctx, {
    schoolId,
    classId,
  });

  return [...subjectIds].filter(
    (subjectId) => !derivedUmbrellaIds.has(String(subjectId))
  ) as Array<Id<"subjects">>;
}

export async function teacherHasClassAccess(
  ctx: TeacherAccessCtx,
  teacherId: Id<"users">,
  schoolId: Id<"schools">,
  classId: Id<"classes">
): Promise<boolean> {
  const classIds = await getTeacherAssignableClassIds(ctx, teacherId, schoolId);

  return classIds.some((id) => String(id) === String(classId));
}

async function teacherHasClassSubjectAccess(
  ctx: TeacherAccessCtx,
  teacherId: Id<"users">,
  classId: Id<"classes">,
  subjectId: Id<"subjects">
): Promise<boolean> {
  const classDoc = await ctx.db.get(classId);
  const subjectDoc = await ctx.db.get(subjectId);
  if (
    !classDoc ||
    classDoc.isArchived ||
    !subjectDoc ||
    subjectDoc.isArchived ||
    subjectDoc.schoolId !== classDoc.schoolId
  ) {
    return false;
  }
  const schoolId = classDoc?.schoolId;
  const linkedTeacherIds = schoolId
    ? await getLinkedTeacherIds(ctx, teacherId, schoolId)
    : new Set<string>([String(teacherId)]);
  const assignment = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher_and_class_and_subject", (q) =>
      q
        .eq("teacherId", teacherId)
        .eq("classId", classId)
        .eq("subjectId", subjectId)
    )
    .unique();

  if (assignment && assignment.schoolId === schoolId && linkedTeacherIds.has(String(assignment.teacherId))) {
    return true;
  }

  if (
    classDoc &&
    !classDoc.isArchived &&
    classDoc.formTeacherId &&
    linkedTeacherIds.has(String(classDoc.formTeacherId))
  ) {
    const offering = await ctx.db
      .query("classSubjects")
      .withIndex("by_class_and_subject", (q) =>
        q.eq("classId", classId).eq("subjectId", subjectId)
      )
      .unique();

    if (offering && offering.schoolId === schoolId) {
      return true;
    }
  }

  const offering = await ctx.db
    .query("classSubjects")
    .withIndex("by_class_and_subject", (q) =>
      q.eq("classId", classId).eq("subjectId", subjectId)
    )
    .unique();

  return Boolean(
    offering &&
      offering.schoolId === schoolId &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
  );
}

async function getLinkedTeacherIds(
  ctx: TeacherAccessCtx,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Set<string>> {
  const teacher = await ctx.db.get(teacherId);
  // Branch projections must be explicitly selected by membership, not joined by email.
  return teacher && !teacher.isArchived && teacher.schoolId === schoolId
    ? new Set<string>([String(teacherId)])
    : new Set<string>();
}
