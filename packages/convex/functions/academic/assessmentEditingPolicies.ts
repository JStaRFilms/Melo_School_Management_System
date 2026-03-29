import { query, mutation } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import {
  assessmentEditingPolicyReturnValidator,
  getAssessmentEditingPolicy,
} from "./assessmentEditingPolicyHelpers";

function validateAssessmentEditingPolicyInput(args: {
  editingWindowEnabled: boolean;
  editingWindowStartsAt: number | null;
  editingWindowEndsAt: number | null;
  finalizationEnabled: boolean;
  finalizeAt: number | null;
}) {
  const restrictionsEnabled =
    args.editingWindowEnabled || args.finalizationEnabled;
  const effectiveEndsAt = args.editingWindowEndsAt ?? args.finalizeAt;

  if (restrictionsEnabled) {
    if (effectiveEndsAt === null) {
      throw new ConvexError(
        "Choose a stop date when exam editing restrictions are enabled."
      );
    }

    if (
      args.editingWindowStartsAt !== null &&
      args.editingWindowStartsAt >= effectiveEndsAt
    ) {
      throw new ConvexError(
        "The editing start date must be before the stop date."
      );
    }
  }
}

export const getAssessmentEditingPolicyForAdmin = query({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.union(assessmentEditingPolicyReturnValidator, v.null()),
  handler: async (ctx: any, args: { sessionId: any; termId: any }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId || session.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    const term = await ctx.db.get(args.termId);
    if (
      !term ||
      term.schoolId !== schoolId ||
      term.sessionId !== args.sessionId
    ) {
      throw new ConvexError("Cross-school access denied");
    }

    return await getAssessmentEditingPolicy(ctx, {
      schoolId,
      sessionId: args.sessionId,
      termId: args.termId,
    });
  },
});

export const saveAssessmentEditingPolicy = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    editingWindowEnabled: v.boolean(),
    editingWindowStartsAt: v.union(v.number(), v.null()),
    editingWindowEndsAt: v.union(v.number(), v.null()),
    finalizationEnabled: v.boolean(),
    finalizeAt: v.union(v.number(), v.null()),
  },
  returns: v.id("assessmentEditingPolicies"),
  handler: async (
    ctx: any,
    args: {
      sessionId: any;
      termId: any;
      editingWindowEnabled: boolean;
      editingWindowStartsAt: number | null;
      editingWindowEndsAt: number | null;
      finalizationEnabled: boolean;
      finalizeAt: number | null;
    }
  ) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId || session.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    const term = await ctx.db.get(args.termId);
    if (
      !term ||
      term.schoolId !== schoolId ||
      term.sessionId !== args.sessionId
    ) {
      throw new ConvexError("Cross-school access denied");
    }

    validateAssessmentEditingPolicyInput(args);

    const restrictionsEnabled =
      args.editingWindowEnabled || args.finalizationEnabled;
    const effectiveEndsAt = args.editingWindowEndsAt ?? args.finalizeAt;

    const existingPolicy = await getAssessmentEditingPolicy(ctx, {
      schoolId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    const now = Date.now();
    const payload = {
      schoolId,
      sessionId: args.sessionId,
      termId: args.termId,
      editingWindowEnabled: restrictionsEnabled,
      editingWindowStartsAt: restrictionsEnabled
        ? (args.editingWindowStartsAt ?? undefined)
        : undefined,
      editingWindowEndsAt: restrictionsEnabled
        ? (effectiveEndsAt ?? undefined)
        : undefined,
      finalizationEnabled: false,
      finalizeAt: undefined,
      updatedAt: now,
      updatedBy: userId,
    };

    if (existingPolicy) {
      await ctx.db.patch(existingPolicy._id, payload);
      return existingPolicy._id;
    }

    return await ctx.db.insert("assessmentEditingPolicies", {
      ...payload,
      createdAt: now,
    });
  },
});
