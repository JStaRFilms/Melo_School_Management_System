import { ConvexError } from "convex/values";
import { Id } from "../../_generated/dataModel";

/**
 * Get authenticated user and their school membership
 * 
 * @throws ConvexError "Unauthorized" if not authenticated
 * @throws ConvexError "School membership not found" if user has no school
 */
export async function getAuthenticatedSchoolMembership(
  ctx: any
): Promise<{ userId: Id<"users">; schoolId: Id<"schools">; role: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }

  // Look up user by auth ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth", (q: any) => q.eq("authId", identity.subject))
    .unique();

  if (!user) {
    throw new ConvexError("School membership not found");
  }

  if (user.isArchived) {
    throw new ConvexError("Your account has been archived");
  }

  return {
    userId: user._id,
    schoolId: user.schoolId,
    role: user.role,
  };
}

/**
 * Assert that a teacher is assigned to a class-subject pair
 * 
 * @throws ConvexError "Not assigned to this class-subject" if no matching assignment
 */
export async function assertTeacherAssignment(
  ctx: any,
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
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Array<Id<"classes">>> {
  const linkedTeacherIds = await getLinkedTeacherIds(ctx, teacherId, schoolId);
  const teacherAssignments = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher", (q: any) => q.eq("teacherId", teacherId))
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();
  const schoolClasses = await ctx.db
    .query("classes")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();
  const schoolSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  const activeClassIds = new Set(
    schoolClasses
      .filter((classDoc: any) => !classDoc.isArchived)
      .map((classDoc: any) => String(classDoc._id))
  );
  const activeSubjectIds = new Set(
    schoolSubjects
      .filter((subject: any) => !subject.isArchived)
      .map((subject: any) => String(subject._id))
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
  ctx: any,
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
    .withIndex("by_teacher_and_class", (q: any) =>
      q.eq("teacherId", teacherId).eq("classId", classId)
    )
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_class", (q: any) => q.eq("classId", classId))
    .collect();
  const schoolSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  const activeSubjectIds = new Set(
    schoolSubjects
      .filter((subject: any) => !subject.isArchived)
      .map((subject: any) => String(subject._id))
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

  return [...subjectIds] as Array<Id<"subjects">>;
}

export async function teacherHasClassAccess(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">,
  classId: Id<"classes">
): Promise<boolean> {
  const classIds = await getTeacherAssignableClassIds(ctx, teacherId, schoolId);

  return classIds.some((id) => String(id) === String(classId));
}

async function teacherHasClassSubjectAccess(
  ctx: any,
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
    subjectDoc.isArchived
  ) {
    return false;
  }
  const schoolId = classDoc?.schoolId;
  const linkedTeacherIds = schoolId
    ? await getLinkedTeacherIds(ctx, teacherId, schoolId)
    : new Set<string>([String(teacherId)]);
  const assignment = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher_and_class_and_subject", (q: any) =>
      q
        .eq("teacherId", teacherId)
        .eq("classId", classId)
        .eq("subjectId", subjectId)
    )
    .unique();

  if (assignment) {
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
      .withIndex("by_class_and_subject", (q: any) =>
        q.eq("classId", classId).eq("subjectId", subjectId)
      )
      .unique();

    if (offering) {
      return true;
    }
  }

  const offering = await ctx.db
    .query("classSubjects")
    .withIndex("by_class_and_subject", (q: any) =>
      q.eq("classId", classId).eq("subjectId", subjectId)
    )
    .unique();

  return Boolean(
    offering &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
  );
}

async function getLinkedTeacherIds(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Set<string>> {
  const teacherIds = new Set<string>([String(teacherId)]);
  const currentTeacher = await ctx.db.get(teacherId);

  if (!currentTeacher?.email || currentTeacher.isArchived) {
    return teacherIds;
  }

  const schoolUsers = await ctx.db
    .query("users")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  for (const user of schoolUsers) {
    if (
      user.role === "teacher" &&
      !user.isArchived &&
      typeof user.email === "string" &&
      user.email.toLowerCase() === currentTeacher.email.toLowerCase()
    ) {
      teacherIds.add(String(user._id));
    }
  }

  return teacherIds;
}

/**
 * Assert that user is an admin for the specified school
 * 
 * @throws ConvexError "Admin access required" if user role is not admin
 * @throws ConvexError "Cross-school access denied" if user.schoolId !== schoolId
 */
export async function assertAdminForSchool(
  ctx: any,
  userId: Id<"users">,
  schoolId: Id<"schools">,
  role: string
): Promise<void> {
  if (role !== "admin") {
    throw new ConvexError("Admin access required");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId) {
    throw new ConvexError("Cross-school access denied");
  }
}

/**
 * Assert that user belongs to the specified school
 * 
 * @throws ConvexError "Cross-school access denied" if user.schoolId !== schoolId
 */
export async function assertSchoolBoundary(
  ctx: any,
  userId: Id<"users">,
  schoolId: Id<"schools">
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId) {
    throw new ConvexError("Cross-school access denied");
  }
}
