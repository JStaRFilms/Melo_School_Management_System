import type { Id } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";
import { CAPABILITY_CATALOG, type PermissionCapability } from "../rbac";

/** Explicit reviewed tenant role, never a Platform fixture acting as a proprietor. */
export async function seedReviewedTenantOperatorWithCapabilities(
  ctx: MutationCtx,
  schoolIds: Id<"schools">[],
  tokenIdentifier: string,
  capabilities: readonly PermissionCapability[],
  options?: { role?: "admin" | "teacher" },
) {
  const existing = await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", tokenIdentifier)).unique();
  const personId = existing?._id ?? await ctx.db.insert("persons", { authTokenIdentifier: tokenIdentifier, name: "Reviewed operator", email: "reviewed@test.invalid", status: "active", createdAt: 1, updatedAt: 1 });
  const roleTemplateId = await ctx.db.insert("roleTemplates", { name: "Reviewed scoped operator", code: `reviewed_${tokenIdentifier}`, scope: "global", capabilities: [...capabilities], isSystem: false, createdAt: 1, updatedAt: 1 });
  const memberships: { membershipId: Id<"branchMemberships">; userId: Id<"users">; schoolId: Id<"schools"> }[] = [];
  for (const schoolId of schoolIds) {
    const role = options?.role ?? "admin";
    const userId = await ctx.db.insert("users", { authId: tokenIdentifier, authTokenIdentifier: schoolIds.length === 1 ? tokenIdentifier : undefined, personId, schoolId, name: "Reviewed operator", email: "reviewed@test.invalid", role, isSchoolAdmin: role === "admin", createdAt: 1, updatedAt: 1 });
    const membershipId = await ctx.db.insert("branchMemberships", { personId, schoolId, legacyUserId: userId, status: "active", isDefaultBranch: !existing && memberships.length === 0, permissionsManagedAt: 1, joinedAt: 1, updatedAt: 1, auditModules: ["enrollment", "finance", "rbac", "assets", "audit"] });
    await ctx.db.insert("membershipRoleAssignments", { membershipId, roleTemplateId, assignedAt: 1 });
    memberships.push({ membershipId, userId, schoolId });
  }
  return { personId, roleTemplateId, memberships };
}

export async function seedReviewedTenantOperator(
  ctx: MutationCtx,
  schoolIds: Id<"schools">[],
  tokenIdentifier: string,
) {
  return seedReviewedTenantOperatorWithCapabilities(
    ctx,
    schoolIds,
    tokenIdentifier,
    CAPABILITY_CATALOG,
  );
}
