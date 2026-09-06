import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { isGroupPlatformOperator } from "./groups";
import { requireGroupOwner } from "./groupSettings";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import { heavyUsageTask, safePositive, usageEntitlement, usageMeterType, validateEntitlement, type HeavyUsageTask } from "../foundation/usageContract";

type Context = QueryCtx | MutationCtx;
const DAY = 86400000;
const taskCapability: Record<HeavyUsageTask, string> = {
  teacher_lesson_plan: "academic.planning.use", provider_ocr: "academic.planning.use",
  knowledge_upload: "assets.upload", curriculum_generation: "academic.curriculum.manage", ai_import: "enrollment.intakes.manage",
};
function bounded(value: string, label: string, min = 1) {
  const text = value.trim();
  if (text.length < min || text.length > 240) throw new ConvexError(`${label} must be ${min}–240 characters`);
  return text;
}
function validPeriod(startAt: number, endAt: number) {
  if (!Number.isSafeInteger(startAt) || !Number.isSafeInteger(endAt) || startAt % DAY || endAt % DAY || startAt >= endAt) throw new ConvexError("Use an increasing UTC-midnight period, end exclusive");
}
async function platform(ctx: MutationCtx, journalSchoolId: Id<"schools">, confirmation: string) {
  if (!(await isGroupPlatformOperator(ctx))) throw new ConvexError("Forbidden: active Platform authority required");
  if (confirmation !== "CONFIRM") throw new ConvexError("Type CONFIRM after reviewing the allowance record");
  if (!(await ctx.db.get(journalSchoolId))) throw new ConvexError("Audit school unavailable");
}
async function audit(ctx: MutationCtx, schoolId: Id<"schools">, action: string, targetId: string, summary: string, actorPersonId?: Id<"persons">) {
  const identity = await ctx.auth.getUserIdentity();
  await recordAuditEventHelper(ctx, { schoolId, actorKind: actorPersonId ? "user" : "platform_admin", actorPersonId, actorEmailSnapshot: identity?.email ?? "authenticated operator", module: "commercial", action, targetType: "usage_entitlement", targetId, outcome: "success", safeSummary: summary, retentionClass: "permanent_statutory", alertTier: "tier2_warn" });
}
async function currentCycle(ctx: Context, schoolId: Id<"schools">, now = Date.now()) {
  const cycles = await ctx.db.query("usageCycles").withIndex("by_school", q => q.eq("schoolId", schoolId)).take(101);
  if (cycles.length > 100) throw new ConvexError("Usage cycle history exceeds review bound");
  const active = cycles.filter(row => row.status === "active" && row.startAt <= now && row.endAt > now);
  if (active.length > 1) throw new ConvexError("Overlapping usage cycles require reconciliation");
  return active[0] ?? null;
}
export async function effectiveAllowance(ctx: Context, cycle: Doc<"usageCycles">, meterType: Doc<"usageMeterAllocations">["meterType"], now = Date.now()) {
  const base = cycle.entitlement.allowances.find(row => row.meterType === meterType);
  if (!base) return null;
  const grants = await ctx.db.query("usageAllowanceGrants").withIndex("by_cycle", q => q.eq("cycleId", cycle._id)).take(101);
  const allocations = await ctx.db.query("usageBranchPoolAllocations").withIndex("by_cycle", q => q.eq("cycleId", cycle._id)).take(101);
  if (grants.length > 100 || allocations.length > 100) throw new ConvexError("Allowance grant history exceeds review bound");
  if (grants.some(row => row.schoolId !== cycle.schoolId)) throw new ConvexError("Allowance grant provenance requires reconciliation");
  const activeGrants = grants.filter(row => row.meterType === meterType && (row.expiresAt === undefined || row.expiresAt > now));
  const topUpUnits = activeGrants.filter(row => row.kind === "top_up").reduce((sum, row) => sum + row.units, 0);
  const exceptionUnits = activeGrants.filter(row => row.kind === "exception").reduce((sum, row) => sum + row.units, 0);
  let poolUnits = 0;
  for (const row of allocations) {
    if (row.schoolId !== cycle.schoolId) throw new ConvexError("Branch pool allocation requires reconciliation");
    const pool = await ctx.db.get(row.poolId);
    if (!pool) throw new ConvexError("Branch pool provenance is unavailable");
    if (
      pool.meterType !== meterType ||
      pool.entitlementVersionId !== cycle.entitlementVersionId ||
      pool.startAt > now ||
      pool.endAt <= now
    ) continue;
    const [link, group] = await Promise.all([
      ctx.db.query("schoolGroupBranches").withIndex("by_group_and_school", q => q.eq("groupId", pool.groupId).eq("schoolId", cycle.schoolId)).unique(),
      ctx.db.get(pool.groupId),
    ]);
    if (link && group?.status === "active") poolUnits += row.units;
  }
  return { baseUnits: base.baseUnits, graceUnits: base.graceUnits, topUpUnits, exceptionUnits, poolUnits, allocatedUnits: base.baseUnits + base.graceUnits + topUpUnits + exceptionUnits + poolUnits };
}
async function allocation(ctx: Context, schoolId: Id<"schools">, meterType: Doc<"usageMeterAllocations">["meterType"]) {
  const rows = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", meterType)).take(2);
  if (rows.length !== 1) throw new ConvexError(rows.length ? "Duplicate meter requires reconciliation" : "Meter allocation unavailable");
  return rows[0];
}
function dispatchAvailable(allocatedUnits: number, hardStopPercent: number, consumedUnits: number, reservedUnits: number) {
  return Math.max(0, Math.floor(allocatedUnits * hardStopPercent / 100) - consumedUnits - reservedUnits);
}
export const publishEntitlementVersion = mutation({
  args: { journalSchoolId: v.id("schools"), code: v.string(), name: v.string(), expectedVersion: v.number(), effectiveFrom: v.number(), entitlement: usageEntitlement, confirmation: v.string() },
  handler: async (ctx, args) => {
    await platform(ctx, args.journalSchoolId, args.confirmation); validateEntitlement(args.entitlement);
    if (!/^[a-z][a-z0-9_]{2,39}$/.test(args.code) || !args.name.trim() || args.name.length > 100 || !Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0) throw new ConvexError("Invalid entitlement code, name or expected version");
    const latest = await ctx.db.query("usageEntitlementVersions").withIndex("by_code_and_version", q => q.eq("code", args.code)).order("desc").first();
    if ((latest?.version ?? 0) !== args.expectedVersion) throw new ConvexError("Entitlement version conflict: reload");
    if (latest && (args.effectiveFrom <= latest.effectiveFrom || args.effectiveFrom < Date.now())) throw new ConvexError("A subsequent entitlement version must have a future increasing effective date");
    const id = await ctx.db.insert("usageEntitlementVersions", { code: args.code, name: args.name.trim(), version: args.expectedVersion + 1, effectiveFrom: args.effectiveFrom, entitlement: args.entitlement, createdAt: Date.now() });
    await audit(ctx, args.journalSchoolId, "usage.entitlement_version_published", id, "Published immutable plan entitlement version; no school allowance activated"); return id;
  },
});
export const startUsageCycle = mutation({
  args: { schoolId: v.id("schools"), contractId: v.id("commercialContracts"), entitlementVersionId: v.id("usageEntitlementVersions"), startAt: v.number(), endAt: v.number(), confirmation: v.string() },
  handler: async (ctx, args) => {
    await platform(ctx, args.schoolId, args.confirmation); validPeriod(args.startAt, args.endAt);
    const [contract, version] = await Promise.all([ctx.db.get(args.contractId), ctx.db.get(args.entitlementVersionId)]);
    if (!contract || contract.schoolId !== args.schoolId || contract.effectiveFrom > args.startAt || (contract.effectiveTo !== undefined && contract.effectiveTo < args.endAt) || !version || version.effectiveFrom > args.startAt) throw new ConvexError("Matching effective contract and entitlement version required for the complete cycle");
    const cycles = await ctx.db.query("usageCycles").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).take(101);
    if (cycles.length > 100 || cycles.some(row => args.startAt < row.endAt && args.endAt > row.startAt)) throw new ConvexError("Usage cycle overlaps history or exceeds review bound");
    if (cycles.some(row => row.status !== "closed")) throw new ConvexError("Close and reconcile the prior usage cycle before starting another");
    const id = await ctx.db.insert("usageCycles", { schoolId: args.schoolId, contractId: contract._id, entitlementVersionId: version._id, code: version.code, version: version.version, entitlement: version.entitlement, startAt: args.startAt, endAt: args.endAt, status: "active", createdAt: Date.now() });
    for (const row of version.entitlement.allowances) {
      const existing = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", args.schoolId).eq("meterType", row.meterType)).take(2);
      if (existing.length > 1 || existing[0]?.reservedUnits) throw new ConvexError("Existing meter requires reviewed cycle reconciliation");
      if (existing[0]?.cycleId) {
        const [priorCycle, snapshot] = await Promise.all([
          ctx.db.get(existing[0].cycleId),
          ctx.db.query("usageCycleMeterSnapshots").withIndex("by_cycle_and_meter", q => q.eq("cycleId", existing[0]!.cycleId!).eq("meterType", row.meterType)).unique(),
        ]);
        if (!priorCycle || priorCycle.status !== "closed" || !snapshot) throw new ConvexError("Existing meter requires reviewed cycle reconciliation");
      }
      const value = { schoolId: args.schoolId, cycleId: id, meterType: row.meterType, allocatedUnits: row.baseUnits + row.graceUnits, baseUnits: row.baseUnits, graceUnits: row.graceUnits, topUpUnits: 0, exceptionUnits: 0, poolUnits: 0, consumedUnits: 0, reservedUnits: 0, activeStorageBytes: 0, trashStorageBytes: 0, tempStorageBytes: 0, warningThresholdPercent: version.entitlement.warningPercent, criticalThresholdPercent: version.entitlement.criticalPercent, hardStopThresholdPercent: version.entitlement.hardStopPercent, resetCadence: contract.rate.cadence === "annually" ? "termly" as const : "termly" as const, lastResetAt: args.startAt, updatedAt: Date.now() };
      if (existing[0]) await ctx.db.replace(existing[0]._id, value); else await ctx.db.insert("usageMeterAllocations", value);
    }
    await audit(ctx, args.schoolId, "usage.cycle_started", id, "Activated explicit contract-bound entitlement cycle; no payment inferred"); return id;
  },
});
export const closeUsageCycle = mutation({
  args: {
    schoolId: v.id("schools"), cycleId: v.id("usageCycles"),
    expectedMeters: v.array(v.object({ meterType: usageMeterType, allocatedUnits: v.number(), consumedUnits: v.number() })),
    reconciliationNote: v.string(), confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirmation !== "CLOSE") throw new ConvexError("Type CLOSE after reviewing final meter balances");
    await platform(ctx, args.schoolId, "CONFIRM");
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle || cycle.schoolId !== args.schoolId) throw new ConvexError("Usage cycle unavailable");
    if (cycle.status === "closed") return cycle._id;
    if (Date.now() < cycle.endAt) throw new ConvexError("Usage cycle cannot close before its end boundary");
    const note = bounded(args.reconciliationNote, "Reconciliation note", 8);
    const expected = new Map(args.expectedMeters.map(row => [row.meterType, row]));
    if (expected.size !== args.expectedMeters.length || expected.size !== cycle.entitlement.allowances.length) throw new ConvexError("Review one closing balance for every cycle meter");
    for (const allowance of cycle.entitlement.allowances) {
      const meter = await allocation(ctx, args.schoolId, allowance.meterType);
      const reviewed = expected.get(allowance.meterType);
      // Grant/allocation rows remain the cumulative provenance ledger. Closing source totals
      // instead mean effective at the cycle's exclusive end boundary, never cumulative issued.
      const effectiveAtClose = await effectiveAllowance(ctx, cycle, allowance.meterType, cycle.endAt);
      if (meter.cycleId !== cycle._id || !reviewed || !effectiveAtClose || effectiveAtClose.allocatedUnits !== reviewed.allocatedUnits || meter.consumedUnits !== reviewed.consumedUnits) throw new ConvexError("Effective-at-close usage balances changed; reload and reconcile");
      if (meter.reservedUnits !== 0) throw new ConvexError("Usage cycle has active reservations");
      await ctx.db.insert("usageCycleMeterSnapshots", {
        schoolId: args.schoolId, cycleId: cycle._id, meterType: meter.meterType,
        allocatedUnits: effectiveAtClose.allocatedUnits, baseUnits: effectiveAtClose.baseUnits, graceUnits: effectiveAtClose.graceUnits,
        topUpUnits: effectiveAtClose.topUpUnits, exceptionUnits: effectiveAtClose.exceptionUnits, poolUnits: effectiveAtClose.poolUnits,
        consumedUnits: meter.consumedUnits, reservedUnits: meter.reservedUnits,
        activeStorageBytes: meter.activeStorageBytes ?? 0, trashStorageBytes: meter.trashStorageBytes ?? 0, tempStorageBytes: meter.tempStorageBytes ?? 0,
        reconciledAt: Date.now(),
      });
    }
    await ctx.db.patch(cycle._id, { status: "closed", closedAt: Date.now(), reconciliationNote: note });
    await audit(ctx, args.schoolId, "usage.cycle_closed", cycle._id, "Closed and snapshotted effective-at-end allowance with reviewed consumption and no active reservations");
    return cycle._id;
  },
});
export const recordTopUpGrant = mutation({
  args: { schoolId: v.id("schools"), cycleId: v.id("usageCycles"), meterType: usageMeterType, units: v.number(), evidenceReference: v.string(), reason: v.string(), expiresAt: v.optional(v.number()), confirmation: v.string() },
  handler: async (ctx, args) => {
    await platform(ctx, args.schoolId, args.confirmation); safePositive(args.units, "Grant units");
    const cycle = await ctx.db.get(args.cycleId); if (!cycle || cycle.schoolId !== args.schoolId || cycle.startAt > Date.now() || cycle.endAt <= Date.now() || !cycle.entitlement.allowances.some(row => row.meterType === args.meterType)) throw new ConvexError("Current cycle meter unavailable");
    if (args.expiresAt !== undefined && (args.expiresAt <= Date.now() || args.expiresAt > cycle.endAt)) throw new ConvexError("Grant expiry must be future and within the cycle");
    const reference = bounded(args.evidenceReference, "Evidence reference", 3); const reason = bounded(args.reason, "Grant reason", 8);
    const rows = await ctx.db.query("usageAllowanceGrants").withIndex("by_cycle", q => q.eq("cycleId", cycle._id)).take(101);
    const duplicate = rows.find(row => row.kind === "top_up" && row.evidenceReference === reference);
    if (duplicate) { if (duplicate.units !== args.units || duplicate.meterType !== args.meterType || duplicate.expiresAt !== args.expiresAt || duplicate.reason !== reason) throw new ConvexError("Conflicting top-up evidence"); return duplicate._id; }
    if (rows.length > 100) throw new ConvexError("Grant history exceeds review bound");
    const id = await ctx.db.insert("usageAllowanceGrants", { schoolId: args.schoolId, cycleId: cycle._id, meterType: args.meterType, kind: "top_up", units: args.units, evidenceReference: reference, reason, expiresAt: args.expiresAt, createdAt: Date.now() });
    const meter = await allocation(ctx, args.schoolId, args.meterType); const effective = await effectiveAllowance(ctx, cycle, args.meterType); if (!effective) throw new ConvexError("Meter unavailable");
    await ctx.db.patch(meter._id, { allocatedUnits: effective.allocatedUnits, topUpUnits: effective.topUpUnits, updatedAt: Date.now() });
    await audit(ctx, args.schoolId, "usage.top_up_granted", id, "Recorded reviewed allowance grant; no purchase or money movement occurred"); return id;
  },
});
export const requestUsageException = mutation({
  args: { schoolId: v.id("schools"), cycleId: v.id("usageCycles"), meterType: usageMeterType, units: v.number(), reason: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, "finance.reports.view"); if (args.confirmation !== "REQUEST") throw new ConvexError("Type REQUEST after reviewing exception units"); safePositive(args.units, "Exception units");
    const cycle = await ctx.db.get(args.cycleId); if (!cycle || cycle.schoolId !== args.schoolId || cycle.startAt > Date.now() || cycle.endAt <= Date.now() || !cycle.entitlement.allowances.some(row => row.meterType === args.meterType)) throw new ConvexError("Current cycle meter unavailable");
    const id = await ctx.db.insert("usageExceptionRequests", { schoolId: args.schoolId, cycleId: cycle._id, meterType: args.meterType, units: args.units, reason: bounded(args.reason, "Exception reason", 8), requestedByPersonId: auth.personId, requestedAt: Date.now() });
    await audit(ctx, args.schoolId, "usage.exception_requested", id, "Requested allowance exception; no allowance granted", auth.personId); return id;
  },
});
export const decideUsageException = mutation({
  args: { schoolId: v.id("schools"), requestId: v.id("usageExceptionRequests"), outcome: v.union(v.literal("approved"), v.literal("declined")), reason: v.string(), expiresAt: v.optional(v.number()), confirmation: v.string() },
  handler: async (ctx, args) => {
    await platform(ctx, args.schoolId, args.confirmation); const request = await ctx.db.get(args.requestId); if (!request || request.schoolId !== args.schoolId) throw new ConvexError("Exception request unavailable");
    const existing = await ctx.db.query("usageExceptionDecisions").withIndex("by_request", q => q.eq("requestId", request._id)).unique(); if (existing) { if (existing.outcome !== args.outcome || existing.reason !== args.reason.trim()) throw new ConvexError("Conflicting exception decision retry"); return existing._id; }
    const cycle = await ctx.db.get(request.cycleId); if (!cycle || cycle.startAt > Date.now() || cycle.endAt <= Date.now()) throw new ConvexError("Current cycle unavailable");
    if (args.expiresAt !== undefined && (args.expiresAt <= Date.now() || args.expiresAt > cycle.endAt)) throw new ConvexError("Exception expiry must be within cycle");
    let grantId: Id<"usageAllowanceGrants"> | undefined;
    if (args.outcome === "approved") grantId = await ctx.db.insert("usageAllowanceGrants", { schoolId: args.schoolId, cycleId: cycle._id, meterType: request.meterType, kind: "exception", units: request.units, evidenceReference: `exception:${request._id}`, reason: bounded(args.reason, "Decision reason", 8), expiresAt: args.expiresAt, createdAt: Date.now() });
    const id = await ctx.db.insert("usageExceptionDecisions", { requestId: request._id, outcome: args.outcome, reason: bounded(args.reason, "Decision reason", 8), grantId, createdAt: Date.now() });
    if (grantId) { const meter = await allocation(ctx, args.schoolId, request.meterType); const effective = await effectiveAllowance(ctx, cycle, request.meterType); if (!effective) throw new ConvexError("Meter unavailable"); await ctx.db.patch(meter._id, { allocatedUnits: effective.allocatedUnits, exceptionUnits: effective.exceptionUnits, updatedAt: Date.now() }); }
    await audit(ctx, args.schoolId, `usage.exception_${args.outcome}`, id, args.outcome === "approved" ? "Approved bounded allowance exception; no payment occurred" : "Declined allowance exception; no allowance changed"); return id;
  },
});
export const createGroupPool = mutation({
  args: { journalSchoolId: v.id("schools"), groupId: v.id("schoolGroups"), entitlementVersionId: v.id("usageEntitlementVersions"), meterType: usageMeterType, totalUnits: v.number(), startAt: v.number(), endAt: v.number(), reason: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => { await platform(ctx, args.journalSchoolId, args.confirmation); validPeriod(args.startAt, args.endAt); safePositive(args.totalUnits, "Pool units"); const version = await ctx.db.get(args.entitlementVersionId); const group = await ctx.db.get(args.groupId); if (!version || version.effectiveFrom > args.startAt || !group || group.status !== "active" || !version.entitlement.allowances.some(row => row.meterType === args.meterType)) throw new ConvexError("Effective group entitlement meter unavailable"); const id = await ctx.db.insert("usageGroupPools", { groupId: group._id, entitlementVersionId: version._id, meterType: args.meterType, totalUnits: args.totalUnits, startAt: args.startAt, endAt: args.endAt, reason: bounded(args.reason, "Pool reason", 8), createdAt: Date.now() }); await audit(ctx, args.journalSchoolId, "usage.group_pool_created", id, "Created bounded group allowance pool; no branch allocation or purchase inferred"); return id; },
});
export const allocateGroupPoolToBranch = mutation({
  args: { poolId: v.id("usageGroupPools"), schoolId: v.id("schools"), cycleId: v.id("usageCycles"), idempotencyKey: v.string(), units: v.number(), reason: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    if (args.confirmation !== "ALLOCATE") throw new ConvexError("Type ALLOCATE after reviewing branch units");
    safePositive(args.units, "Branch units");
    const key = bounded(args.idempotencyKey, "Allocation ID", 8);
    const reason = bounded(args.reason, "Allocation reason", 8);
    const pool = await ctx.db.get(args.poolId); if (!pool) throw new ConvexError("Pool unavailable");
    const { person } = await requireGroupOwner(ctx, pool.groupId);
    const existing = await ctx.db.query("usageBranchPoolAllocations").withIndex("by_pool_and_idempotencyKey", q => q.eq("poolId", pool._id).eq("idempotencyKey", key)).unique();
    if (existing) {
      if (existing.schoolId !== args.schoolId || existing.cycleId !== args.cycleId || existing.units !== args.units || existing.reason !== reason)
        throw new ConvexError("Allocation ID is bound to different branch units");
      return existing._id;
    }
    const link = await ctx.db.query("schoolGroupBranches").withIndex("by_group_and_school", q => q.eq("groupId", pool.groupId).eq("schoolId", args.schoolId)).unique(); const cycle = await ctx.db.get(args.cycleId);
    if (!link || !cycle || cycle.schoolId !== args.schoolId || cycle.entitlementVersionId !== pool.entitlementVersionId || Date.now() < cycle.startAt || Date.now() >= cycle.endAt || Date.now() < pool.startAt || Date.now() >= pool.endAt) throw new ConvexError("Linked branch with matching current entitlement cycle required");
    const rows = await ctx.db.query("usageBranchPoolAllocations").withIndex("by_pool", q => q.eq("poolId", pool._id)).take(101); if (rows.length > 100 || rows.reduce((sum, row) => sum + row.units, 0) + args.units > pool.totalUnits) throw new ConvexError("Pool allocation exceeds total or review bound");
    const id = await ctx.db.insert("usageBranchPoolAllocations", { poolId: pool._id, schoolId: args.schoolId, cycleId: cycle._id, idempotencyKey: key, units: args.units, reason, createdAt: Date.now() });
    const meter = await allocation(ctx, args.schoolId, pool.meterType); const effective = await effectiveAllowance(ctx, cycle, pool.meterType); if (!effective) throw new ConvexError("Meter unavailable"); await ctx.db.patch(meter._id, { allocatedUnits: effective.allocatedUnits, poolUnits: effective.poolUnits, updatedAt: Date.now() });
    await audit(ctx, args.schoolId, "usage.group_pool_allocated", id, "Proprietor allocated recorded pool units to linked branch", person._id); return id;
  },
});
async function authorizeTask(ctx: Context, schoolId: Id<"schools">, task: HeavyUsageTask) { return await requireCapability(ctx, schoolId, taskCapability[task]); }
export const quoteHeavyOperation = mutation({
  args: { schoolId: v.id("schools"), task: heavyUsageTask, itemCount: v.number(), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const auth = await authorizeTask(ctx, args.schoolId, args.task); safePositive(args.itemCount, "Work item count"); const key = bounded(args.idempotencyKey, "Operation ID", 8);
    const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new ConvexError("Authentication required");
    const cycle = await currentCycle(ctx, args.schoolId); if (!cycle) throw new ConvexError("No current contract-bound entitlement cycle"); const profile = cycle.entitlement.profiles.find(row => row.task === args.task); if (!profile || args.itemCount > profile.maxItems) throw new ConvexError("Operation exceeds configured task profile");
    const estimate = profile.unitsPerItem * args.itemCount; if (!Number.isSafeInteger(estimate)) throw new ConvexError("Estimated usage exceeds safe range");
    const existing = await ctx.db.query("usageOperationAttempts").withIndex("by_school_and_idempotency", q => q.eq("schoolId", args.schoolId).eq("idempotencyKey", key)).unique();
    if (existing) { if (existing.task !== args.task || existing.itemCount !== args.itemCount || existing.actorTokenIdentifier !== identity.tokenIdentifier) throw new ConvexError("Operation ID is bound to different work"); return existing; }
    const effective = await effectiveAllowance(ctx, cycle, profile.meterType); const meter = await allocation(ctx, args.schoolId, profile.meterType); if (!effective || meter.cycleId !== cycle._id) throw new ConvexError("Entitlement allocation requires reconciliation");
    const available = dispatchAvailable(effective.allocatedUnits, cycle.entitlement.hardStopPercent, meter.consumedUnits, meter.reservedUnits); if (estimate > available) throw new ConvexError(`Quota blocked: exact shortfall ${estimate - available} ${profile.meterType}. Reduce items or request reviewed allowance.`);
    const id = await ctx.db.insert("usageOperationAttempts", { schoolId: args.schoolId, cycleId: cycle._id, idempotencyKey: key, task: args.task, meterType: profile.meterType, itemCount: args.itemCount, estimatedUnits: estimate, modelProfile: profile.modelProfile, status: "quoted", actorTokenIdentifier: identity.tokenIdentifier, createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.insert("usageOperationTransitions", { attemptId: id, state: "quoted", createdAt: Date.now() });
    await audit(ctx, args.schoolId, "usage.operation_quoted", id, `Quoted ${estimate} ${profile.meterType}; no allowance reserved or charged`, auth.personId); return await ctx.db.get(id);
  },
});
export const confirmHeavyOperation = mutation({
  args: { schoolId: v.id("schools"), attemptId: v.id("usageOperationAttempts"), expectedUnits: v.number(), confirmation: v.string() },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId); if (!attempt || attempt.schoolId !== args.schoolId) throw new ConvexError("Operation quote unavailable"); await authorizeTask(ctx, args.schoolId, attempt.task);
    const identity = await ctx.auth.getUserIdentity(); if (!identity || identity.tokenIdentifier !== attempt.actorTokenIdentifier) throw new ConvexError("Only the quoting user may confirm this operation");
    if (attempt.status === "released_provider_unavailable") return { status: attempt.status, chargedUnits: 0, message: "Provider execution unavailable; reservation already released. No allowance charged." };
    if (attempt.status !== "quoted" || args.confirmation !== "CONFIRM" || args.expectedUnits !== attempt.estimatedUnits) throw new ConvexError("Review the current estimate and type CONFIRM");
    const cycle = await ctx.db.get(attempt.cycleId); if (!cycle || cycle.startAt > Date.now() || cycle.endAt <= Date.now()) throw new ConvexError("Entitlement cycle is no longer current"); const effective = await effectiveAllowance(ctx, cycle, attempt.meterType); const meter = await allocation(ctx, args.schoolId, attempt.meterType); if (!effective || meter.cycleId !== cycle._id) throw new ConvexError("Entitlement allocation requires reconciliation");
    const available = dispatchAvailable(effective.allocatedUnits, cycle.entitlement.hardStopPercent, meter.consumedUnits, meter.reservedUnits); if (attempt.estimatedUnits > available) throw new ConvexError(`Quota changed: exact shortfall ${attempt.estimatedUnits - available} ${attempt.meterType}`);
    // Deliberate local dispatch placeholder. The hold and release are atomic; no action/provider is invoked.
    await ctx.db.patch(meter._id, { reservedUnits: meter.reservedUnits + attempt.estimatedUnits, updatedAt: Date.now() });
    for (const state of ["reserved", "dispatch_started", "provider_unavailable", "released"] as const) await ctx.db.insert("usageOperationTransitions", { attemptId: attempt._id, state, createdAt: Date.now() });
    await ctx.db.patch(meter._id, { reservedUnits: meter.reservedUnits, updatedAt: Date.now() });
    await ctx.db.patch(attempt._id, { status: "released_provider_unavailable", updatedAt: Date.now() });
    await audit(ctx, args.schoolId, "usage.operation_provider_unavailable", attempt._id, "Confirmed operation reached disabled dispatch and released its reservation; customer allowance charged zero");
    return { status: "released_provider_unavailable" as const, chargedUnits: 0, message: "Provider execution unavailable; reserved estimate released. No allowance charged." };
  },
});
export const cancelHeavyOperation = mutation({
  args: { schoolId: v.id("schools"), attemptId: v.id("usageOperationAttempts") }, handler: async (ctx, args) => { const attempt = await ctx.db.get(args.attemptId); if (!attempt || attempt.schoolId !== args.schoolId) throw new ConvexError("Operation quote unavailable"); await authorizeTask(ctx, args.schoolId, attempt.task); const identity = await ctx.auth.getUserIdentity(); if (!identity || identity.tokenIdentifier !== attempt.actorTokenIdentifier) throw new ConvexError("Only the quoting user may cancel"); if (attempt.status === "cancelled") return attempt._id; if (attempt.status !== "quoted") throw new ConvexError("Only an unconfirmed quote may be cancelled"); await ctx.db.patch(attempt._id, { status: "cancelled", updatedAt: Date.now() }); await ctx.db.insert("usageOperationTransitions", { attemptId: attempt._id, state: "cancelled", createdAt: Date.now() }); return attempt._id; },
});
export const getUsageWorkspace = query({
  args: { schoolId: v.id("schools") }, handler: async (ctx, args) => { const platformUser = await isGroupPlatformOperator(ctx); if (!platformUser) await requireCapability(ctx, args.schoolId, "finance.reports.view"); const cycle = await currentCycle(ctx, args.schoolId); if (!cycle) return { cycle: null, meters: [], requests: [], groupPools: [], canAllocatePool: false, providerExecutionAvailable: false };
    const meters = []; for (const row of cycle.entitlement.allowances) { const effective = await effectiveAllowance(ctx, cycle, row.meterType); const meter = await allocation(ctx, args.schoolId, row.meterType); if (effective) meters.push({ meterType: row.meterType, ...effective, consumedUnits: meter.consumedUnits, reservedUnits: meter.reservedUnits, availableUnits: dispatchAvailable(effective.allocatedUnits, cycle.entitlement.hardStopPercent, meter.consumedUnits, meter.reservedUnits) }); }
    const requests = await ctx.db.query("usageExceptionRequests").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).order("desc").take(100);
    const link = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    const canAllocatePool = !!link && await requireGroupOwner(ctx, link.groupId).then(() => true).catch(() => false);
    const groupPools = link && canAllocatePool ? await ctx.db.query("usageGroupPools").withIndex("by_group", q => q.eq("groupId", link.groupId)).order("desc").take(100) : [];
    return { groupPools, canAllocatePool, cycle: { _id: cycle._id, code: cycle.code, version: cycle.version, startAt: cycle.startAt, endAt: cycle.endAt, warningPercent: cycle.entitlement.warningPercent, criticalPercent: cycle.entitlement.criticalPercent, hardStopPercent: cycle.entitlement.hardStopPercent, maxFileSizeBytes: cycle.entitlement.maxFileSizeBytes, maxPagesPerOperation: cycle.entitlement.maxPagesPerOperation, profiles: cycle.entitlement.profiles }, meters, requests, providerExecutionAvailable: false };
  },
});
export const getPlatformEntitlementWorkspace = query({
  args: { schoolId: v.id("schools") }, handler: async (ctx, args) => { if (!(await isGroupPlatformOperator(ctx))) throw new ConvexError("Forbidden: active Platform authority required"); const versions = await ctx.db.query("usageEntitlementVersions").order("desc").take(100); const cycles = await ctx.db.query("usageCycles").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).order("desc").take(100); const requests = await ctx.db.query("usageExceptionRequests").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).order("desc").take(100); return { versions, cycles, requests, providerExecutionAvailable: false }; },
});
