import { ConvexError, v } from "convex/values";
import { query, type QueryCtx, type MutationCtx } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { getDerivedUmbrellaSubjectIdsForClass } from "./subjectAggregationHelpers";
import { isTrustedLegacySubjectIssuer, resolveTokenFirstTrustedLegacyRow } from "./identityResolver";
import { getContextCapabilities, isPermissionManaged, normalizeCapability, type PermissionCapability } from "./rbac";

/**
 * Get authenticated user and their school membership
 * 
 * @throws ConvexError "Unauthorized" if not authenticated
 * @throws ConvexError "School membership not found" if user has no school
 */
export async function getAuthenticatedSchoolMembership(
  ctx: QueryCtx | MutationCtx,
  options?: { allowSuspended?: boolean; schoolId?: Id<"schools">; capability?: PermissionCapability | readonly PermissionCapability[] }
): Promise<{
  userId: Id<"users">;
  schoolId: Id<"schools">;
  role: string;
  isSchoolAdmin: boolean;
  isSuspended: boolean;
}> {
  if (!(await ctx.auth.getUserIdentity())) throw new ConvexError("Unauthorized");
  const defaultUser = options?.schoolId ? null : await resolveLegacyViewer(ctx);
  const schoolId = options?.schoolId ?? defaultUser?.schoolId;
  if (!schoolId) throw new ConvexError("School membership not found");
  // allowSuspended is a legacy default-read exception, never a selected-branch bypass.
  const school = await ctx.db.get(schoolId);
  const isSuspended = school?.status === "suspended";
  const context = await resolveActiveMembership(ctx, schoolId, {
    allowSuspended: options?.allowSuspended === true && !options.schoolId,
  });
  if (context.isPlatformAdmin) throw new ConvexError("Forbidden: Platform governance does not authorize tenant operations");
  if (options?.capability && await isPermissionManaged(ctx, context)) {
    // Capability contracts become authoritative per migrated caller. Uncontracted
    // callers retain their existing domain checks until their migration is reviewed.
    const required = typeof options.capability === "string" ? [options.capability] : options.capability;
    const effective = await getContextCapabilities(ctx, context);
    if (!required.some(cap => effective.some(value => normalizeCapability(value) === normalizeCapability(cap))))
      throw new ConvexError("Forbidden: Required operation capability is missing");
  }
  const user = context.userId ? await ctx.db.get(context.userId) : null;
  if (!user) throw new ConvexError({ code: "RECONCILIATION_REQUIRED", message: "Reviewed legacy user mapping required" });
  if (user.isArchived) throw new ConvexError("Your account has been archived");

  return {
    userId: user._id,
    schoolId: user.schoolId,
    role: user.role,
    isSchoolAdmin: user.role === "admin" || user.isSchoolAdmin === true,
    isSuspended,
  };
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
  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId) {
    throw new ConvexError("Cross-school access denied");
  }

  if (user.role !== "admin" && user.isSchoolAdmin !== true) {
    throw new ConvexError("Admin access required");
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

export interface ActiveMembershipContext {
  personId?: Id<"persons">;
  membershipId?: Id<"branchMemberships">;
  schoolId: Id<"schools">;
  userId?: Id<"users">;
  role: string;
  isPlatformAdmin: boolean;
}

/** Exact token / trusted historical subject only. Never match contact data. */
export async function resolveLegacyViewer(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return resolveTokenFirstTrustedLegacyRow(identity, {
    byTokenIdentifier: async (token) => (await Promise.all([
      ctx.db.query("users").withIndex("by_auth_token_identifier_and_archived", (q) =>
        q.eq("authTokenIdentifier", token).eq("isArchived", undefined)).take(2),
      ctx.db.query("users").withIndex("by_auth_token_identifier_and_archived", (q) =>
        q.eq("authTokenIdentifier", token).eq("isArchived", false)).take(2),
    ])).flat(),
    bySubject: async (subject) => (await Promise.all([
      ctx.db.query("users").withIndex("by_auth_and_archived", (q) =>
        q.eq("authId", subject).eq("isArchived", undefined)).take(2),
      ctx.db.query("users").withIndex("by_auth_and_archived", (q) =>
        q.eq("authId", subject).eq("isArchived", false)).take(2),
    ])).flat(),
  });
}

export async function resolveActiveMembership(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  options?: { allowSuspended?: boolean }
): Promise<ActiveMembershipContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required" });
  const deny = (message: string): never => {
    throw new ConvexError({ code: "FORBIDDEN", message });
  };
  const reconcile = (message: string): never => {
    throw new ConvexError({ code: "RECONCILIATION_REQUIRED", message });
  };
  const school = await ctx.db.get(schoolId);
  if (!school) return deny("School workspace not found");
  let platformMatches = await ctx.db.query("platformAdmins")
    .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).take(2);
  if (platformMatches.length === 0 && isTrustedLegacySubjectIssuer(identity.issuer)) {
    const legacyPlatform = await ctx.db.query("platformAdmins")
      .withIndex("by_auth", q => q.eq("authId", identity.subject)).take(2);
    if (legacyPlatform.length > 1) return reconcile("Not authorized: ambiguous platform identity");
    platformMatches = legacyPlatform.filter(row => !row.authTokenIdentifier);
  }
  if (platformMatches.length > 1) return reconcile("Not authorized: ambiguous platform identity");
  if (platformMatches[0]) {
    if (!platformMatches[0].isActive) return deny("Platform account is inactive");
    // Identity context only. Tenant capability and legacy operation helpers reject Platform.
    return { schoolId, role: "super_admin", isPlatformAdmin: true };
  }
  if (school.status === "suspended" && !options?.allowSuspended) {
    throw new ConvexError({ code: "WORKSPACE_SUSPENDED", message: "This school workspace is currently suspended by platform administration" });
  }
  const persons = await ctx.db.query("persons")
    .withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).take(2);
  if (persons.length > 1) return reconcile("Not authorized: ambiguous canonical identity");
  const person = persons[0];
  if (person) {
    if (person.status !== "active") return deny("Canonical account is inactive");
    if (person.identityReconciliationState === "reconciliation_required") return reconcile("Identity reconciliation required");
    const memberships = await ctx.db.query("branchMemberships")
      .withIndex("by_person_and_school", (q) => q.eq("personId", person._id).eq("schoolId", schoolId)).take(2);
    if (memberships.length > 1) return reconcile("Not authorized: ambiguous branch membership");
    const membership = memberships[0];
    // Canonical presence is terminal: revocation or missing mapping cannot bridge back.
    if (!membership) return reconcile("Not authorized: User does not have an active membership in this branch; reviewed mapping required");
    if (membership.status !== "active") return deny("Not authorized: User does not have an active membership in this branch");
    const user = membership.legacyUserId ? await ctx.db.get(membership.legacyUserId) : null;
    if (membership.legacyUserId && (!user || user.schoolId !== schoolId ||
        (user.personId && user.personId !== person._id) ||
        (user.authTokenIdentifier && user.authTokenIdentifier !== identity.tokenIdentifier))) {
      return reconcile("Not authorized: mismatched legacy identity link");
    }
    if (user?.isArchived) return deny("Your account has been archived");
    return { personId: person._id, membershipId: membership._id, schoolId,
      userId: user?._id, role: user?.role ?? "member", isPlatformAdmin: false };
  }
  let user: Doc<"users"> | null;
  try {
    user = await resolveLegacyViewer(ctx);
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return reconcile(`Not authorized: ${String(error.data)}`);
  }
  if (!user || user.schoolId !== schoolId || user.isArchived) {
    return deny("Not authorized: User does not have an active membership in this branch");
  }
  if (user.personId) {
    const linkedPerson = await ctx.db.get(user.personId);
    if (
      !linkedPerson ||
      linkedPerson.status !== "active" ||
      linkedPerson.identityReconciliationState === "reconciliation_required" ||
      (linkedPerson.authTokenIdentifier &&
        linkedPerson.authTokenIdentifier !== identity.tokenIdentifier)
    ) {
      return reconcile("Not authorized: mismatched canonical identity link");
    }
    const memberships = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", linkedPerson._id).eq("schoolId", schoolId),
      )
      .take(2);
    if (memberships.length !== 1)
      return reconcile("Not authorized: ambiguous branch membership");
    const membership = memberships[0];
    if (membership.status !== "active")
      return deny("Not authorized: User does not have an active membership in this branch");
    if (membership.legacyUserId !== user._id)
      return reconcile("Not authorized: mismatched legacy identity link");
    return {
      personId: linkedPerson._id,
      membershipId: membership._id,
      schoolId,
      userId: user._id,
      role: user.role,
      isPlatformAdmin: false,
    };
  }
  return { schoolId, userId: user._id, role: user.role, isPlatformAdmin: false };
}

export const getActiveMembership = query({
  args: { schoolId: v.id("schools") },
  handler: (ctx, args) => resolveActiveMembership(ctx, args.schoolId),
});
