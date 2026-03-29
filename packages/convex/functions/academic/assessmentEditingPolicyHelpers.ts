import { v } from "convex/values";
import { resolveAssessmentEditingState } from "@school/shared";
import type {
  AssessmentEditingPolicy,
  AssessmentEditingState,
} from "@school/shared";
import type { Doc } from "../../_generated/dataModel";

export const assessmentEditingPolicyReturnValidator = v.object({
  _id: v.id("assessmentEditingPolicies"),
  _creationTime: v.number(),
  schoolId: v.id("schools"),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  editingWindowEnabled: v.boolean(),
  editingWindowStartsAt: v.union(v.number(), v.null()),
  editingWindowEndsAt: v.union(v.number(), v.null()),
  finalizationEnabled: v.boolean(),
  finalizeAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.id("users"),
});

export const assessmentEditingStateReturnValidator = v.object({
  hasPolicy: v.boolean(),
  canEdit: v.boolean(),
  lockReason: v.union(
    v.literal("window_not_started"),
    v.literal("window_closed"),
    v.literal("finalized"),
    v.null()
  ),
  message: v.string(),
  isWithinEditingWindow: v.boolean(),
  isFinalized: v.boolean(),
  evaluatedAt: v.number(),
});

type AssessmentEditingPolicyDoc = Doc<"assessmentEditingPolicies">;

export function normalizeAssessmentEditingPolicy(
  policy: AssessmentEditingPolicyDoc
) {
  return {
    ...policy,
    editingWindowStartsAt: policy.editingWindowStartsAt ?? null,
    editingWindowEndsAt: policy.editingWindowEndsAt ?? null,
    finalizeAt: policy.finalizeAt ?? null,
  };
}

export async function getAssessmentEditingPolicy(
  ctx: any,
  args: {
    schoolId: string;
    sessionId: string;
    termId: string;
  }
) {
  const policy = await ctx.db
    .query("assessmentEditingPolicies")
    .withIndex("by_school_session_term", (q: any) =>
      q
        .eq("schoolId", args.schoolId)
        .eq("sessionId", args.sessionId)
        .eq("termId", args.termId)
    )
    .unique();

  return policy ? normalizeAssessmentEditingPolicy(policy) : null;
}

export function getAssessmentEditingState(
  policy: AssessmentEditingPolicy | null,
  now: number
): AssessmentEditingState {
  return resolveAssessmentEditingState(policy, now);
}
