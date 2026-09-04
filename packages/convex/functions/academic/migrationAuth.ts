import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { resolveTokenFirstTrustedLegacyRow } from "./identityResolver";

export type MigrationCtx = QueryCtx | MutationCtx;

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
  ctx: MigrationCtx,
  schoolId: Id<"schools">
): Promise<MigrationAuthContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }

  // 1. Check the platform super-admin row through the shared fail-closed
  // token-first resolver. Subject compatibility is trusted-issuer only.
  const platformAdmin = await resolveTokenFirstTrustedLegacyRow(identity, {
    byTokenIdentifier: (tokenIdentifier) =>
      ctx.db
        .query("platformAdmins")
        .withIndex("by_auth_token_identifier", (q) =>
          q.eq("authTokenIdentifier", tokenIdentifier)
        )
        .take(2),
    bySubject: (subject) =>
      ctx.db
        .query("platformAdmins")
        .withIndex("by_auth", (q) => q.eq("authId", subject))
        .take(2),
  });

  if (platformAdmin) {
    if (!platformAdmin.isActive) {
      throw new ConvexError("Platform admin account is inactive");
    }
    return {
      callerId: platformAdmin._id,
      platformAdminId: platformAdmin._id,
      isSuperAdmin: true,
      role: "super_admin",
      email: platformAdmin.email,
    };
  }

  // 2. Resolve school users with the exact same identity rules.
  const user = await resolveTokenFirstTrustedLegacyRow(identity, {
    byTokenIdentifier: (tokenIdentifier) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_token_identifier", (q) =>
          q.eq("authTokenIdentifier", tokenIdentifier)
        )
        .take(2),
    bySubject: (subject) =>
      ctx.db
        .query("users")
        .withIndex("by_auth", (q) => q.eq("authId", subject))
        .take(2),
  });

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

/**
 * Resolves a schema-valid Id<"users"> actor for tables that require a user creator/updater
 * (e.g. families, familyMembers, assessmentRecords).
 * If caller is a school admin, returns their user ID.
 * If caller is a platform super admin, resolves an active school admin or creates a system migration actor.
 */
export async function resolveSchoolAdminActorId(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  auth: MigrationAuthContext
): Promise<Id<"users">> {
  if (auth.userId) {
    return auth.userId;
  }

  // Look for active school lead admin or any active admin in this school
  const activeAdmins = await ctx.db
    .query("users")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(50);

  const existingAdmin = activeAdmins.find(
    (u) => !u.isArchived && (u.role === "admin" || u.isSchoolAdmin === true)
  );
  if (existingAdmin) {
    return existingAdmin._id;
  }

  const existingUser = activeAdmins.find((u) => !u.isArchived);
  if (existingUser) {
    return existingUser._id;
  }

  // Create a system migration actor for the target school if no users exist
  const now = Date.now();
  const school = await ctx.db.get(schoolId);
  const schoolSlug = school?.slug ?? "school";
  const systemActorId = await ctx.db.insert("users", {
    schoolId,
    authId: `system_migration_${schoolId}_${now}`,
    name: "System Migration Admin",
    email: `migration-system@${schoolSlug}.local`,
    role: "admin",
    isSchoolAdmin: true,
    createdAt: now,
    updatedAt: now,
  });

  return systemActorId;
}
