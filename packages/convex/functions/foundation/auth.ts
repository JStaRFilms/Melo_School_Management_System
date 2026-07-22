import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import type { AdmissionsPermissionV1 } from "@school/shared";
import {
  admissionsPermissionValidator,
  capabilityGrantProjectionValidator,
} from "./contracts";

type FoundationReadCtx = QueryCtx | MutationCtx;

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
export async function requireAuthIdentityV1(ctx: FoundationReadCtx): Promise<AuthIdentityV1> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthorized");

  return {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
    issuer: identity.issuer,
  };
}

export async function resolveActiveSchoolMembershipsV1(
  ctx: FoundationReadCtx,
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
  ctx: FoundationReadCtx,
  schoolId: Id<"schools">
): Promise<ActiveSchoolMembershipV1 | null> {
  const identity = await requireAuthIdentityV1(ctx);
  const memberships = await resolveActiveSchoolMembershipsV1(ctx, identity);
  return memberships.find((membership) => membership.schoolId === schoolId) ?? null;
}

export type CapabilityGrantProjectionV1 = {
  capability: AdmissionsPermissionV1;
  scope: "school" | "programme" | "intake";
  programmeId: Id<"admissionsProgrammes"> | null;
  intakeId: Id<"admissionsIntakes"> | null;
};

export type CapabilityTargetScopeV1 = {
  programmeId?: Id<"admissionsProgrammes">;
  intakeId?: Id<"admissionsIntakes">;
};

export async function resolveSchoolCapabilitiesV1(
  ctx: FoundationReadCtx,
  membership: ActiveSchoolMembershipV1,
  now = Date.now()
): Promise<CapabilityGrantProjectionV1[]> {
  const grants = await ctx.db
    .query("schoolCapabilityGrants")
    .withIndex("by_school_and_user", (q) =>
      q.eq("schoolId", membership.schoolId).eq("userId", membership.userId)
    )
    .take(100);

  return grants
    .filter((grant) => !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now))
    .map((grant) => ({
      capability: grant.capability as AdmissionsPermissionV1,
      scope: grant.scope,
      programmeId: grant.programmeId ?? null,
      intakeId: grant.intakeId ?? null,
    }));
}

/**
 * Default-deny capability check. A scoped grant only authorizes the matching
 * programme/intake; it is never promoted to a school-wide permission.
 */
export async function hasSchoolCapabilityV1(
  ctx: FoundationReadCtx,
  membership: ActiveSchoolMembershipV1,
  capability: AdmissionsPermissionV1,
  target: CapabilityTargetScopeV1 = {},
  now = Date.now()
): Promise<boolean> {
  if (target.programmeId) {
    const programme = await ctx.db.get(target.programmeId);
    if (!programme || programme.schoolId !== membership.schoolId) return false;
  }

  if (target.intakeId) {
    const intake = await ctx.db.get(target.intakeId);
    if (!intake || intake.schoolId !== membership.schoolId) return false;
    if (target.programmeId && intake.programmeId !== target.programmeId) return false;
  }

  const grants = await resolveSchoolCapabilitiesV1(ctx, membership, now);
  return grants.some((grant) => {
    if (grant.capability !== capability) return false;
    if (grant.scope === "school") return true;
    if (grant.scope === "programme") {
      return Boolean(target.programmeId && grant.programmeId === target.programmeId);
    }
    return Boolean(target.intakeId && grant.intakeId === target.intakeId);
  });
}

export async function requireSchoolCapabilityV1(
  ctx: FoundationReadCtx,
  membership: ActiveSchoolMembershipV1,
  capability: AdmissionsPermissionV1,
  target: CapabilityTargetScopeV1 = {},
  now = Date.now()
): Promise<void> {
  if (!(await hasSchoolCapabilityV1(ctx, membership, capability, target, now))) {
    throw new ConvexError("Not found or access denied");
  }
}

export const hasViewerCapability = query({
  args: {
    schoolId: v.id("schools"),
    capability: admissionsPermissionValidator,
    programmeId: v.union(v.id("admissionsProgrammes"), v.null()),
    intakeId: v.union(v.id("admissionsIntakes"), v.null()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const membership = await resolveSchoolMembershipV1(ctx, args.schoolId);
    if (!membership) return false;
    return await hasSchoolCapabilityV1(ctx, membership, args.capability, {
      ...(args.programmeId ? { programmeId: args.programmeId } : {}),
      ...(args.intakeId ? { intakeId: args.intakeId } : {}),
    });
  },
});

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
    capabilities: v.array(capabilityGrantProjectionValidator),
  }),
  handler: async (ctx, args) => {
    const membership = await resolveSchoolMembershipV1(ctx, args.schoolId);
    if (!membership) return { membership: null, capabilities: [] };

    const capabilities = await resolveSchoolCapabilitiesV1(ctx, membership);
    return { membership, capabilities };
  },
});
