import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "../../_generated/server";
import { makeFunctionReference } from "convex/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
import { isGroupPlatformOperator } from "./groups";
import { effectiveAllowance } from "./usageEntitlements";
import { recordAuditEventHelper } from "./audit";

const attemptId = v.id("usageOperationAttempts");
const TTL = 5 * 60_000;

async function owner(ctx: MutationCtx, attempt: Doc<"usageOperationAttempts">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || identity.tokenIdentifier !== attempt.actorTokenIdentifier) throw new ConvexError("Only the quoting teacher can use this attempt");
  await requireCapability(ctx, attempt.schoolId, "academic.planning.use");
}
async function meterFor(ctx: MutationCtx, attempt: Doc<"usageOperationAttempts">) {
  const rows = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", attempt.schoolId).eq("meterType", "ai_tokens")).take(2);
  if (rows.length !== 1 || rows[0].cycleId !== attempt.cycleId) throw new ConvexError("Cycle meter requires reconciliation");
  return rows[0];
}
async function active(ctx: MutationCtx, schoolId: Id<"schools">) {
  const now = Date.now();
  const cycles = await ctx.db.query("usageCycles").withIndex("by_school", q => q.eq("schoolId", schoolId)).take(101);
  if (cycles.length > 100) throw new ConvexError("Cycle history requires review");
  const current = cycles.filter(row => row.status === "active" && row.startAt <= now && now < row.endAt);
  if (current.length !== 1) throw new ConvexError("One active contract-bound cycle required");
  const contract = await ctx.db.get(current[0].contractId);
  if (!contract || contract.schoolId !== schoolId || contract.effectiveFrom > now || (contract.effectiveTo !== undefined && contract.effectiveTo <= now)) throw new ConvexError("Contract is not active");
  return current[0];
}
async function transition(ctx: MutationCtx, id: Id<"usageOperationAttempts">, state: "quoted" | "reserved" | "dispatch_started" | "cancelled" | "needs_reconciliation" | "settled") {
  await ctx.db.insert("usageOperationTransitions", { attemptId: id, state, createdAt: Date.now() });
}

// Only documentGeneration may supply this digest. No prompt, excerpts or model output are stored here.
export const quote = internalMutation({
  args: { schoolId: v.id("schools"), task: v.union(v.literal("teacher_lesson_plan"), v.literal("teacher_assessment")), digest: v.string(), modelId: v.string(), idempotencyKey: v.string(), minimumUnits: v.number() },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "academic.planning.use");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");
    if (!/^[a-f0-9]{64}$/.test(args.digest) || !args.modelId || args.modelId.length > 150 || !/^[a-zA-Z0-9_-]{8,100}$/.test(args.idempotencyKey) || !Number.isSafeInteger(args.minimumUnits) || args.minimumUnits < 1) throw new ConvexError("Invalid bounded AI request");
    const cycle = await active(ctx, args.schoolId);
    const profile = cycle.entitlement.profiles.find(row => row.task === args.task);
    if (!profile || profile.meterType !== "ai_tokens" || profile.maxItems < 1 || profile.unitsPerItem < args.minimumUnits || profile.modelProfile !== args.modelId) throw new ConvexError("Publish a reviewed AI profile for this model and worst-case token hold");
    const existing = await ctx.db.query("usageOperationAttempts").withIndex("by_school_and_idempotency", q => q.eq("schoolId", args.schoolId).eq("idempotencyKey", args.idempotencyKey)).unique();
    if (existing) {
      if (existing.cycleId !== cycle._id || existing.actorTokenIdentifier !== identity.tokenIdentifier || existing.task !== args.task || existing.requestDigest !== args.digest || existing.modelId !== args.modelId || existing.estimatedUnits !== profile.unitsPerItem || existing.status === "cancelled") throw new ConvexError("Operation ID is bound to different work");
      return { attemptId: existing._id, estimate: existing.estimatedUnits, modelProfile: existing.modelProfile, expiresAt: existing.expiresAt!, status: existing.status };
    }
    const meter = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", args.schoolId).eq("meterType", "ai_tokens")).take(2);
    const allowance = await effectiveAllowance(ctx, cycle, "ai_tokens");
    if (meter.length !== 1 || meter[0].cycleId !== cycle._id || !allowance) throw new ConvexError("AI meter requires reconciliation");
    if (meter[0].aiOverageRequiresReview) throw new ConvexError("AI overage requires Platform review");
    const available = Math.floor(allowance.allocatedUnits * cycle.entitlement.hardStopPercent / 100) - meter[0].consumedUnits - meter[0].reservedUnits;
    if (profile.unitsPerItem > available) throw new ConvexError(`AI allowance short by ${profile.unitsPerItem - available} tokens`);
    const now = Date.now();
    const expiresAt = Math.min(now + TTL, cycle.endAt);
    const id = await ctx.db.insert("usageOperationAttempts", { schoolId: args.schoolId, cycleId: cycle._id, idempotencyKey: args.idempotencyKey, task: args.task, meterType: "ai_tokens", itemCount: 1, estimatedUnits: profile.unitsPerItem, modelProfile: profile.modelProfile, status: "quoted", actorTokenIdentifier: identity.tokenIdentifier, requestDigest: args.digest, modelId: args.modelId, expiresAt, createdAt: now, updatedAt: now });
    await transition(ctx, id, "quoted");
    await ctx.scheduler.runAfter(expiresAt - now, makeFunctionReference<"mutation", { attemptId: Id<"usageOperationAttempts"> }>("functions/academic/aiSpend:expire"), { attemptId: id });
    return { attemptId: id, estimate: profile.unitsPerItem, modelProfile: profile.modelProfile, expiresAt, status: "quoted" as const };
  },
});

export const confirm = mutation({
  args: { attemptId, expectedUnits: v.number(), confirmation: v.string() },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || !attempt.requestDigest) throw new ConvexError("AI quote unavailable");
    await owner(ctx, attempt);
    if (args.confirmation !== "CONFIRM" || args.expectedUnits !== attempt.estimatedUnits) throw new ConvexError("Review the token hold and confirm it explicitly");
    if (attempt.status === "reserved") return { status: attempt.status, attemptId: attempt._id };
    if (attempt.status !== "quoted" || !attempt.expiresAt || attempt.expiresAt <= Date.now()) throw new ConvexError("Quote expired or already dispatched; request status before trying again");
    const cycle = await active(ctx, attempt.schoolId);
    if (cycle._id !== attempt.cycleId) throw new ConvexError("Cycle changed; requote");
    const profile = cycle.entitlement.profiles.find(row => row.task === attempt.task);
    if (!profile || profile.meterType !== "ai_tokens" || profile.unitsPerItem !== attempt.estimatedUnits || profile.modelProfile !== attempt.modelId) throw new ConvexError("AI profile changed; requote");
    const meter = await meterFor(ctx, attempt);
    const allowance = await effectiveAllowance(ctx, cycle, "ai_tokens");
    if (!allowance) throw new ConvexError("Allowance unavailable");
    if (meter.aiOverageRequiresReview) throw new ConvexError("AI overage requires Platform review");
    const available = Math.floor(allowance.allocatedUnits * cycle.entitlement.hardStopPercent / 100) - meter.consumedUnits - meter.reservedUnits;
    if (available < attempt.estimatedUnits) throw new ConvexError(`AI allowance short by ${attempt.estimatedUnits - available} tokens`);
    await ctx.db.patch(meter._id, { reservedUnits: meter.reservedUnits + attempt.estimatedUnits, updatedAt: Date.now() });
    await ctx.db.patch(attempt._id, { status: "reserved", updatedAt: Date.now() });
    await transition(ctx, attempt._id, "reserved");
    return { status: "reserved" as const, attemptId: attempt._id };
  },
});

export const claim = internalMutation({
  args: { attemptId, digest: v.string(), modelId: v.string() },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || !attempt.requestDigest) throw new ConvexError("AI attempt unavailable");
    await owner(ctx, attempt);
    if (attempt.status !== "reserved" || attempt.expiresAt === undefined || Date.now() >= attempt.expiresAt || attempt.requestDigest !== args.digest || attempt.modelId !== args.modelId) throw new ConvexError("AI request changed, expired or already dispatched; do not replay");
    const cycle = await active(ctx, attempt.schoolId);
    if (cycle._id !== attempt.cycleId) throw new ConvexError("Cycle changed");
    const meter = await meterFor(ctx, attempt);
    const allowance = await effectiveAllowance(ctx, cycle, "ai_tokens");
    if (!allowance || meter.aiOverageRequiresReview || meter.reservedUnits < attempt.estimatedUnits || Math.floor(allowance.allocatedUnits * cycle.entitlement.hardStopPercent / 100) < meter.consumedUnits + meter.reservedUnits) throw new ConvexError("Held AI allowance needs review");
    await ctx.db.patch(attempt._id, { status: "dispatch_started", updatedAt: Date.now() });
    await transition(ctx, attempt._id, "dispatch_started");
    return attempt.estimatedUnits;
  },
});

export const settle = internalMutation({
  args: { attemptId, inputTokens: v.number(), outputTokens: v.number(), outcome: v.string(), evidence: v.string() },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || !attempt.requestDigest) throw new ConvexError("AI attempt unavailable");
    if (attempt.status === "settled") {
      if (attempt.inputTokens !== args.inputTokens || attempt.outputTokens !== args.outputTokens || attempt.outcome !== args.outcome || attempt.evidence !== args.evidence) throw new ConvexError("Conflicting AI settlement");
      return attempt.actualUnits!;
    }
    if (attempt.status !== "dispatch_started" && attempt.status !== "needs_reconciliation") throw new ConvexError("No dispatched AI attempt to settle");
    if (![args.inputTokens, args.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0) || !Number.isSafeInteger(args.inputTokens + args.outputTokens) || !/^(succeeded|failed)$/.test(args.outcome) || !args.evidence || args.evidence.length > 2000) throw new ConvexError("Provider token evidence invalid");
    const meter = await meterFor(ctx, attempt);
    if (meter.reservedUnits < attempt.estimatedUnits || !Number.isSafeInteger(meter.consumedUnits + args.inputTokens + args.outputTokens)) throw new ConvexError("Meter requires reconciliation");
    const actual = args.inputTokens + args.outputTokens;
    await ctx.db.patch(meter._id, { consumedUnits: meter.consumedUnits + actual, reservedUnits: meter.reservedUnits - attempt.estimatedUnits, aiOverageRequiresReview: meter.aiOverageRequiresReview || actual > attempt.estimatedUnits, updatedAt: Date.now() });
    await ctx.db.patch(attempt._id, { status: "settled", actualUnits: actual, inputTokens: args.inputTokens, outputTokens: args.outputTokens, outcome: args.outcome, evidence: args.evidence, overage: actual > attempt.estimatedUnits, updatedAt: Date.now() });
    await ctx.db.insert("usageEvents", { schoolId: attempt.schoolId, meterType: "ai_tokens", unitsDelta: actual, reservationId: String(attempt._id), measurementMetadata: { source: "provider_reported_tokens", measuredAt: Date.now(), reference: String(attempt._id) }, operationName: attempt.task, description: "Measured AI generation token use", timestamp: Date.now() });
    await transition(ctx, attempt._id, "settled");
    return actual;
  },
});

export const uncertain = internalMutation({
  args: { attemptId },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attemptId);
    if (!row || !row.requestDigest || row.status === "settled") return;
    if (row.status !== "dispatch_started" && row.status !== "needs_reconciliation") throw new ConvexError("No dispatched attempt");
    if (row.status !== "needs_reconciliation") {
      await ctx.db.patch(row._id, { status: "needs_reconciliation", updatedAt: Date.now() });
      await transition(ctx, row._id, "needs_reconciliation");
    }
  },
});

export const expire = internalMutation({
  args: { attemptId },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attemptId);
    if (!row?.requestDigest || !row.expiresAt || row.expiresAt > Date.now()) return;
    if (row.status === "quoted") { await ctx.db.patch(row._id, { status: "cancelled", updatedAt: Date.now() }); await transition(ctx, row._id, "cancelled"); }
    if (row.status === "reserved") {
      const meter = await meterFor(ctx, row);
      if (meter.reservedUnits < row.estimatedUnits) throw new ConvexError("Meter requires reconciliation");
      await ctx.db.patch(meter._id, { reservedUnits: meter.reservedUnits - row.estimatedUnits, updatedAt: Date.now() });
      await ctx.db.patch(row._id, { status: "cancelled", updatedAt: Date.now() });
      await transition(ctx, row._id, "cancelled");
    }
    if (row.status === "dispatch_started") { await ctx.db.patch(row._id, { status: "needs_reconciliation", updatedAt: Date.now() }); await transition(ctx, row._id, "needs_reconciliation"); }
  },
});

export const cancel = mutation({
  args: { attemptId },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attemptId);
    if (!row?.requestDigest) throw new ConvexError("AI quote unavailable");
    await owner(ctx, row);
    if (row.status === "cancelled") return row._id;
    if (row.status !== "quoted" && row.status !== "reserved") throw new ConvexError("Dispatched AI work cannot be cancelled");
    if (row.status === "reserved") {
      const meter = await meterFor(ctx, row);
      if (meter.reservedUnits < row.estimatedUnits) throw new ConvexError("Meter requires reconciliation");
      await ctx.db.patch(meter._id, { reservedUnits: meter.reservedUnits - row.estimatedUnits, updatedAt: Date.now() });
    }
    await ctx.db.patch(row._id, { status: "cancelled", updatedAt: Date.now() });
    await transition(ctx, row._id, "cancelled");
    return row._id;
  },
});

export const status = query({
  args: { attemptId },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attemptId);
    const identity = await ctx.auth.getUserIdentity();
    if (!row?.requestDigest || !identity || row.actorTokenIdentifier !== identity.tokenIdentifier) throw new ConvexError("AI attempt unavailable");
    await requireCapability(ctx, row.schoolId, "academic.planning.use");
    return { status: row.status, estimate: row.estimatedUnits, actualUnits: row.actualUnits ?? null, outcome: row.outcome ?? null, resultId: row.resultId ?? null, expiresAt: row.expiresAt ?? null };
  },
});

// Platform operators must use external provider evidence before entering measured totals.
// An uncertain call is never replayed or released by elapsed time.
export const reconcile = mutation({
  args: { attemptId, inputTokens: v.number(), outputTokens: v.number(), outcome: v.union(v.literal("succeeded"), v.literal("failed")), evidence: v.string(), reason: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    if (!(await isGroupPlatformOperator(ctx)) || args.confirmation !== "RECONCILE") throw new ConvexError("Platform reconciliation confirmation required");
    const row = await ctx.db.get(args.attemptId);
    if (!row?.requestDigest || row.status !== "needs_reconciliation" || args.reason.trim().length < 8 || args.reason.length > 240 || !/^[a-zA-Z0-9:_./-]{8,200}$/.test(args.evidence)) throw new ConvexError("Document the provider evidence and reason before reconciling");
    const actual: number = await ctx.runMutation(makeFunctionReference<"mutation", { attemptId: Id<"usageOperationAttempts">; inputTokens: number; outputTokens: number; outcome: string; evidence: string }, number>("functions/academic/aiSpend:settle"), { attemptId: row._id, inputTokens: args.inputTokens, outputTokens: args.outputTokens, outcome: args.outcome, evidence: args.evidence });
    await recordAuditEventHelper(ctx, { schoolId: row.schoolId, actorKind: "platform_admin", actorEmailSnapshot: (await ctx.auth.getUserIdentity())?.email ?? "authenticated operator", module: "commercial", action: "usage.ai_reconciled", targetType: "usage_entitlement", targetId: String(row._id), outcome: "success", safeSummary: `Provider evidence ${args.evidence}; ${args.reason.trim()}; ${actual} tokens`, retentionClass: "permanent_statutory", alertTier: "tier2_warn" });
    return actual;
  },
});

export const reviewOverage = mutation({
  args: { attemptId, evidence: v.string(), reason: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    if (!(await isGroupPlatformOperator(ctx)) || args.confirmation !== "REVIEW") throw new ConvexError("Platform overage review required");
    const row = await ctx.db.get(args.attemptId);
    if (!row?.overage || row.overageReviewedAt || row.status !== "settled" || !/^[a-zA-Z0-9:_./-]{8,200}$/.test(args.evidence) || args.reason.trim().length < 8 || args.reason.length > 240) throw new ConvexError("Reviewed overage evidence required");
    const meter = await meterFor(ctx, row);
    // Other overages may still be awaiting review. Keep the meter blocked in that case.
    const recent = await ctx.db.query("usageOperationAttempts").withIndex("by_school", q => q.eq("schoolId", row.schoolId)).order("desc").take(101);
    if (recent.length > 100) throw new ConvexError("Overage history exceeds review bound");
    const outstanding = recent.some(other => other._id !== row._id && other.cycleId === row.cycleId && other.overage && !other.overageReviewedAt);
    await ctx.db.patch(row._id, { overageReviewedAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.patch(meter._id, { aiOverageRequiresReview: outstanding, updatedAt: Date.now() });
    await recordAuditEventHelper(ctx, { schoolId: row.schoolId, actorKind: "platform_admin", actorEmailSnapshot: (await ctx.auth.getUserIdentity())?.email ?? "authenticated operator", module: "commercial", action: "usage.ai_overage_reviewed", targetType: "usage_entitlement", targetId: String(row._id), outcome: "success", safeSummary: `Provider evidence ${args.evidence}; ${args.reason.trim()}; ${row.actualUnits} tokens`, retentionClass: "permanent_statutory", alertTier: "tier2_warn" });
    return row._id;
  },
});

export const unresolved = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    if (!(await isGroupPlatformOperator(ctx))) throw new ConvexError("Platform authority required");
    const rows = await ctx.db.query("usageOperationAttempts").withIndex("by_status_and_updatedAt", q => q.eq("status", "needs_reconciliation")).order("desc").take(100);
    return rows.filter(row => row.schoolId === args.schoolId).map(row => ({ id: row._id, cycleId: row.cycleId, modelId: row.modelId, estimatedUnits: row.estimatedUnits, updatedAt: row.updatedAt }));
  },
});
