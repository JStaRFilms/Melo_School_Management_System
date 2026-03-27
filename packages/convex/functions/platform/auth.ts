import { ConvexError, v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

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

  const platformAdmin = await ctx.db
    .query("platformAdmins")
    .withIndex("by_auth", (q: any) => q.eq("authId", identity.subject))
    .unique();

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
