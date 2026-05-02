import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation, type MutationCtx } from "../../_generated/server";
import { getAuthenticatedSchoolMembership } from "./auth";

export const lessonKnowledgeRateLimitActionValidator = v.union(
  v.literal("teacher_lesson_plan_generation"),
  v.literal("teacher_assessment_generation"),
  v.literal("knowledge_material_upload_url"),
  v.literal("knowledge_material_link_registration"),
  v.literal("knowledge_material_ingestion_retry"),
  v.literal("knowledge_material_ocr_retry"),
  v.literal("portal_supplemental_upload_url")
);

export const lessonKnowledgeRateLimitResultValidator = v.object({
  allowed: v.boolean(),
  action: lessonKnowledgeRateLimitActionValidator,
  limit: v.number(),
  remaining: v.number(),
  resetAt: v.number(),
  retryAfterMs: v.number(),
});

type LessonKnowledgeRateLimitAction =
  | "teacher_lesson_plan_generation"
  | "teacher_assessment_generation"
  | "knowledge_material_upload_url"
  | "knowledge_material_link_registration"
  | "knowledge_material_ingestion_retry"
  | "knowledge_material_ocr_retry"
  | "portal_supplemental_upload_url";

type LessonKnowledgeRateLimitBucket = {
  scope: "user" | "school";
  limit: number;
  windowMs: number;
};

type LessonKnowledgeRateLimitConfig = {
  buckets: [LessonKnowledgeRateLimitBucket, ...LessonKnowledgeRateLimitBucket[]];
};

type LessonKnowledgeRateLimitResult = {
  allowed: boolean;
  action: LessonKnowledgeRateLimitAction;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

const LESSON_KNOWLEDGE_RATE_LIMITS = {
  teacher_lesson_plan_generation: {
    buckets: [
      { scope: "user", limit: 10, windowMs: 60 * 60 * 1000 },
      { scope: "school", limit: 60, windowMs: 60 * 60 * 1000 },
    ],
  },
  teacher_assessment_generation: {
    buckets: [
      { scope: "user", limit: 10, windowMs: 60 * 60 * 1000 },
      { scope: "school", limit: 60, windowMs: 60 * 60 * 1000 },
    ],
  },
  knowledge_material_upload_url: {
    buckets: [
      { scope: "user", limit: 20, windowMs: 60 * 60 * 1000 },
      { scope: "school", limit: 200, windowMs: 60 * 60 * 1000 },
    ],
  },
  knowledge_material_link_registration: {
    buckets: [
      { scope: "user", limit: 30, windowMs: 60 * 60 * 1000 },
      { scope: "school", limit: 300, windowMs: 60 * 60 * 1000 },
    ],
  },
  knowledge_material_ingestion_retry: {
    buckets: [
      { scope: "user", limit: 10, windowMs: 15 * 60 * 1000 },
      { scope: "school", limit: 60, windowMs: 15 * 60 * 1000 },
    ],
  },
  knowledge_material_ocr_retry: {
    buckets: [
      { scope: "user", limit: 12, windowMs: 15 * 60 * 1000 },
      { scope: "school", limit: 60, windowMs: 15 * 60 * 1000 },
    ],
  },
  portal_supplemental_upload_url: {
    buckets: [
      { scope: "user", limit: 10, windowMs: 60 * 60 * 1000 },
      { scope: "school", limit: 80, windowMs: 60 * 60 * 1000 },
    ],
  },
} satisfies Record<LessonKnowledgeRateLimitAction, LessonKnowledgeRateLimitConfig>;

function assertStaffGenerationAccess(role: string, isSchoolAdmin: boolean) {
  if (role !== "teacher" && role !== "admin" && !isSchoolAdmin) {
    throw new ConvexError("Teacher generation is restricted to staff");
  }
}

function buildRateLimitKey(args: {
  action: LessonKnowledgeRateLimitAction;
  schoolId: Id<"schools">;
  actorUserId: Id<"users">;
  scope: "user" | "school";
}) {
  return args.scope === "school"
    ? `${args.action}:school:${String(args.schoolId)}`
    : `${args.action}:user:${String(args.schoolId)}:${String(args.actorUserId)}`;
}

function rateLimitMessage(result: LessonKnowledgeRateLimitResult) {
  const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return `Rate limit exceeded. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`;
}

export async function consumeLessonKnowledgeRateLimit(
  ctx: MutationCtx,
  args: {
    action: LessonKnowledgeRateLimitAction;
    schoolId: Id<"schools">;
    actorUserId: Id<"users">;
  }
): Promise<LessonKnowledgeRateLimitResult> {
  const config = LESSON_KNOWLEDGE_RATE_LIMITS[args.action];
  const now = Date.now();
  const bucketStates = await Promise.all(
    config.buckets.map(async (bucket) => {
      const key = buildRateLimitKey({
        action: args.action,
        schoolId: args.schoolId,
        actorUserId: args.actorUserId,
        scope: bucket.scope,
      });
      const existing = await ctx.db
        .query("rateLimitCounters")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();

      return { bucket, key, existing };
    })
  );

  // Precheck every bucket before writing any counters. Convex commits the
  // mutation transaction as one unit, so the later patches use the same
  // serialized snapshot while avoiding partial quota consumption.
  for (const state of bucketStates) {
    if (state.existing && now < state.existing.windowExpiresAt && state.existing.count >= state.bucket.limit) {
      return {
        allowed: false,
        action: args.action,
        limit: state.bucket.limit,
        remaining: 0,
        resetAt: state.existing.windowExpiresAt,
        retryAfterMs: Math.max(0, state.existing.windowExpiresAt - now),
      };
    }
  }

  let primaryResult: LessonKnowledgeRateLimitResult | null = null;

  for (const state of bucketStates) {
    if (state.existing && now < state.existing.windowExpiresAt) {
      const nextCount = state.existing.count + 1;
      await ctx.db.patch(state.existing._id, {
        actorUserId: args.actorUserId,
        count: nextCount,
        limit: state.bucket.limit,
        updatedAt: now,
      });

      const result = {
        allowed: true,
        action: args.action,
        limit: state.bucket.limit,
        remaining: Math.max(0, state.bucket.limit - nextCount),
        resetAt: state.existing.windowExpiresAt,
        retryAfterMs: 0,
      } satisfies LessonKnowledgeRateLimitResult;

      primaryResult ??= result;
      continue;
    }

    const windowStartAt = now;
    const windowExpiresAt = now + state.bucket.windowMs;

    if (state.existing) {
      await ctx.db.patch(state.existing._id, {
        actorUserId: args.actorUserId,
        windowStartAt,
        windowExpiresAt,
        count: 1,
        limit: state.bucket.limit,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("rateLimitCounters", {
        key: state.key,
        action: args.action,
        schoolId: args.schoolId,
        actorUserId: args.actorUserId,
        windowStartAt,
        windowExpiresAt,
        count: 1,
        limit: state.bucket.limit,
        createdAt: now,
        updatedAt: now,
      });
    }

    const result = {
      allowed: true,
      action: args.action,
      limit: state.bucket.limit,
      remaining: Math.max(0, state.bucket.limit - 1),
      resetAt: windowExpiresAt,
      retryAfterMs: 0,
    } satisfies LessonKnowledgeRateLimitResult;

    primaryResult ??= result;
  }

  return primaryResult ?? {
    allowed: true,
    action: args.action,
    limit: 0,
    remaining: 0,
    resetAt: now,
    retryAfterMs: 0,
  };
}

export async function assertLessonKnowledgeRateLimit(
  ctx: MutationCtx,
  args: {
    action: LessonKnowledgeRateLimitAction;
    schoolId: Id<"schools">;
    actorUserId: Id<"users">;
  }
) {
  const result = await consumeLessonKnowledgeRateLimit(ctx, args);
  if (!result.allowed) {
    throw new ConvexError(rateLimitMessage(result));
  }
  return result;
}

export const consumeTeacherLessonPlanGenerationLimit = mutation({
  args: {},
  returns: lessonKnowledgeRateLimitResultValidator,
  handler: async (ctx) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    assertStaffGenerationAccess(role, isSchoolAdmin);

    return await consumeLessonKnowledgeRateLimit(ctx, {
      action: "teacher_lesson_plan_generation",
      schoolId,
      actorUserId: userId,
    });
  },
});

export const consumeTeacherAssessmentGenerationLimit = mutation({
  args: {},
  returns: lessonKnowledgeRateLimitResultValidator,
  handler: async (ctx) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    assertStaffGenerationAccess(role, isSchoolAdmin);

    return await consumeLessonKnowledgeRateLimit(ctx, {
      action: "teacher_assessment_generation",
      schoolId,
      actorUserId: userId,
    });
  },
});
