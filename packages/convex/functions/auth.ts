import { action, query, type QueryCtx } from "../_generated/server";
import { authComponent } from "../betterAuth";
import { createAuth } from "../betterAuth";
import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { WorkspaceAccessSummary } from "../../shared/src/workspace-access";
import { getAuthenticatedSchoolMembership, resolveActiveMembership, resolveLegacyViewer } from "./academic/auth";
import { CAPABILITY_CATALOG, getContextCapabilities, isPermissionManaged } from "./academic/rbac";
import { isTrustedLegacySubjectIssuer } from "./academic/identityResolver";

export const { getAuthUser } = authComponent.clientApi();

async function resolveViewerAccess(ctx: QueryCtx, requestedSchoolId?: Id<"schools">): Promise<WorkspaceAccessSummary> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { state: "unauthenticated" };
  try {
    // Preserve the historical default when available; never rewrite users.schoolId.
    const people = await ctx.db.query("persons")
      .withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).take(2);
    if (people.length > 1) return { state: "reconciliation_required", message: "Ambiguous canonical identity" };
    // Multiple branch projections can be valid for canonical users. Do not choose one arbitrarily.
    const legacyMatches = await ctx.db.query("users")
      .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).take(2);
    const legacy = people[0] && (legacyMatches.length > 1 ||
      (legacyMatches.length === 0 && !isTrustedLegacySubjectIssuer(identity.issuer)))
      ? null
      : await resolveLegacyViewer(ctx);
    let schoolId = requestedSchoolId ?? legacy?.schoolId;
    if (!schoolId && people[0]) {
      const memberships = await ctx.db.query("branchMemberships")
        .withIndex("by_person_and_status", (q) => q.eq("personId", people[0]._id).eq("status", "active")).take(101);
      const defaults = memberships.filter((membership) => membership.isDefaultBranch);
      if (memberships.length <= 100 && defaults.length === 1) schoolId = defaults[0].schoolId;
      else if (memberships.length === 1) schoolId = memberships[0].schoolId;
    }
    if (!schoolId) return { state: "reconciliation_required", message: "Select an explicitly reviewed branch membership" };
    const context = await resolveActiveMembership(ctx, schoolId);
    const school = await ctx.db.get(context.schoolId);
    if (!school) return { state: "forbidden", message: "School workspace unavailable" };
    const membership = context.membershipId ? await ctx.db.get(context.membershipId) : null;
    const user = context.userId ? await ctx.db.get(context.userId) : null;
    const isAdmin = user?.role === "admin" || user?.isSchoolAdmin === true;
    return {
      state: "ready",
      branch: { schoolId: school._id, name: school.name, slug: school.slug, status: school.status ?? "active" },
      membership: membership ? { membershipId: membership._id, personId: membership.personId, displayTitle: membership.displayTitle ?? null } : null,
      displayTitle: membership?.displayTitle ?? null,
      effectiveCapabilities: await getContextCapabilities(ctx, context),
      compatibility: {
        mode: context.isPlatformAdmin ? "platform" : membership ? "canonical" : "legacy_default",
        legacyUserId: user?._id ?? null,
        legacyRole: user?.role ?? null,
        legacyIsSchoolAdmin: isAdmin,
        adminParity: isAdmin ? "review_required" : "not_applicable",
        permissionManaged: await isPermissionManaged(ctx, context),
        legacyDefaultSchoolId: legacy?.schoolId ?? null,
      },
      teacherAssignments: { source: "domain_checks_required", legacyTeacherId: user?.role === "teacher" ? user._id : null },
    };
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    const data: unknown = error.data;
    const code = typeof data === "object" && data !== null && "code" in data ? data.code : null;
    if (code === "WORKSPACE_SUSPENDED") return { state: "suspended", message: "School workspace suspended" };
    if (code === "FORBIDDEN") return { state: "forbidden", message: "No active access to this workspace" };
    return { state: "reconciliation_required", message: "Identity or branch mapping requires review" };
  }
}

/** Single subscription for navigation/route gates. Does not authorize domain operations. */
export const getViewerAccess = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: (ctx, args) => resolveViewerAccess(ctx, args.schoolId),
});

/** Backward-compatible projection; default reads stay on the exact legacy default. */
export const getViewerContext = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    capability: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    legacyOperation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const access = await resolveViewerAccess(ctx, args.schoolId);
    if (access.state !== "ready" || !access.compatibility.legacyUserId) return null;
    if (!args.schoolId && access.compatibility.legacyDefaultSchoolId !== access.branch.schoolId) return null;
    const userId = ctx.db.normalizeId("users", access.compatibility.legacyUserId);
    const appUser = userId ? await ctx.db.get(userId) : null;
    if (!appUser || access.compatibility.mode === "platform") return null;
    if (args.capability && args.capabilities) throw new ConvexError("Choose one operation capability contract");
    const requestedCapabilities = args.capabilities ?? (args.capability ? [args.capability] : []);
    if (requestedCapabilities.length > 0) {
      const capabilities = requestedCapabilities.map((requested) => {
        const capability = CAPABILITY_CATALOG.find(cap => cap === requested);
        if (!capability) throw new ConvexError("Unknown operation capability");
        return capability;
      });
      await getAuthenticatedSchoolMembership(ctx, { schoolId: appUser.schoolId, capability: capabilities });
    } else if (args.legacyOperation) {
      await getAuthenticatedSchoolMembership(ctx, { schoolId: appUser.schoolId });
    }
    const identity = await ctx.auth.getUserIdentity();
    return {
      authUserId: identity?.subject,
      appUserId: appUser._id,
      email: appUser.email,
      name: appUser.name,
      role: appUser.role,
      isSchoolAdmin: appUser.role === "admin" || appUser.isSchoolAdmin === true,
      schoolId: appUser.schoolId,
    };
  },
});

export const getPlatformViewerContext = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    const platformAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth", (q: any) => q.eq("authId", authUser._id))
      .unique();

    if (!platformAdmin || !platformAdmin.isActive) {
      return null;
    }

    return {
      authUserId: authUser._id,
      appUserId: null,
      email: authUser.email,
      name: authUser.name,
      role: "platformAdmin",
      schoolId: null,
    };
  },
});

export const rotateKeysForStaticConfig = action({
  args: {},
  returns: v.array(
    v.object({
      publicKey: v.string(),
      privateKey: v.string(),
      createdAt: v.number(),
      id: v.string(),
      alg: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      crv: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    return await auth.api.rotateKeys();
  },
});
