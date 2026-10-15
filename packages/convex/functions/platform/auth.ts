import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { Id, type Doc } from "../../_generated/dataModel";
import { resolveTokenFirstTrustedLegacyRow } from "../academic/identityResolver";

/**
 * Get authenticated platform admin identity.
 *
 * Resolves the signed-in Better Auth identity, maps it to the
 * `platformAdmins` table, and rejects inactive admins.
 *
 * @throws ConvexError "Unauthorized" if not authenticated
 * @throws ConvexError "Platform admin access required" if not a platform admin
 * @throws ConvexError "Platform admin account is inactive" if admin is inactive
 */
export async function getAuthenticatedPlatformAdmin(
  ctx: any
): Promise<{ adminId: Id<"platformAdmins">; authId: string; email: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }

  // Canonical subject-vs-token rule (consolidation P6): the token identifier
  // wins; subject fallback accepts only unlinked rows from a trusted issuer.
  // A subject-only lookup accepted a different admin than the token holder.
  const platformAdmin = await resolveTokenFirstTrustedLegacyRow<Doc<"platformAdmins">>(identity, {
    byTokenIdentifier: async (tokenIdentifier) =>
      ctx.db
        .query("platformAdmins")
        .withIndex("by_auth_token_identifier", (q: any) =>
          q.eq("authTokenIdentifier", tokenIdentifier),
        )
        .take(2),
    bySubject: async (authId) =>
      ctx.db
        .query("platformAdmins")
        .withIndex("by_auth", (q: any) => q.eq("authId", authId))
        .take(2),
  });

  if (!platformAdmin) {
    throw new ConvexError("Platform admin access required");
  }

  if (!platformAdmin.isActive) {
    throw new ConvexError("Platform admin account is inactive");
  }

  return {
    adminId: platformAdmin._id,
    authId: platformAdmin.authId,
    email: platformAdmin.email,
  };
}

/**
 * Check if an auth ID belongs to an active platform admin.
 * Returns null if not a platform admin.
 */
export async function resolvePlatformAdmin(
  ctx: any,
  authId: string
): Promise<{ adminId: Id<"platformAdmins">; email: string } | null> {
  const platformAdmin = await ctx.db
    .query("platformAdmins")
    .withIndex("by_auth", (q: any) => q.eq("authId", authId))
    .unique();

  if (!platformAdmin || !platformAdmin.isActive) {
    return null;
  }

  return {
    adminId: platformAdmin._id,
    email: platformAdmin.email,
  };
}

export const requirePlatformAdminInternal = internalQuery({
  args: {},
  returns: v.object({
    adminId: v.id("platformAdmins"),
    authId: v.string(),
    email: v.string(),
  }),
  handler: async (ctx) => {
    return await getAuthenticatedPlatformAdmin(ctx);
  },
});

/** Link one reviewed bootstrap operator to this deployment's auth issuer. */
export const reconcilePlatformAdminIdentity = internalMutation({
  args: {
    platformAdminId: v.id("platformAdmins"),
    expectedAuthId: v.string(),
    expectedEmail: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.platformAdminId);
    if (
      !admin || !admin.isActive || admin.authId !== args.expectedAuthId ||
      admin.email.trim().toLowerCase() !== args.expectedEmail.trim().toLowerCase() ||
      admin.authTokenIdentifier
    ) {
      throw new ConvexError("Platform identity requires reviewed reconciliation");
    }

    const issuer = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
    if (!issuer) throw new ConvexError("Authentication issuer is not configured");
    const matches = await ctx.db.query("platformAdmins")
      .withIndex("by_auth", (q) => q.eq("authId", admin.authId)).take(2);
    if (matches.length !== 1 || matches[0]._id !== admin._id) {
      throw new ConvexError("Platform identity is ambiguous");
    }
    const tokenIdentifier = `${issuer}|${admin.authId}`;
    const linked = await ctx.db.query("platformAdmins")
      .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", tokenIdentifier))
      .first();
    if (linked) throw new ConvexError("Platform identity is already linked");

    await ctx.db.patch(admin._id, { authTokenIdentifier: tokenIdentifier, updatedAt: Date.now() });
    return null;
  },
});
