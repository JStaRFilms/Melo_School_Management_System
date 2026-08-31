import { ConvexError } from "convex/values";
import { Id } from "../../_generated/dataModel";

export interface MigrationAuthContext {
  callerId: Id<"users"> | Id<"platformAdmins">;
  userId?: Id<"users">;
  platformAdminId?: Id<"platformAdmins">;
  isSuperAdmin: boolean;
  role: string;
  email: string;
}

/**
 * Asserts that the authenticated caller has permission to perform migration operations
 * on the specified school.
 * 
 * Permitted callers:
 * 1. Active Platform Super Admin (`platformAdmins` table) targeting any school.
 * 2. Active School Admin (`users` table) belonging to the target `schoolId`.
 * 
 * @throws ConvexError "Unauthorized" if unauthenticated
 * @throws ConvexError "Cross-school access denied" if school admin attempts cross-school access
 * @throws ConvexError "Admin access required" if school user is not an admin
 */
export async function assertMigrationAccess(
  ctx: any,
  schoolId: Id<"schools">
): Promise<MigrationAuthContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }

  // 1. Check Platform Super Admin
  const platformAdmin = await ctx.db
    .query("platformAdmins")
    .withIndex("by_auth", (q: any) => q.eq("authId", identity.subject))
    .unique();

  if (platformAdmin && platformAdmin.isActive) {
    return {
      callerId: platformAdmin._id,
      platformAdminId: platformAdmin._id,
      isSuperAdmin: true,
      role: "super_admin",
      email: platformAdmin.email,
    };
  }

  // 2. Check School Admin
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth", (q: any) => q.eq("authId", identity.subject))
    .unique();

  if (!user) {
    throw new ConvexError("Unauthorized");
  }

  if (user.isArchived) {
    throw new ConvexError("Your account has been archived");
  }

  if (user.schoolId !== schoolId) {
    throw new ConvexError("Cross-school access denied");
  }

  const isSchoolAdmin = user.role === "admin" || user.isSchoolAdmin === true;
  if (!isSchoolAdmin) {
    throw new ConvexError("Admin access required");
  }

  return {
    callerId: user._id,
    userId: user._id,
    isSuperAdmin: false,
    role: "school_admin",
    email: user.email,
  };
}
