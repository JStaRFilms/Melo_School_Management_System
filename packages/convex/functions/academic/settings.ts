import { ACADEMIC_CONTEXT_CAPABILITIES } from "../../../shared/src/workspace-capability-matrix";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";
import { resolveDomainSetting } from "./groupSettings";

const ASSESSMENT_WEIGHTS = {
  ca1Max: 20,
  ca2Max: 20,
  ca3Max: 20,
  examContributionMax: 40,
} as const;

type Context = QueryCtx | MutationCtx;

/** Caller must establish its own branch/report audience before using this helper. */
export async function resolveEffectiveAcademicPolicy(
  ctx: Context,
  schoolId: Id<"schools">,
) {
  const effective = await resolveDomainSetting(ctx, schoolId, "academic_policy");
  return {
    examInputMode: effective.value?.examInputMode ?? "raw40",
    ...ASSESSMENT_WEIGHTS,
    governance: {
      source: effective.source,
      mode: effective.mode,
      groupId: effective.groupId,
      groupVersion: effective.groupVersion,
      revision: effective.revision,
      allowBranchOverride: effective.allowBranchOverride,
    },
  };
}

export const getSchoolAssessmentSettings = query({
  args: {},
  returns: v.object({
    examInputMode: v.union(
      v.literal("raw40"),
      v.literal("raw60_scaled_to_40"),
    ),
    ca1Max: v.number(),
    ca2Max: v.number(),
    ca3Max: v.number(),
    examContributionMax: v.number(),
    governance: v.object({
      source: v.union(
        v.literal("factory"),
        v.literal("branch_legacy"),
        v.literal("group"),
        v.literal("branch_override"),
      ),
      mode: v.union(
        v.literal("legacy"),
        v.literal("inherit"),
        v.literal("override"),
      ),
      groupId: v.union(v.id("schoolGroups"), v.null()),
      groupVersion: v.number(),
      revision: v.number(),
      allowBranchOverride: v.boolean(),
    }),
  }),
  handler: async (ctx) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, {
      capability: ACADEMIC_CONTEXT_CAPABILITIES,
    });
    return resolveEffectiveAcademicPolicy(ctx, schoolId);
  },
});

export const saveSchoolAssessmentSettings = mutation({
  args: {
    examInputMode: v.union(
      v.literal("raw40"),
      v.literal("raw60_scaled_to_40"),
    ),
  },
  returns: v.id("schoolAssessmentSettings"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "academic.grading_bands.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const effective = await resolveDomainSetting(ctx, schoolId, "academic_policy");
    if (effective.mode !== "legacy")
      throw new ConvexError(
        "Use the group defaults workflow to change an inherited or explicit branch academic policy",
      );
    const existing = await ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", schoolId).eq("isActive", true),
      )
      .take(101);
    if (existing.length > 100)
      throw new ConvexError("Assessment policy history requires review");
    const now = Date.now();
    for (const setting of existing) {
      await ctx.db.patch(setting._id, { isActive: false, updatedAt: now });
    }
    return ctx.db.insert("schoolAssessmentSettings", {
      schoolId,
      examInputMode: args.examInputMode,
      ...ASSESSMENT_WEIGHTS,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });
  },
});
