import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";

export function validateSequence(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 999999999)
    throw new ConvexError("Sequence must be an integer from 1 to 999999999");
}
export function validatePattern(pattern: string): void {
  const tokens = pattern.match(/\{[^}]+\}/g) ?? [];
  if (
    pattern.length > 120 ||
    tokens.filter((t) => /^\{SEQ:[1-9]\}$/.test(t)).length !== 1 ||
    !/^[A-Za-z0-9/_. -]*$/.test(
      pattern.replace(/\{(SCHOOL|CAMPUS|LEVEL|YEAR|SEQ:[1-9])\}/g, ""),
    )
  ) {
    throw new ConvexError(
      "Use exactly one {SEQ:1}–{SEQ:9} and only SCHOOL, CAMPUS, LEVEL, YEAR tokens or letters, numbers, / _ . - separators",
    );
  }
}
export function formatAdmissionNumber(
  pattern: string,
  tokens: {
    school: string;
    campus: string;
    level: string;
    year: number | string;
    seq: number;
  },
): string {
  validatePattern(pattern);
  validateSequence(tokens.seq);
  return pattern.replace(
    /\{(SCHOOL|CAMPUS|LEVEL|YEAR|SEQ:([1-9]))\}/g,
    (_, token: string, width: string) =>
      token.startsWith("SEQ:")
        ? String(tokens.seq).padStart(Number(width), "0")
        : token === "SCHOOL"
          ? tokens.school
          : token === "CAMPUS"
            ? tokens.campus
            : token === "LEVEL"
              ? tokens.level
              : String(tokens.year),
  );
}
async function getContext(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
) {
  const policy = await ctx.db
    .query("admissionNumberPolicies")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  const sessions = await ctx.db
    .query("academicSessions")
    .withIndex("by_school_active", (q) =>
      q.eq("schoolId", schoolId).eq("isActive", true),
    )
    .take(2);
  const session =
    sessions.length === 1 && !sessions[0].isArchived ? sessions[0] : null;
  const period =
    policy?.resetFrequency === "session"
      ? session?._id
      : policy?.resetFrequency === "calendar"
        ? String(new Date().getUTCFullYear())
        : "continuous";
  // An uninitialized legacy reset marker never implies permission to rewind its counter.
  const sequence =
    policy && policy.resetPeriod !== undefined && policy.resetPeriod !== period
      ? 1
      : (policy?.currentSequence ?? 1);
  return { policy, session, period, sequence };
}
export const getAdmissionNumberPolicy = query({
  args: { schoolId: v.id("schools"), level: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "enrollment.intakes.manage");
    const { policy, session, sequence } = await getContext(ctx, args.schoolId);
    return {
      policy,
      version: policy?.version ?? 0,
      nextSequence: sequence,
      sessionYear: session
        ? new Date(session.startDate).getUTCFullYear()
        : null,
      preview:
        policy && session && (!policy.pattern.includes("{LEVEL}") || args.level)
          ? formatAdmissionNumber(policy.pattern, {
              school: policy.schoolCode,
              campus: policy.campusCode,
              level: args.level ?? "",
              year: new Date(session.startDate).getUTCFullYear(),
              seq: sequence,
            })
          : null,
    };
  },
});
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
        v.literal("calendar"),
      ),
    ),
    currentSequence: v.optional(v.number()),
    expectedVersion: v.number(),
    confirmedNextSequence: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    validatePattern(args.pattern);
    for (const code of [args.schoolCode, args.campusCode])
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(code))
        throw new ConvexError(
          "School and branch codes require 1–24 letters, digits, underscores or hyphens",
        );
    const { policy, sequence, session } = await getContext(ctx, args.schoolId);
    if ((policy?.version ?? 0) !== args.expectedVersion)
      throw new ConvexError("Policy changed; reload and review again");
    const next = args.currentSequence ?? sequence;
    validateSequence(next);
    if (next !== args.confirmedNextSequence)
      throw new ConvexError("Confirm the exact next sequence");
    if (next < sequence)
      throw new ConvexError("The next sequence cannot be moved backwards");
    const frequency = args.resetFrequency ?? "continuous";
    if (!session)
      throw new ConvexError("One active academic session is required");
    const data = {
      pattern: args.pattern,
      schoolCode: args.schoolCode,
      campusCode: args.campusCode,
      resetFrequency: frequency,
      currentSequence: next,
      version: (policy?.version ?? 0) + 1,
      resetPeriod:
        frequency === "session"
          ? String(session._id)
          : frequency === "calendar"
            ? String(new Date().getUTCFullYear())
            : "continuous",
      updatedAt: Date.now(),
    };
    const id = policy
      ? policy._id
      : await ctx.db.insert("admissionNumberPolicies", {
          schoolId: args.schoolId,
          ...data,
          createdAt: Date.now(),
        });
    if (policy) await ctx.db.patch(id, data);
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: actor.personId,
      actorMembershipId: actor.membershipId,
      actorEmailSnapshot: actor.role ?? "staff",
      module: "enrollment",
      action: "admission_policy.update",
      targetType: "admissionNumberPolicies",
      targetId: id,
      outcome: "success",
      safeSummary: `Admission policy version ${data.version}; next sequence ${next}. Historical identifiers unchanged.`,
      alertTier: "tier2_warn",
      retentionClass: "permanent_statutory",
    });
    return id;
  },
});

/** Nonmutating proposal; callers authorize their enrollment/import/transfer audience first. */
export async function proposeAdmissionNumberHelper(
  ctx: QueryCtx | MutationCtx,
  args: { schoolId: Id<"schools">; level?: string },
) {
  const { policy, session, period, sequence } = await getContext(
    ctx,
    args.schoolId,
  );
  if (!policy || !session || !period)
    throw new ConvexError(
      "Configure numbering and one active academic session before allocation",
    );
  if (policy.pattern.includes("{LEVEL}") && !args.level)
    throw new ConvexError("An explicit enrollment level is required");
  const allocatedNumber = formatAdmissionNumber(policy.pattern, {
    school: policy.schoolCode,
    campus: policy.campusCode,
    level: args.level ?? "",
    year: new Date(session.startDate).getUTCFullYear(),
    seq: sequence,
  });
  return {
    allocatedNumber,
    sequenceNumber: sequence,
    policyVersion: policy.version ?? 0,
    period,
    policyId: policy._id,
  };
}
/** Commit ONLY inside the successful record-creation transaction. No gapless promise. */
export async function allocateNextAdmissionNumberHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    level?: string;
    year?: number;
    campusCodeOverride?: string;
    schoolCodeOverride?: string;
    expectedVersion?: number;
  },
) {
  if (
    args.campusCodeOverride ||
    args.schoolCodeOverride ||
    args.year !== undefined
  )
    throw new ConvexError(
      "Allocation uses the reviewed policy and academic session, not caller token overrides",
    );
  const proposal = await proposeAdmissionNumberHelper(ctx, args);
  if (
    args.expectedVersion !== undefined &&
    args.expectedVersion !== proposal.policyVersion
  )
    throw new ConvexError("Numbering policy changed; review again");
  await claimAdmissionNumberHelper(
    ctx,
    args.schoolId,
    proposal.allocatedNumber,
  );
  await ctx.db.patch(proposal.policyId, {
    currentSequence: proposal.sequenceNumber + 1,
    resetPeriod: proposal.period,
    updatedAt: Date.now(),
  });
  return proposal;
}
export async function claimAdmissionNumberHelper(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  number: string,
) {
  const existing = await ctx.db
    .query("students")
    .withIndex("by_school_and_admission_number", (q) =>
      q.eq("schoolId", schoolId).eq("admissionNumber", number),
    )
    .first();
  const claim = await ctx.db
    .query("admissionNumberClaims")
    .withIndex("by_school_number", (q) =>
      q.eq("schoolId", schoolId).eq("number", number),
    )
    .unique();
  if (existing || claim)
    throw new ConvexError(
      "Admission number already assigned; review the explicit next sequence. Numbers are never reused.",
    );
  await ctx.db.insert("admissionNumberClaims", {
    schoolId,
    number,
    createdAt: Date.now(),
  });
}
export async function commitManualAdmissionNumberHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    number: string;
    reason?: string;
    confirmed?: boolean;
    counterDecision?: "keep" | "advance";
    advanceTo?: number;
  },
) {
  const actor = await requireCapability(
    ctx,
    args.schoolId,
    "enrollment.admissions.override_number",
  );
  if (
    !args.confirmed ||
    !args.reason ||
    args.reason.trim().length < 8 ||
    args.reason.length > 240
  )
    throw new ConvexError(
      "Confirm manual override and provide an 8–240 character reason",
    );
  if (!args.counterDecision)
    throw new ConvexError(
      "Choose explicitly whether to keep or advance the automatic counter",
    );
  if (
    (args.counterDecision === "keep" && args.advanceTo !== undefined) ||
    (args.counterDecision === "advance" && args.advanceTo === undefined)
  )
    throw new ConvexError(
      "The counter decision and next sequence must agree",
    );
  if (!args.number.trim() || args.number.length > 160)
    throw new ConvexError("Admission number requires 1–160 characters");
  await claimAdmissionNumberHelper(ctx, args.schoolId, args.number);
  if (args.counterDecision === "advance" && args.advanceTo !== undefined) {
    validateSequence(args.advanceTo);
    const { policy, sequence, period } = await getContext(ctx, args.schoolId);
    if (!policy || !period || args.advanceTo <= sequence)
      throw new ConvexError(
        "Explicit advancement must exceed the current next sequence",
      );
    await ctx.db.patch(policy._id, {
      currentSequence: args.advanceTo,
      resetPeriod: period,
      updatedAt: Date.now(),
    });
  }
  await recordAuditEventHelper(ctx, {
    schoolId: args.schoolId,
    actorKind: "user",
    actorPersonId: actor.personId,
    actorMembershipId: actor.membershipId,
    actorEmailSnapshot: actor.role ?? "staff",
    module: "enrollment",
    action: "admission_number.override",
    targetType: "admissionNumberClaims",
    targetId: args.number,
    outcome: "success",
    safeSummary: `Manual admission override. Reason: ${args.reason.trim()}. Counter: ${args.counterDecision === "keep" ? "unchanged" : `explicit next ${args.advanceTo}`}`,
    alertTier: "tier2_warn",
    retentionClass: "permanent_statutory",
  });
}
export const allocateNextAdmissionNumber = internalMutation({
  args: {
    schoolId: v.id("schools"),
    level: v.optional(v.string()),
    year: v.optional(v.number()),
    campusCodeOverride: v.optional(v.string()),
    schoolCodeOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => allocateNextAdmissionNumberHelper(ctx, args),
});
