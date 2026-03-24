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
  const assignment = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher_and_class_and_subject", (q: any) =>
      q
        .eq("teacherId", teacherId)
        .eq("classId", classId)
        .eq("subjectId", subjectId)
    )
    .unique();

  if (!assignment) {
    throw new ConvexError("Not assigned to this class-subject");
  }
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
