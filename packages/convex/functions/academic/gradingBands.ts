import { ACADEMIC_CONTEXT_CAPABILITIES } from "../../../shared/src/workspace-capability-matrix";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
  getAuthenticatedSchoolMembership,
  resolveActiveMembership,
} from "./auth";
import { requireCapability } from "./rbac";
import { requireGroupOwner } from "./groupSettings";
import { recordAuditEventHelper } from "./audit";
import {
  FACTORY_DEFAULT_GRADING_BANDS,
  isGradeHex,
  gradeDisplayColor,
} from "@school/shared/exam-recording";
import {
  calculateContrastRatio,
  calculateLuminance,
  hexToRgb,
} from "@school/shared/theme";
export { FACTORY_DEFAULT_GRADING_BANDS } from "@school/shared/exam-recording";
export type { GradingBandItem } from "@school/shared/exam-recording";

type Context = QueryCtx | MutationCtx;
export const gradingBandInput = v.object({
  gradeLetter: v.string(),
  minScore: v.number(),
  maxScore: v.number(),
  gradePoints: v.optional(v.number()),
  remark: v.string(),
  colorHex: v.optional(v.string()),
});
type BandInput = {
  gradeLetter: string;
  minScore: number;
  maxScore: number;
  gradePoints?: number;
  remark: string;
  colorHex?: string;
};
export function calculateRelativeLuminance(hex: string): number {
  const rgb = isGradeHex(hex) ? hexToRgb(hex) : null;
  return rgb ? calculateLuminance(rgb) : 0.2;
}
export function calculateContrastAgainstWhite(hex: string): number {
  return Math.round(calculateContrastRatio(hex, "#ffffff") * 10) / 10;
}
export function validateContiguousScoreRanges(
  bands: Array<{ minScore: number; maxScore: number; gradeLetter: string }>,
): void {
  if (!bands.length || bands.length > 100)
    throw new ConvexError("Use 1–100 grading bands");
  const labels = new Set<string>();
  for (const band of bands) {
    const label = band.gradeLetter.trim().toUpperCase();
    if (!label || labels.has(label))
      throw new ConvexError("Grade labels must be nonempty and unique");
    labels.add(label);
    if (
      !Number.isInteger(band.minScore) ||
      !Number.isInteger(band.maxScore) ||
      band.minScore < 0 ||
      band.maxScore > 100 ||
      band.minScore > band.maxScore
    )
      throw new ConvexError(
        "Score ranges must be whole numbers within 0 to 100",
      );
  }
  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  if (sorted[0].minScore !== 0 || sorted[sorted.length - 1].maxScore !== 100)
    throw new ConvexError("Grading bands must span 0 to 100");
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minScore <= sorted[i - 1].maxScore)
      throw new ConvexError("Overlapping score range");
    if (sorted[i].minScore !== sorted[i - 1].maxScore + 1)
      throw new ConvexError("Gap detected in score range");
  }
}

async function localBands(ctx: Context, schoolId: Id<"schools">) {
  const bands = await ctx.db
    .query("gradingBands")
    .withIndex("by_school_active", (q) =>
      q.eq("schoolId", schoolId).eq("isActive", true),
    )
    .take(101);
  if (bands.length > 100)
    throw new ConvexError("Grading policy exceeds supported band count");
  return bands.sort((a, b) => a.minScore - b.minScore);
}

/** Internal resolver: the caller must establish branch/assignment or family authority first. */
export async function resolveEffectiveGradingBands(
  ctx: Context,
  schoolId: Id<"schools">,
) {
  const local = await localBands(ctx, schoolId);
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  const group = link ? await ctx.db.get(link.groupId) : null;
  const defaults =
    group?.status === "active" ? group.gradingDefault : undefined;
  // Linking alone never opts a branch into grading inheritance.
  if (
    defaults &&
    (link?.gradingMode === "inherit" ||
      (link?.gradingMode === "override" && !defaults.allowBranchOverride))
  ) {
    const inherited = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_version", (q) =>
        q.eq("schoolId", defaults.schoolId).eq("version", defaults.version),
      )
      .take(101);
    if (!inherited.length || inherited.length > 100)
      throw new ConvexError("Group grading policy unavailable");
    return inherited.sort((a, b) => a.minScore - b.minScore);
  }
  return local;
}

export const getGradingBands = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await resolveActiveMembership(ctx, args.schoolId);
    const bands = await resolveEffectiveGradingBands(ctx, args.schoolId);
    return bands.length
      ? bands.map((b) => ({
          ...b,
          colorHex: b.colorHex ?? b.color ?? "#334155",
          gradePoints: b.gradePoints ?? 0,
          luminanceContrast: calculateContrastAgainstWhite(
            gradeDisplayColor(b.colorHex ?? b.color),
          ),
          isDefaultPreset: false,
        }))
      : [...FACTORY_DEFAULT_GRADING_BANDS];
  },
});
export const getActiveGradingBands = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, { ...args, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    return resolveEffectiveGradingBands(ctx, schoolId);
  },
});

async function savePolicy(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  bands: BandInput[],
  expectedVersion?: number,
) {
  const auth = await requireCapability(
    ctx,
    schoolId,
    "academic.grading_bands.manage",
  );
  if (auth.isPlatformAdmin || !auth.userId)
    throw new ConvexError("An active branch staff projection is required");
  validateContiguousScoreRanges(bands);
  for (const band of bands) {
    if (band.colorHex !== undefined && !isGradeHex(band.colorHex))
      throw new ConvexError("Use six-digit hex colors");
    if (
      band.gradePoints !== undefined &&
      (!Number.isFinite(band.gradePoints) || band.gradePoints < 0)
    )
      throw new ConvexError("Grade points must be nonnegative");
  }
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  const group = link ? await ctx.db.get(link.groupId) : null;
  if (
    group?.status === "active" &&
    group.gradingDefault &&
    link?.gradingMode === "override" &&
    !group.gradingDefault.allowBranchOverride
  )
    throw new ConvexError("Branch grading overrides are disabled");
  if (
    group?.status === "active" &&
    group.gradingDefault &&
    link?.gradingMode === "inherit"
  )
    throw new ConvexError(
      "Choose an allowed branch override before editing inherited grading bands",
    );
  const existing = await localBands(ctx, schoolId);
  const version = Math.max(0, ...existing.map((b) => b.version ?? 0));
  if (expectedVersion !== undefined && expectedVersion !== version)
    throw new ConvexError(
      "Policy changed. Discard and load latest before saving.",
    );
  const latestVersion = await ctx.db
    .query("gradingBands")
    .withIndex("by_school_version", (q) => q.eq("schoolId", schoolId))
    .order("desc")
    .first();
  const nextVersion = Math.max(version, latestVersion?.version ?? 0) + 1;
  const now = Date.now();
  for (const band of existing)
    await ctx.db.patch(band._id, { isActive: false, updatedAt: now });
  const ids: Id<"gradingBands">[] = [];
  for (const band of bands) {
    const prior = existing.find((b) => b.gradeLetter === band.gradeLetter);
    const colorHex = (
      band.colorHex ??
      prior?.colorHex ??
      prior?.color ??
      "#334155"
    ).toLowerCase();
    ids.push(
      await ctx.db.insert("gradingBands", {
        ...band,
        schoolId,
        colorHex,
        color: colorHex,
        gradePoints: band.gradePoints ?? prior?.gradePoints ?? 0,
        luminanceContrast: calculateContrastAgainstWhite(
          gradeDisplayColor(colorHex),
        ),
        isActive: true,
        version: nextVersion,
        createdAt: now,
        updatedAt: now,
        updatedBy: auth.userId,
      }),
    );
  }
  await recordAuditEventHelper(ctx, {
    schoolId,
    actorKind: "user",
    actorPersonId: auth.personId,
    actorMembershipId: auth.membershipId,
    actorEmailSnapshot: auth.role,
    module: "academic",
    action: "grading_bands.update",
    targetType: "gradingBands",
    targetId: schoolId,
    outcome: "success",
    safeSummary: `Saved grading policy version ${nextVersion} (${bands.length} bands)`,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
  return ids;
}
export const updateGradingBands = mutation({
  args: {
    schoolId: v.id("schools"),
    bands: v.array(gradingBandInput),
    expectedVersion: v.optional(v.number()),
  },
  handler: (ctx, args) =>
    savePolicy(ctx, args.schoolId, args.bands, args.expectedVersion),
});
export const saveGradingBands = mutation({
  args: {
    schoolId: v.optional(v.id("schools")),
    bands: v.array(gradingBandInput),
    expectedVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, { ...args, capability: "academic.grading_bands.manage" });
    return savePolicy(ctx, schoolId, args.bands, args.expectedVersion);
  },
});

export const getPolicyGovernance = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const auth = await requireCapability(
      ctx,
      args.schoolId,
      "academic.grading_bands.manage",
    );
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    return group?.status === "active" && link
      ? {
          groupId: group._id,
          groupName: group.name,
          groupSlug: group.slug,
          canPublish: auth.personId === group.proprietorPersonId,
          mode:
            link.gradingMode === "override" &&
            group.gradingDefault?.allowBranchOverride === false
              ? "inherit"
              : (link.gradingMode ?? "override"),
          defaultVersion: group.gradingDefault?.version ?? null,
          allowBranchOverride:
            group.gradingDefault?.allowBranchOverride ?? true,
        }
      : null;
  },
});
export const setGradingInheritance = mutation({
  args: {
    schoolId: v.id("schools"),
    mode: v.union(v.literal("inherit"), v.literal("override")),
  },
  handler: async (ctx, args) => {
    const auth = await requireCapability(
      ctx,
      args.schoolId,
      "academic.grading_bands.manage",
    );
    if (!auth.membershipId || auth.isPlatformAdmin)
      throw new ConvexError("Explicit branch membership required");
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    if (!link || group?.status !== "active" || !group.gradingDefault)
      throw new ConvexError("No group grading default configured");
    if (args.mode === "override" && !group.gradingDefault.allowBranchOverride)
      throw new ConvexError("Branch grading overrides are disabled");
    await ctx.db.patch(link._id, { gradingMode: args.mode });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: auth.personId,
      actorMembershipId: auth.membershipId,
      actorEmailSnapshot: auth.role,
      module: "academic",
      action: "grading_bands.inheritance",
      targetType: "schoolGroupBranches",
      targetId: link._id,
      outcome: "success",
      safeSummary: `Grading policy mode: ${args.mode}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
    return resolveEffectiveGradingBands(ctx, args.schoolId);
  },
});
/** Publish an immutable reference, not a second copy of the standard preset. */
export const publishGroupGradingDefault = mutation({
  args: {
    schoolId: v.id("schools"),
    groupId: v.id("schoolGroups"),
    allowBranchOverride: v.boolean(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupOwner(ctx, args.groupId);
    const auth = await requireCapability(
      ctx,
      args.schoolId,
      "academic.grading_bands.manage",
    );
    if (!auth.membershipId || auth.isPlatformAdmin)
      throw new ConvexError("Explicit branch membership required");
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_group_and_school", (q) =>
        q.eq("groupId", args.groupId).eq("schoolId", args.schoolId),
      )
      .unique();
    if (!link || args.confirmation !== group.slug)
      throw new ConvexError("Confirm the linked group slug");
    const bands = await localBands(ctx, args.schoolId);
    const version = bands[0]?.version;
    if (!version || bands.some((b) => b.version !== version))
      throw new ConvexError("Save a versioned branch policy first");
    const versionBands = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_version", (q) =>
        q.eq("schoolId", args.schoolId).eq("version", version),
      )
      .take(101);
    if (
      versionBands.length !== bands.length ||
      versionBands.some((b) => !b.isActive)
    )
      throw new ConvexError(
        "Save a new branch policy version before publishing legacy bands",
      );
    await ctx.db.patch(group._id, {
      gradingDefault: {
        schoolId: args.schoolId,
        version,
        allowBranchOverride: args.allowBranchOverride,
      },
      updatedAt: Date.now(),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: auth.personId,
      actorMembershipId: auth.membershipId,
      actorEmailSnapshot: auth.role,
      module: "academic",
      action: "grading_bands.group_default",
      targetType: "schoolGroups",
      targetId: group._id,
      outcome: "success",
      safeSummary: `Published group grading policy version ${version}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
  },
});
