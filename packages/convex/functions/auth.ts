import { action, query } from "../_generated/server";
import { authComponent } from "../betterAuth";
import { createAuth } from "../betterAuth";
import { v } from "convex/values";

export const { getAuthUser } = authComponent.clientApi();

export const getViewerContext = query({
  args: {},
  handler: async (ctx) => {
    const [authUser, identity] = await Promise.all([
      authComponent.safeGetAuthUser(ctx),
      ctx.auth.getUserIdentity(),
    ]);

    const authId = identity?.subject ?? authUser?._id;
    if (!authId && !authUser?.email) {
      return null;
    }

    let appUser = null;
    if (authId) {
      appUser = await ctx.db
        .query("users")
        .withIndex("by_auth", (q: any) => q.eq("authId", authId))
        .unique();
    }

    if (!appUser && authUser?.email) {
      console.warn(
        `[auth] Email fallback fired for ${authUser.email} — authId lookup failed. Review cross-school tenant isolation.`
      );
      appUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", authUser.email.toLowerCase()))
        .first();
    }

    if (!appUser || appUser.isArchived) {
      return null;
    }

    return {
      authUserId: authId,
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
