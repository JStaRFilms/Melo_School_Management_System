import { query } from "../_generated/server";
import { authComponent } from "../betterAuth";

export const { getAuthUser } = authComponent.clientApi();

export const getViewerContext = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_auth", (q: any) => q.eq("authId", authUser._id))
      .unique();

    if (!appUser) {
      return null;
    }

    return {
      authUserId: authUser._id,
      appUserId: appUser._id,
      email: authUser.email,
      name: authUser.name,
      role: appUser.role,
      schoolId: appUser.schoolId,
    };
  },
});
