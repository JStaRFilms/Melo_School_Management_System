import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAuthIdentityV1 } from "../foundation/auth";
import { requireGuardian } from "./helpers";

function verifiedAtFromAuthIdentity(rawIdentity: unknown) {
  const identity = rawIdentity as { emailVerified?: unknown; email_verified?: unknown } | null;
  return identity?.emailVerified === true || identity?.email_verified === true ? Date.now() : undefined;
}

const workspaceItemValidator = v.object({
  entitlementId: v.id("admissionsEntitlements"),
  state: v.string(),
  applicationPublicId: v.union(v.string(), v.null()),
  applicationState: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

/** Creates only the global prospective guardian record. Contact verification is supplied by the auth integration. */
export const getOrCreateIdentity = mutation({
  args: {},
  returns: v.object({ guardianId: v.id("admissionsGuardians"), status: v.string(), verificationRequired: v.boolean() }),
  handler: async (ctx) => {
    const identity = await requireAuthIdentityV1(ctx);
    const rawIdentity = await ctx.auth.getUserIdentity();
    const existing = await ctx.db.query("admissionsGuardians")
      .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).unique();
    const verifiedAt = verifiedAtFromAuthIdentity(rawIdentity);
    if (existing) {
      if (verifiedAt && !existing.emailVerifiedAt) {
        await ctx.db.patch(existing._id, { emailVerifiedAt: verifiedAt, updatedAt: verifiedAt });
      }
      return { guardianId: existing._id, status: existing.status, verificationRequired: !(existing.emailVerifiedAt || verifiedAt) };
    }

    const email = rawIdentity?.email?.trim().toLowerCase();
    if (!email) throw new ConvexError("Verification required");
    const now = Date.now();
    const guardianId = await ctx.db.insert("admissionsGuardians", {
      authTokenIdentifier: identity.tokenIdentifier,
      betterAuthUserId: identity.subject,
      normalizedEmail: email,
      status: "active",
      ...(verifiedAt ? { emailVerifiedAt: verifiedAt } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { guardianId, status: "active", verificationRequired: !verifiedAt };
  },
});

export const listWorkspace = query({
  args: { schoolId: v.id("schools"), limit: v.optional(v.number()) },
  returns: v.array(workspaceItemValidator),
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const entitlements = await ctx.db.query("admissionsEntitlements")
      .withIndex("by_guardian_and_state_and_created_at", (q) => q.eq("guardianId", guardian._id))
      .order("desc").take(100);
    const rows = [];
    for (const entitlement of entitlements) {
      if (entitlement.schoolId !== args.schoolId || rows.length >= limit) continue;
      const application = entitlement.applicationId ? await ctx.db.get(entitlement.applicationId) : null;
      rows.push({
        entitlementId: entitlement._id,
        state: entitlement.state,
        applicationPublicId: application?.publicId ?? null,
        applicationState: application?.state ?? null,
        updatedAt: application?.updatedAt ?? entitlement.updatedAt,
      });
    }
    return rows;
  },
});
