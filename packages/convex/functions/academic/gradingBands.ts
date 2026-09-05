import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import { validateGradingBands } from "@school/shared/exam-recording";

export interface GradingBandItem {
  _id?: string;
  gradeLetter: string;
  minScore: number;
  maxScore: number;
  gradePoints: number;
  remark: string;
  colorHex: string;
  luminanceContrast: number;
  isDefaultPreset?: boolean;
}

/**
 * Immutable Factory Preset Standard Defaults (H1 / MX-06)
 * A: 75-100, B: 65-74, C: 50-64, D: 45-49, E: 40-44, F: 0-39
 */
export const FACTORY_DEFAULT_GRADING_BANDS: readonly GradingBandItem[] = [
  {
    gradeLetter: "A",
    minScore: 75,
    maxScore: 100,
    gradePoints: 4.0,
    remark: "Excellent",
    colorHex: "#065f46", // Emerald
    luminanceContrast: 7.2,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "B",
    minScore: 65,
    maxScore: 74,
    gradePoints: 3.0,
    remark: "Very Good",
    colorHex: "#1e40af", // Royal Blue
    luminanceContrast: 8.1,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "C",
    minScore: 50,
    maxScore: 64,
    gradePoints: 2.0,
    remark: "Good",
    colorHex: "#92400e", // Amber
    luminanceContrast: 5.4,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "D",
    minScore: 45,
    maxScore: 49,
    gradePoints: 1.0,
    remark: "Fair Pass",
    colorHex: "#9a3412", // Burnt Orange
    luminanceContrast: 4.9,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "E",
    minScore: 40,
    maxScore: 44,
    gradePoints: 0.5,
    remark: "Pass",
    colorHex: "#7c2d12", // Deep Bronze
    luminanceContrast: 6.2,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "F",
    minScore: 0,
    maxScore: 39,
    gradePoints: 0.0,
    remark: "Fail",
    colorHex: "#991b1b", // Rose / Crimson
    luminanceContrast: 6.8,
    isDefaultPreset: true,
  },
] as const;

/**
 * ITU-R BT.709 relative luminance calculation
 */
export function calculateRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return 0.2;
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Contrast ratio against pure white (#ffffff, L = 1.0)
 * (L1 + 0.05) / (L2 + 0.05)
 */
export function calculateContrastAgainstWhite(hex: string): number {
  const lum = calculateRelativeLuminance(hex);
  const ratio = (1.0 + 0.05) / (lum + 0.05);
  return Math.round(ratio * 10) / 10;
}

/**
 * Validates that score ranges are contiguous, non-overlapping, and span 0 to 100.
 */
export function validateContiguousScoreRanges(
  bands: Array<{ minScore: number; maxScore: number; gradeLetter: string }>
): void {
  if (!bands || bands.length === 0) {
    throw new ConvexError("Grading bands array cannot be empty");
  }

  for (const b of bands) {
    if (!b.gradeLetter || b.gradeLetter.trim() === "") {
      throw new ConvexError("Grade letter cannot be empty");
    }
    if (b.minScore < 0 || b.maxScore > 100) {
      throw new ConvexError(
        `Score range for ${b.gradeLetter} must be within 0 to 100`
      );
    }
    if (b.minScore > b.maxScore) {
      throw new ConvexError(
        `minScore (${b.minScore}) cannot be greater than maxScore (${b.maxScore}) for grade ${b.gradeLetter}`
      );
    }
  }

  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);

  if (sorted[0].minScore !== 0) {
    throw new ConvexError(
      `Grading bands must start at score 0 (currently starts at ${sorted[0].minScore})`
    );
  }

  if (sorted[sorted.length - 1].maxScore !== 100) {
    throw new ConvexError(
      `Grading bands must end at score 100 (currently ends at ${sorted[sorted.length - 1].maxScore})`
    );
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.maxScore >= next.minScore) {
      throw new ConvexError(
        `Overlapping score range between ${current.gradeLetter} (${current.minScore}-${current.maxScore}) and ${next.gradeLetter} (${next.minScore}-${next.maxScore})`
      );
    }
    if (next.minScore !== current.maxScore + 1) {
      throw new ConvexError(
        `Gap detected in score range between ${current.gradeLetter} (max ${current.maxScore}) and ${next.gradeLetter} (min ${next.minScore}). Score ranges must be contiguous.`
      );
    }
  }
}

/**
 * Get grading bands for a school.
 * Returns custom branch bands or factory standard defaults with luminance-safe colors.
 */
export const getGradingBands = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const bands = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true)
      )
      .collect();

    if (bands.length === 0) {
      return [...FACTORY_DEFAULT_GRADING_BANDS];
    }

    // Sort descending by minScore (A to F)
    return bands
      .map((b) => ({
        _id: b._id,
        gradeLetter: b.gradeLetter,
        minScore: b.minScore,
        maxScore: b.maxScore,
        gradePoints: b.gradePoints ?? 0,
        remark: b.remark,
        colorHex: b.colorHex ?? b.color ?? "#000000",
        luminanceContrast:
          b.luminanceContrast ??
          calculateContrastAgainstWhite(b.colorHex ?? b.color ?? "#000000"),
        isDefaultPreset: false,
      }))
      .sort((a, b) => b.minScore - a.minScore);
  },
});

/**
 * Update grading bands for a school.
 * Validates contiguous score ranges (0 to 100), enforces academic.grading.manage capability,
 * and logs an append-only audit event.
 */
export const updateGradingBands = mutation({
  args: {
    schoolId: v.id("schools"),
    bands: v.array(
      v.object({
        gradeLetter: v.string(),
        minScore: v.number(),
        maxScore: v.number(),
        gradePoints: v.optional(v.number()),
        remark: v.string(),
        colorHex: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Capability check
    const authContext = await requireCapability(
      ctx,
      args.schoolId,
      "academic.grading.manage"
    );

    // 2. Score range validation
    validateContiguousScoreRanges(args.bands);

    // 3. Deactivate existing active bands for this school
    const existing = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true)
      )
      .collect();

    const now = Date.now();
    for (const b of existing) {
      await ctx.db.patch(b._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    // 4. Resolve acting user ID
    let userId = authContext.userId;
    if (!userId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
        .first();
      if (user) {
        userId = user._id;
      } else {
        userId = await ctx.db.insert("users", {
          schoolId: args.schoolId,
          authId: `sys_${now}`,
          email: "admin@system.local",
          name: "System Admin",
          role: "admin",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 5. Insert new active bands
    const insertedIds = [];
    for (const band of args.bands) {
      const color = band.colorHex ?? "#065f46";
      const contrast = calculateContrastAgainstWhite(color);
      const bandId = await ctx.db.insert("gradingBands", {
        schoolId: args.schoolId,
        minScore: band.minScore,
        maxScore: band.maxScore,
        gradeLetter: band.gradeLetter,
        remark: band.remark,
        gradePoints: band.gradePoints ?? 0,
        colorHex: color,
        color,
        luminanceContrast: contrast,
        isActive: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
      });
      insertedIds.push(bandId);
    }

    // 6. Record audit event
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "academic",
      action: "grading_bands.update",
      targetType: "gradingBands",
      targetId: args.schoolId,
      outcome: "success",
      safeSummary: `Updated grading bands for school (${args.bands.length} bands)`,
      alertTier: "tier3_info",
    });

    return insertedIds;
  },
});

/**
 * Backward compatibility: Get active grading bands for current session's school
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
 * Backward compatibility: Save grading bands (admin only)
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

    await assertAdminForSchool(ctx, userId, schoolId, role);

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
