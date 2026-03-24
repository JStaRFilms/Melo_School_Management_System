import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";
import { validateGradingBands } from "@school/shared";

/**
 * Get active grading bands for a school
 * 
 * Authorization: authenticated user belonging to the school
 */
export const getActiveGradingBands = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("gradingBands"),
      _creationTime: v.number(),
      schoolId: v.id("schools"),
      minScore: v.number(),
      maxScore: v.number(),
      gradeLetter: v.string(),
      remark: v.string(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })
  ),
  handler: async (ctx: any) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx);

    const bands = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .collect();

    // Sort by minScore ascending
    return [...bands].sort((a: any, b: any) => a.minScore - b.minScore);
  },
});

/**
 * Save grading bands (admin only)
 * 
 * Validates bands, deactivates existing active bands, and inserts new active bands
 * 
 * Authorization: admin role only; user must belong to the target school
 */
export const saveGradingBands = mutation({
  args: {
    bands: v.array(
      v.object({
        minScore: v.number(),
        maxScore: v.number(),
        gradeLetter: v.string(),
        remark: v.string(),
      })
    ),
  },
  returns: v.array(v.id("gradingBands")),
  handler: async (ctx: any, args: { bands: any[] }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );

    // Verify admin access
    await assertAdminForSchool(ctx, userId, schoolId, role);

    // Validate bands (add isActive: true for validation)
    const bandsToValidate = args.bands.map((band) => ({
      ...band,
      schoolId,
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: userId,
    }));

    const validationErrors = validateGradingBands(bandsToValidate);
    if (validationErrors.length > 0) {
      throw new ConvexError(
        validationErrors.map((e) => e.message).join("; ")
      );
    }

    // Deactivate all existing active bands for this school
    const existingBands = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .collect();

    for (const band of existingBands) {
      await ctx.db.patch(band._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    // Insert new active bands
    const now = Date.now();
    const newBandIds: any[] = [];

    for (const band of args.bands) {
      const bandId = await ctx.db.insert("gradingBands", {
        schoolId,
        minScore: band.minScore,
        maxScore: band.maxScore,
        gradeLetter: band.gradeLetter,
        remark: band.remark,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
      });
      newBandIds.push(bandId);
    }

    return newBandIds;
  },
});
