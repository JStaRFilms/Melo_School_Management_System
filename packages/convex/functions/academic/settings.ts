import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";

/**
 * Get the active school assessment settings
 * 
 * Authorization: authenticated user belonging to the school
 */
export const getSchoolAssessmentSettings = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("schoolAssessmentSettings"),
      _creationTime: v.number(),
      schoolId: v.id("schools"),
      examInputMode: v.union(
        v.literal("raw40"),
        v.literal("raw60_scaled_to_40")
      ),
      ca1Max: v.number(),
      ca2Max: v.number(),
      ca3Max: v.number(),
      examContributionMax: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    }),
    v.null()
  ),
  handler: async (ctx: any) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx);

    const settings = await ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .unique();

    return settings;
  },
});

/**
 * Save school assessment settings (admin only)
 * 
 * Deactivates existing active settings and inserts a new active one
 * 
 * Authorization: admin role only; user must belong to the target school
 */
export const saveSchoolAssessmentSettings = mutation({
  args: {
    examInputMode: v.union(
      v.literal("raw40"),
      v.literal("raw60_scaled_to_40")
    ),
  },
  returns: v.id("schoolAssessmentSettings"),
  handler: async (ctx: any, args: { examInputMode: string }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );

    // Verify admin access
    await assertAdminForSchool(ctx, userId, schoolId, role);

    // Deactivate all existing active settings for this school
    const existingSettings = await ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .collect();

    for (const setting of existingSettings) {
      await ctx.db.patch(setting._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    // Insert new active settings
    const now = Date.now();
    const newSettingsId = await ctx.db.insert("schoolAssessmentSettings", {
      schoolId,
      examInputMode: args.examInputMode,
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examContributionMax: 40,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    return newSettingsId;
  },
});
