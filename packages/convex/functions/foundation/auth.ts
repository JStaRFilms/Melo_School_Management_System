import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import type { AdmissionsPermissionV1 } from "@school/shared";
import { admissionsPermissionValidator } from "./contracts";

export type AuthIdentityV1 = {
  tokenIdentifier: string;
  subject: string;
  issuer: string;
};

export type ActiveSchoolMembershipV1 = {
  userId: Id<"users">;
  schoolId: Id<"schools">;
  role: string;
  isSchoolAdmin: boolean;
};

/**
 * Canonical auth identity resolver. `tokenIdentifier` is the sole ownership
 * key for new records; subject fallback is read-only compatibility for existing
 * Better Auth membership rows until an explicit production backfill is approved.
 */
export async function requireAuthIdentityV1(ctx: QueryCtx): Promise<AuthIdentityV1> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthorized");

  return {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    issuer: identity.issuer,
  };
}

export async function resolveActiveSchoolMembershipsV1(
  ctx: QueryCtx,
  identity: AuthIdentityV1
): Promise<ActiveSchoolMembershipV1[]> {
  const canonical = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier)
    )
    .take(100);

  // Compatibility mode only: existing rows have Better Auth's user id in authId.
  // Never write this fallback to a new ownership record implicitly.
  const rows = canonical.length > 0
    ? canonical
    : await ctx.db
      .query("users")
      .withIndex("by_auth", (q) => q.eq("authId", identity.subject))
      .take(100);

  return rows
    .filter((row) => !row.isArchived)
    .map((row) => ({
      userId: row._id,
      schoolId: row.schoolId,
      role: row.role,
      isSchoolAdmin: row.role === "admin" || row.isSchoolAdmin === true,
    }));
}

export async function resolveSchoolMembershipV1(
  ctx: QueryCtx,
  schoolId: Id<"schools">
): Promise<ActiveSchoolMembershipV1 | null> {
  const identity = await requireAuthIdentityV1(ctx);
  const memberships = await resolveActiveSchoolMembershipsV1(ctx, identity);
  return memberships.find((membership) => membership.schoolId === schoolId) ?? null;
}

export async function resolveSchoolCapabilitiesV1(
  ctx: QueryCtx,
  membership: ActiveSchoolMembershipV1,
  now = Date.now()
): Promise<AdmissionsPermissionV1[]> {
  const grants = await ctx.db
    .query("schoolCapabilityGrants")
    .withIndex("by_school_and_user", (q) =>
      q.eq("schoolId", membership.schoolId).eq("userId", membership.userId)
    )
    .take(100);

  return grants
    .filter((grant) => !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now))
    .map((grant) => grant.capability as AdmissionsPermissionV1);
}

export const getViewerCapabilities = query({
  args: { schoolId: v.id("schools") },
  returns: v.object({
    membership: v.union(
      v.null(),
      v.object({
        userId: v.id("users"),
        schoolId: v.id("schools"),
        role: v.string(),
        isSchoolAdmin: v.boolean(),
      })
    ),
    capabilities: v.array(admissionsPermissionValidator),
  }),
  handler: async (ctx, args) => {
    const membership = await resolveSchoolMembershipV1(ctx, args.schoolId);
    if (!membership) return { membership: null, capabilities: [] };

    const capabilities = await resolveSchoolCapabilitiesV1(ctx, membership);
    return { membership, capabilities };
  },
});
