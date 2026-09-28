import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation, internalAction, type QueryCtx, type MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id, Doc } from "../../_generated/dataModel";
import {
  deriveForSessionPolicy, sessionScoringSnapshotMode, validateScoresForPolicy, validateSessionScoringPolicy,
  type SessionScoringPolicy, type GradingBand,
} from "@school/shared/exam-recording";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
import { resolveEffectiveAcademicPolicy } from "./settings";
import { resolveEffectiveGradingBands } from "./gradingBands";
import { recordAuditEventHelper } from "./audit";

const BATCH = 40;
const ERROR_SAMPLE_SIZE = 10;
const policyFields = {
  ca1Max: v.number(), ca2Max: v.number(), ca3Max: v.number(),
  examRawMax: v.number(), examContributionMax: v.number(),
};
type Context = QueryCtx | MutationCtx;

async function jobFor(ctx: Context, schoolId: Id<"schools">, sessionId: Id<"academicSessions">) {
  return ctx.db.query("sessionScoringRegradeJobs")
    .withIndex("by_school_and_sessionId", q => q.eq("schoolId", schoolId).eq("sessionId", sessionId)).unique();
}

export async function isSessionScoringLocked(ctx: Context, schoolId: Id<"schools">, sessionId: Id<"academicSessions">) {
  const job = await jobFor(ctx, schoolId, sessionId);
  return !!job && (job.phase === "scanning" || job.phase === "failed_scanning" || job.phase === "invalid" ||
    job.phase === "ready" || job.phase === "regrading" || job.phase === "failed_regrading");
}

/** Call after checking the caller's school and before any session score read, write or print. */
export async function assertSessionScoringAvailable(ctx: Context, schoolId: Id<"schools">, sessionId: Id<"academicSessions">) {
  if (await isSessionScoringLocked(ctx, schoolId, sessionId))
    throw new ConvexError("Session scoring regrade is in progress or awaiting administrator action. Scores, reports and certification are unavailable. An administrator can resume a failed job or cancel an unfinished scan.");
}

export async function resolveSessionScoringPolicy(
  ctx: Context, schoolId: Id<"schools">, sessionId: Id<"academicSessions">,
  allowLocked = false,
) {
  if (!allowLocked) await assertSessionScoringAvailable(ctx, schoolId, sessionId);
  const explicit = await ctx.db.query("sessionScoringPolicies")
    .withIndex("by_school_and_sessionId", q => q.eq("schoolId", schoolId).eq("sessionId", sessionId)).unique();
  if (explicit) {
    return {
      policy: { ca1Max: explicit.ca1Max, ca2Max: explicit.ca2Max, ca3Max: explicit.ca3Max,
        examRawMax: explicit.examRawMax, examContributionMax: explicit.examContributionMax },
      version: explicit.version, source: "session" as const,
    };
  }
  // Old rows only recorded the raw exam maximum. CA weights and contribution were
  // fixed at 20/20/20/40 in the legacy contract. Never borrow a newer school mode
  // when an old row supplies the exam maximum actually used for that session.
  // This one-row lookup is a compatibility hint, not proof that every row
  // used the same policy. The durable scan checks the entire session. Until
  // then, existing rows retain their recorded maxima and derived totals.
  const first = (await ctx.db.query("assessmentRecords")
    .withIndex("by_sheet", q => q.eq("schoolId", schoolId).eq("sessionId", sessionId)).take(1))[0];
  if (first) return { policy: recordedPolicy(first), version: 0, source: "legacy" as const };

  // Only an empty session needs today's school setting as a starter. No
  // historical input mode can be reconstructed without recorded evidence.
  const legacy = await resolveEffectiveAcademicPolicy(ctx, schoolId);
  const fallback: SessionScoringPolicy = { ca1Max: legacy.ca1Max, ca2Max: legacy.ca2Max,
    ca3Max: legacy.ca3Max, examRawMax: legacy.examInputMode === "raw40" ? 40 : 60,
    examContributionMax: legacy.examContributionMax };
  return { policy: fallback, version: 0, source: "legacy" as const };
}

function recordedPolicy(row: Doc<"assessmentRecords">): SessionScoringPolicy {
  return {
    ca1Max: row.assessmentPolicySnapshot?.ca1Max ?? 20,
    ca2Max: row.assessmentPolicySnapshot?.ca2Max ?? 20,
    ca3Max: row.assessmentPolicySnapshot?.ca3Max ?? 20,
    examRawMax: row.examRawMaxSnapshot,
    examContributionMax: row.assessmentPolicySnapshot?.examContributionMax ?? 40,
  };
}

async function requirePolicyAdmin(ctx: Context, sessionId: Id<"academicSessions">, requireOverride = false) {
  const session = await ctx.db.get(sessionId);
  if (!session || session.isArchived)
    throw new ConvexError("Session not found in this school");
  const { schoolId } = session;
  const { userId, role } = await getAuthenticatedSchoolMembership(ctx, {
    schoolId, capability: "academic.grading_bands.manage",
  });
  await assertAdminForSchool(ctx, userId, schoolId, role);
  if (requireOverride) {
    const effective = await resolveEffectiveAcademicPolicy(ctx, schoolId);
    if (effective.governance.mode !== "legacy" && !effective.governance.allowBranchOverride)
      throw new ConvexError("Group academic policy does not allow branch overrides");
  }
  return { schoolId, userId };
}

function samePolicy(a: SessionScoringPolicy, b: SessionScoringPolicy) {
  return (Object.keys(policyFields) as Array<keyof SessionScoringPolicy>).every(field => a[field] === b[field]);
}

export const getSessionScoringPolicy = query({
  args: { sessionId: v.id("academicSessions") },
  handler: async (ctx, { sessionId }) => {
    const { schoolId } = await requirePolicyAdmin(ctx, sessionId);
    return resolveSessionScoringPolicy(ctx, schoolId, sessionId, true);
  },
});

export const listSessionScoringEvents = query({
  args: { sessionId: v.id("academicSessions") },
  handler: async (ctx, { sessionId }) => {
    const { schoolId } = await requirePolicyAdmin(ctx, sessionId);
    return ctx.db.query("sessionScoringPolicyEvents")
      .withIndex("by_school_and_sessionId", q => q.eq("schoolId", schoolId).eq("sessionId", sessionId))
      .order("desc").take(25);
  },
});

export const previewSessionScoringChange = query({
  args: { sessionId: v.id("academicSessions"), policy: v.object(policyFields) },
  handler: async (ctx, { sessionId, policy }) => {
    const { schoolId } = await requirePolicyAdmin(ctx, sessionId);
    const errors = validateSessionScoringPolicy(policy);
    if (errors.length) throw new ConvexError(errors.join("; "));
    const current = await resolveSessionScoringPolicy(ctx, schoolId, sessionId, true);
    const job = await jobFor(ctx, schoolId, sessionId);
    const matching = job && samePolicy(job.policy, policy) && samePolicy(job.before, current.policy) && job.expectedVersion === current.version;
    const ready = matching && job.phase === "ready";
    const bands = await resolveEffectiveGradingBands(ctx, schoolId);
    return {
      current, nextPolicy: policy,
      count: matching ? job.scanned : 0,
      invalidCount: matching ? job.invalidCount : 0,
      invalidCountIsPartial: !matching || job.phase === "scanning" || job.phase === "failed_scanning",
      invalidExamples: matching ? job.invalidExamples : [],
      mixedLegacyCount: matching ? job.mixedLegacyCount ?? 0 : 0,
      mixedLegacyExamples: matching ? job.mixedLegacyExamples ?? [] : [],
      phase: matching ? job.phase : "not_started",
      canApply: !!ready && job.invalidCount === 0 && (job.scanned === 0 || bands.length > 0),
      warning: !matching ? "Start a full-session scan before applying this policy."
        : job.phase === "scanning" ? "Still scanning the session. Counts are not final."
        : job.phase === "failed_scanning" ? `Scan failed: ${job.failureReason ?? "unknown error"}. Counts are partial. Resume or cancel the scan.`
        : job.phase === "failed_regrading" ? `Regrade failed: ${job.failureReason ?? "unknown error"}. Scores and reports remain blocked. Repair the cause and resume.`
        : job.phase === "regrading" ? "Regrade in progress. Scores and reports are blocked; resume if stalled."
        : job.phase === "invalid" ? "Raw scores exceed the new maxima. Cancel this scan to unlock entry, correct them, then start a new scan."
        : !bands.length && job.scanned ? "Configure grading bands before regrading this session."
        : `${job.mixedLegacyCount ? `${job.mixedLegacyCount} historical rows have different recorded policy snapshots. Applying this explicit policy will reconcile them; their original snapshots remain on issued reports. ` : ""}Issued reports remain unchanged. Replacement certification is not available for already issued reports; review current scores separately.`,
    };
  },
});

/** Locks the session before preflight reads. An invalid or complete scan can be replaced; cancel a ready scan first. */
export const startSessionScoringScan = mutation({
  args: { sessionId: v.id("academicSessions"), policy: v.object(policyFields),
    expectedVersion: v.number(), expectedPolicy: v.object(policyFields) },
  handler: async (ctx, args) => {
    const { schoolId, userId } = await requirePolicyAdmin(ctx, args.sessionId, true);
    const errors = validateSessionScoringPolicy(args.policy);
    if (errors.length) throw new ConvexError(errors.join("; "));
    const current = await resolveSessionScoringPolicy(ctx, schoolId, args.sessionId, true);
    if (!Number.isSafeInteger(args.expectedVersion) || current.version !== args.expectedVersion || !samePolicy(current.policy, args.expectedPolicy))
      throw new ConvexError("Policy changed. Preview this session again.");
    const previous = await jobFor(ctx, schoolId, args.sessionId);
    if (previous && (previous.phase === "scanning" || previous.phase === "failed_scanning" || previous.phase === "ready" || previous.phase === "regrading" || previous.phase === "failed_regrading"))
      throw new ConvexError("A session regrade is already running. Resume it if stalled.");
    if (previous) await ctx.db.delete(previous._id);
    const now = Date.now();
    const jobId = await ctx.db.insert("sessionScoringRegradeJobs", {
      schoolId, sessionId: args.sessionId, phase: "scanning", policy: args.policy,
      before: current.policy, expectedVersion: current.version, scanned: 0, batchSize: BATCH, invalidCount: 0,
      invalidExamples: [], mixedLegacyCount: 0, mixedLegacyExamples: [],
      updated: 0, startedAt: now, updatedAt: now, updatedBy: userId,
    });
    await ctx.scheduler.runAfter(0, internal.functions.academic.sessionScoring.driveSessionScoringJob, { jobId });
    return { jobId, phase: "scanning" as const };
  },
});

export const getSessionScoringJob = query({
  args: { sessionId: v.id("academicSessions") },
  handler: async (ctx, { sessionId }) => {
    const { schoolId } = await requirePolicyAdmin(ctx, sessionId);
    return jobFor(ctx, schoolId, sessionId);
  },
});

export const cancelSessionScoringScan = mutation({
  args: { sessionId: v.id("academicSessions") },
  handler: async (ctx, { sessionId }) => {
    const { schoolId } = await requirePolicyAdmin(ctx, sessionId);
    const job = await jobFor(ctx, schoolId, sessionId);
    if (!job || (job.phase !== "ready" && job.phase !== "scanning" && job.phase !== "failed_scanning" && job.phase !== "invalid"))
      throw new ConvexError("Only a preflight scan can be cancelled. Resume a regrade instead.");
    await ctx.db.delete(job._id);
    return null;
  },
});

export const resumeSessionScoringJob = mutation({
  args: { sessionId: v.id("academicSessions") },
  handler: async (ctx, { sessionId }) => {
    const { schoolId } = await requirePolicyAdmin(ctx, sessionId);
    const job = await jobFor(ctx, schoolId, sessionId);
    if (!job || (job.phase !== "scanning" && job.phase !== "failed_scanning" &&
      job.phase !== "regrading" && job.phase !== "failed_regrading"))
      throw new ConvexError("No scan or regrade to resume");
    const phase = job.phase === "failed_scanning" ? "scanning" : job.phase === "failed_regrading" ? "regrading" : job.phase;
    await ctx.db.patch(job._id, { phase, failureReason: undefined,
      batchSize: job.phase.startsWith("failed_") ? Math.max(1, Math.floor(job.batchSize / 2)) : job.batchSize,
      updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.functions.academic.sessionScoring.driveSessionScoringJob, { jobId: job._id });
    return { phase, scanned: job.scanned, updated: job.updated };
  },
});

export const applySessionScoringChange = mutation({
  args: { sessionId: v.id("academicSessions"), policy: v.object(policyFields),
    expectedVersion: v.number(), expectedPolicy: v.object(policyFields), confirmRegrade: v.boolean() },
  handler: async (ctx, args) => {
    const { schoolId } = await requirePolicyAdmin(ctx, args.sessionId, true);
    if (!args.confirmRegrade) throw new ConvexError("Confirm the regrade and issued-report warning first");
    const errors = validateSessionScoringPolicy(args.policy);
    if (errors.length) throw new ConvexError(errors.join("; "));
    const current = await resolveSessionScoringPolicy(ctx, schoolId, args.sessionId, true);
    if (current.version !== args.expectedVersion || !samePolicy(current.policy, args.expectedPolicy))
      throw new ConvexError("Policy changed. Preview this session again before applying.");
    const job = await jobFor(ctx, schoolId, args.sessionId);
    if (job?.phase === "invalid" && samePolicy(job.policy, args.policy) && job.expectedVersion === current.version)
      throw new ConvexError("Raw scores exceed the new maxima. Preview the affected records, correct them, and start a new scan.");
    if (!job || !samePolicy(job.policy, args.policy) || !samePolicy(job.before, current.policy) ||
      job.expectedVersion !== current.version || job.phase !== "ready")
      throw new ConvexError("A complete valid scan is required. Start a new scan or wait for it to finish.");
    const bands = await resolveEffectiveGradingBands(ctx, schoolId);
    if (job.scanned && !bands.length) throw new ConvexError("Configure grading bands before regrading this session");
    await ctx.db.patch(job._id, { phase: "regrading", cursor: undefined,
      gradingBandsJson: JSON.stringify(bands.map(b => ({ ...b, schoolId: String(b.schoolId), updatedBy: String(b.updatedBy) }))),
      updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.functions.academic.sessionScoring.driveSessionScoringJob, { jobId: job._id });
    return { phase: "regrading" as const, scanned: job.scanned, updated: 0,
      warning: "Regrade started, not completed. Scores and reports remain blocked until the job completes. Issued reports remain unchanged; replacement certification is not available." };
  },
});

/** Idempotent continuation: cursor and row updates commit in the same transaction. */
export const processSessionScoringBatch = internalMutation({
  args: { jobId: v.id("sessionScoringRegradeJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || (job.phase !== "scanning" && job.phase !== "regrading")) return null;
    const page = await ctx.db.query("assessmentRecords")
      .withIndex("by_sheet", q => q.eq("schoolId", job.schoolId).eq("sessionId", job.sessionId))
      .paginate({ cursor: job.cursor ?? null, numItems: job.batchSize, maximumRowsRead: job.batchSize });
    if (job.phase === "scanning") {
      let invalidCount = job.invalidCount;
      const invalidExamples: Doc<"sessionScoringRegradeJobs">["invalidExamples"] = [...job.invalidExamples];
      let mixedLegacyCount = job.mixedLegacyCount ?? 0;
      const mixedLegacyExamples: NonNullable<Doc<"sessionScoringRegradeJobs">["mixedLegacyExamples"]> = [...(job.mixedLegacyExamples ?? [])];
      for (const record of page.page) {
        if (job.expectedVersion === 0 && !samePolicy(recordedPolicy(record), job.before)) {
          mixedLegacyCount++;
          if (mixedLegacyExamples.length < ERROR_SAMPLE_SIZE)
            mixedLegacyExamples.push({ recordId: record._id, studentId: record.studentId,
              termId: record.termId, classId: record.classId, subjectId: record.subjectId,
              snapshot: recordedPolicy(record) });
        }
        const errors = validateScoresForPolicy(record, job.policy);
        if (errors.length) invalidCount++;
        for (const error of errors) {
          if (invalidExamples.length < ERROR_SAMPLE_SIZE)
            invalidExamples.push({ recordId: record._id, studentId: record.studentId, termId: record.termId,
              classId: record.classId, subjectId: record.subjectId,
              field: error.field, message: error.message });
        }
      }
      await ctx.db.patch(jobId, { cursor: page.isDone ? undefined : page.continueCursor,
        scanned: job.scanned + page.page.length, invalidCount, invalidExamples, mixedLegacyCount, mixedLegacyExamples,
        phase: page.isDone ? (invalidCount ? "invalid" : "ready") : "scanning", updatedAt: Date.now() });
    } else {
      if (!job.gradingBandsJson) throw new ConvexError("Regrade grading bands snapshot missing. Administrative repair required.");
      const gradingBands: GradingBand[] = JSON.parse(job.gradingBandsJson);
      const now = Date.now();
      for (const record of page.page) {
        // A corrupt or out-of-band row must never publish a partial success.
        if (validateScoresForPolicy(record, job.policy).length) throw new ConvexError("Invalid score during regrade. Repair the row and resume.");
        const result = deriveForSessionPolicy(record, job.policy, gradingBands);
        await ctx.db.patch(record._id, { examScaledScore: result.examScaledScore, total: result.total,
          gradeLetter: result.gradeLetter, remark: result.remark,
          examRawMaxSnapshot: job.policy.examRawMax, examInputModeSnapshot: sessionScoringSnapshotMode(job.policy),
          sessionScoringPolicyVersion: job.expectedVersion + 1,
          assessmentPolicySnapshot: undefined, gradingPolicySnapshot: undefined,
          updatedBy: job.updatedBy, updatedAt: now });
      }
      if (page.isDone) {
        if (job.updated + page.page.length !== job.scanned)
          throw new ConvexError("Scanned record count changed during regrade. Scores remain blocked; administrator must investigate before resuming.");
        const existing = await ctx.db.query("sessionScoringPolicies")
          .withIndex("by_school_and_sessionId", q => q.eq("schoolId", job.schoolId).eq("sessionId", job.sessionId)).unique();
        if (existing?.version !== undefined && existing.version !== job.expectedVersion)
          throw new ConvexError("Session policy changed during regrade. Administrative repair required.");
        const version = job.expectedVersion + 1;
        if (existing) await ctx.db.patch(existing._id, { ...job.policy, version, updatedAt: now, updatedBy: job.updatedBy });
        else await ctx.db.insert("sessionScoringPolicies", { schoolId: job.schoolId, sessionId: job.sessionId,
          ...job.policy, version, updatedAt: now, updatedBy: job.updatedBy });
        await ctx.db.insert("sessionScoringPolicyEvents", { schoolId: job.schoolId, sessionId: job.sessionId,
          version, before: JSON.stringify(job.before), after: JSON.stringify(job.policy),
          affectedRecords: job.updated + page.page.length, updatedAt: now, updatedBy: job.updatedBy });
        await recordAuditEventHelper(ctx, { schoolId: job.schoolId, actorKind: "system",
          actorEmailSnapshot: "session scoring worker", module: "academic", action: "session_scoring.regrade_completed",
          targetType: "academicSessions", targetId: job.sessionId, outcome: "success",
          safeSummary: `Session scoring regrade completed at version ${version}; ${job.updated + page.page.length} records updated.`,
          alertTier: "tier1_critical" });
      }
      await ctx.db.patch(jobId, { cursor: page.isDone ? undefined : page.continueCursor,
        updated: job.updated + page.page.length, phase: page.isDone ? "complete" : "regrading", updatedAt: now });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.functions.academic.sessionScoring.driveSessionScoringJob, { jobId });
    return { phase: job.phase, processed: page.page.length, done: page.isDone };
  },
});

export const markSessionScoringFailure = internalMutation({
  args: { jobId: v.id("sessionScoringRegradeJobs"), reason: v.string() },
  handler: async (ctx, { jobId, reason }) => {
    const job = await ctx.db.get(jobId);
    if (!job || (job.phase !== "scanning" && job.phase !== "regrading")) return null;
    await ctx.db.patch(jobId, {
      phase: job.phase === "scanning" ? "failed_scanning" : "failed_regrading",
      failureReason: reason.slice(0, 200), updatedAt: Date.now(),
    });
    if (job.phase === "regrading") await recordAuditEventHelper(ctx, {
      schoolId: job.schoolId, actorKind: "system", actorEmailSnapshot: "session scoring worker",
      module: "academic", action: "session_scoring.regrade_failed", targetType: "academicSessions",
      targetId: job.sessionId, outcome: "failed",
      safeSummary: `Session scoring regrade stopped after ${job.updated} records. Administrator must repair and resume. Reason: ${reason.slice(0, 200)}`,
      alertTier: "tier1_critical",
    });
    return null;
  },
});

export const driveSessionScoringJob = internalAction({
  args: { jobId: v.id("sessionScoringRegradeJobs") },
  handler: async (ctx, { jobId }) => {
    try {
      await ctx.runMutation(internal.functions.academic.sessionScoring.processSessionScoringBatch, { jobId });
    } catch (error) {
      // The failed batch rolled back, including its cursor and any row patches.
      // Commit a separate failure marker so operators see a retryable stopped job.
      const reason = error instanceof Error ? error.message : "Batch failed";
      await ctx.runMutation(internal.functions.academic.sessionScoring.markSessionScoringFailure, { jobId, reason });
    }
  },
});
