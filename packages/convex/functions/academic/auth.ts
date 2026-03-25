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
  const teacherAssignments = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher", (q: any) => q.eq("teacherId", teacherId))
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  const classIds = new Set<string>();

  for (const assignment of teacherAssignments) {
    if (String(assignment.schoolId) === String(schoolId)) {
      classIds.add(String(assignment.classId));
    }
  }

  for (const offering of classOfferings) {
    if (
      offering.teacherId &&
      String(offering.teacherId) === String(teacherId)
    ) {
      classIds.add(String(offering.classId));
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

  const subjectIds = new Set<string>();

  for (const assignment of teacherAssignments) {
    if (String(assignment.schoolId) === String(schoolId)) {
      subjectIds.add(String(assignment.subjectId));
    }
  }

  for (const offering of classOfferings) {
    if (
      String(offering.schoolId) === String(schoolId) &&
      offering.teacherId &&
      String(offering.teacherId) === String(teacherId)
    ) {
      subjectIds.add(String(offering.subjectId));
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

  const offering = await ctx.db
    .query("classSubjects")
    .withIndex("by_class_and_subject", (q: any) =>
      q.eq("classId", classId).eq("subjectId", subjectId)
    )
    .unique();

  return Boolean(
    offering &&
      offering.teacherId &&
      String(offering.teacherId) === String(teacherId)
  );
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
