import { mutation, query, type MutationCtx } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";

/**
 * Token Formatter for Admission Numbers.
 * Supports {SCHOOL}, {CAMPUS}, {LEVEL}, {YEAR}, {SEQ:n}
 */
export function formatAdmissionNumber(
  pattern: string,
  tokens: {
    school: string;
    campus: string;
    level: string;
    year: number | string;
    seq: number;
  }
): string {
  let result = pattern;
  result = result.replace(/\{SCHOOL\}/g, tokens.school);
  result = result.replace(/\{CAMPUS\}/g, tokens.campus);
  result = result.replace(/\{LEVEL\}/g, tokens.level);
  result = result.replace(/\{YEAR\}/g, String(tokens.year));
  result = result.replace(/\{SEQ:(\d+)\}/g, (_match, p1) => {
    const width = parseInt(p1, 10);
    return String(tokens.seq).padStart(width, "0");
  });
  return result;
}

/**
 * Validates format pattern tokens.
 */
export function validatePattern(pattern: string): void {
  if (!pattern || typeof pattern !== "string") {
    throw new ConvexError("Pattern must be a non-empty string");
  }

  // Must contain a sequence token: {SEQ:n}
  if (!/\{SEQ:\d+\}/.test(pattern)) {
    throw new ConvexError(
      "Admission number pattern must contain a sequence token, e.g. {SEQ:4}"
    );
  }

  // Verify all bracketed tokens are allowed
  const tokenMatches = pattern.match(/\{[^}]+\}/g) || [];
  for (const token of tokenMatches) {
    if (
      token === "{SCHOOL}" ||
      token === "{CAMPUS}" ||
      token === "{LEVEL}" ||
      token === "{YEAR}" ||
      /^\{SEQ:\d+\}$/.test(token)
    ) {
      continue;
    }
    throw new ConvexError(
      `Unsupported token '${token}'. Allowed tokens are: {SCHOOL}, {CAMPUS}, {LEVEL}, {YEAR}, and {SEQ:n}`
    );
  }
}

/**
 * Query active admission number policy with dynamic live preview.
 */
export const getAdmissionNumberPolicy = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db
      .query("admissionNumberPolicies")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    const school = await ctx.db.get(args.schoolId);
    const defaultSchoolCode = school?.slug
      ? school.slug.toUpperCase().slice(0, 3)
      : "OBC";
    const defaultCampusCode = "LAG";
    const defaultPattern = "{SCHOOL}-{CAMPUS}-{LEVEL}-{YEAR}-{SEQ:4}";

    const activePolicy = policy ?? {
      schoolId: args.schoolId,
      pattern: defaultPattern,
      schoolCode: defaultSchoolCode,
      campusCode: defaultCampusCode,
      currentSequence: 1,
      resetFrequency: "continuous" as const,
      isDefaultPreset: true,
    };

    const currentYear = new Date().getFullYear();
    const preview = formatAdmissionNumber(activePolicy.pattern, {
      school: activePolicy.schoolCode,
      campus: activePolicy.campusCode,
      level: "JSS1",
      year: currentYear,
      seq: activePolicy.currentSequence,
    });

    return {
      ...activePolicy,
      preview,
    };
  },
});

/**
 * Mutation to update admission number policy with token validation and audit logging.
 */
export const updateAdmissionNumberPolicy = mutation({
  args: {
    schoolId: v.id("schools"),
    pattern: v.string(),
    schoolCode: v.string(),
    campusCode: v.string(),
    resetFrequency: v.optional(
      v.union(
        v.literal("continuous"),
        v.literal("session"),
        v.literal("calendar")
      )
    ),
    currentSequence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Authorization: check settings / admissions capability
    const authContext = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage"
    );

    // 2. Validate pattern
    validatePattern(args.pattern);

    if (args.currentSequence !== undefined && args.currentSequence < 1) {
      throw new ConvexError("currentSequence must be at least 1");
    }

    const existing = await ctx.db
      .query("admissionNumberPolicies")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    const now = Date.now();
    let policyId;

    if (existing) {
      await ctx.db.patch(existing._id, {
        pattern: args.pattern,
        schoolCode: args.schoolCode,
        campusCode: args.campusCode,
        resetFrequency:
          args.resetFrequency ?? existing.resetFrequency ?? "continuous",
        currentSequence: args.currentSequence ?? existing.currentSequence,
        updatedAt: now,
      });
      policyId = existing._id;
    } else {
      policyId = await ctx.db.insert("admissionNumberPolicies", {
        schoolId: args.schoolId,
        pattern: args.pattern,
        schoolCode: args.schoolCode,
        campusCode: args.campusCode,
        resetFrequency: args.resetFrequency ?? "continuous",
        currentSequence: args.currentSequence ?? 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Audit event
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "enrollment",
      action: "admission_policy.update",
      targetType: "admissionNumberPolicies",
      targetId: policyId,
      outcome: "success",
      safeSummary: `Updated admission number policy: ${args.pattern} (Next Seq: ${
        args.currentSequence ?? existing?.currentSequence ?? 1
      })`,
      alertTier: "tier2_warn",
    });

    return policyId;
  },
});

/**
 * Core helper to allocate the next admission number.
 * Callable directly within mutations to maintain atomic transactions.
 */
export async function allocateNextAdmissionNumberHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    level?: string;
    year?: number;
    campusCodeOverride?: string;
    schoolCodeOverride?: string;
  }
): Promise<{
  allocatedNumber: string;
  sequenceNumber: number;
}> {
  let policy = await ctx.db
    .query("admissionNumberPolicies")
    .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
    .first();

  const now = Date.now();
  if (!policy) {
    const school = await ctx.db.get(args.schoolId);
    const schoolCode = school?.slug
      ? school.slug.toUpperCase().slice(0, 3)
      : "OBC";
    const campusCode = "LAG";
    const policyId = await ctx.db.insert("admissionNumberPolicies", {
      schoolId: args.schoolId,
      pattern: "{SCHOOL}-{CAMPUS}-{LEVEL}-{YEAR}-{SEQ:4}",
      schoolCode,
      campusCode,
      currentSequence: 1,
      resetFrequency: "continuous",
      createdAt: now,
      updatedAt: now,
    });
    policy = (await ctx.db.get(policyId))!;
  }

  const currentSeq = policy.currentSequence;
  const year = args.year ?? new Date().getFullYear();
  const level = args.level ?? "JSS1";
  const schoolCode = args.schoolCodeOverride ?? policy.schoolCode;
  const campusCode = args.campusCodeOverride ?? policy.campusCode;

  const allocatedNumber = formatAdmissionNumber(policy.pattern, {
    school: schoolCode,
    campus: campusCode,
    level,
    year,
    seq: currentSeq,
  });

  // Advance sequence atomically
  await ctx.db.patch(policy._id, {
    currentSequence: currentSeq + 1,
    updatedAt: now,
  });

  return {
    allocatedNumber,
    sequenceNumber: currentSeq,
  };
}

/**
 * Atomic counter allocator evaluated during enrollment intake.
 * Increments currentSequence strictly without gaps or race conditions.
 */
export const allocateNextAdmissionNumberInternal = mutation({
  args: {
    schoolId: v.id("schools"),
    level: v.optional(v.string()),
    year: v.optional(v.number()),
    campusCodeOverride: v.optional(v.string()),
    schoolCodeOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await allocateNextAdmissionNumberHelper(ctx, args);
  },
});
