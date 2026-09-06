import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import type { UsageEntitlement } from "../../foundation/usageContract";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const fn = {
  publish: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:publishEntitlementVersion"),
  cycle: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:startUsageCycle"),
  closeCycle: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:closeUsageCycle"),
  topUp: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:recordTopUpGrant"),
  request: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:requestUsageException"),
  decide: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:decideUsageException"),
  pool: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:createGroupPool"),
  allocatePool: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:allocateGroupPoolToBranch"),
  quote: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:quoteHeavyOperation"),
  confirm: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:confirmHeavyOperation"),
  cancel: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:cancelHeavyOperation"),
  workspace: makeFunctionReference<"query">("functions/academic/usageEntitlements:getUsageWorkspace"),
};
const day = 86400000; const today = Math.floor(Date.now() / day) * day;
const entitlement: UsageEntitlement = {
  allowances: [{ meterType: "ai_tokens", baseUnits: 100, graceUnits: 20 }, { meterType: "ocr_pages", baseUnits: 10, graceUnits: 0 }, { meterType: "storage_bytes", baseUnits: 1000, graceUnits: 100 }],
  warningPercent: 60, criticalPercent: 80, hardStopPercent: 100, maxFileSizeBytes: 500, maxPagesPerOperation: 20,
  profiles: [{ task: "teacher_lesson_plan", meterType: "ai_tokens", unitsPerItem: 10, maxItems: 5, modelProfile: "reviewed-lesson" }, { task: "provider_ocr", meterType: "ocr_pages", unitsPerItem: 1, maxItems: 20, modelProfile: "reviewed-ocr" }, { task: "knowledge_upload", meterType: "storage_bytes", unitsPerItem: 1, maxItems: 500, modelProfile: "storage-intake" }],
};
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Usage", slug: `usage-${Math.random()}`, status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: `other-${Math.random()}`, status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("platformAdmins", { authId: "platform", authTokenIdentifier: "test|platform", email: "platform@test.invalid", name: "Platform", isActive: true, createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { authTokenIdentifier: "test|owner", email: "owner@test.invalid", name: "Owner", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId, authId: "owner", authTokenIdentifier: "test|owner", personId, email: "owner@test.invalid", name: "Owner", role: "admin", createdAt: 1, updatedAt: 1 });
    const membershipId = await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: userId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    for (const capability of ["finance.reports.view", "academic.planning.use", "assets.upload"]) await ctx.db.insert("membershipDirectGrants", { membershipId, capability, grantedAt: 1 });
    const groupId = await ctx.db.insert("schoolGroups", { name: "Group", slug: `group-${Math.random()}`, proprietorPersonId: personId, status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("schoolGroupBranches", { groupId, schoolId, isHeadquarters: true, linkedAt: 1 });
    await ctx.db.insert("schoolGroupBranches", { groupId, schoolId: otherSchoolId, isHeadquarters: false, linkedAt: 1 });
    const rateVersionId = await ctx.db.insert("commercialRateVersions", { code: "core_basic", name: "Core", version: 1, effectiveFrom: today - day, rate: { currency: "NGN", perStudentMinor: 100000, setupMinor: 3000000, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly", proration: "none" }, createdAt: 1 });
    const contractId = await ctx.db.insert("commercialContracts", { schoolId, rateVersionId, rate: { currency: "NGN", perStudentMinor: 100000, setupMinor: 3000000, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly", proration: "none" }, code: "core_basic", version: 1, effectiveFrom: today - day, effectiveTo: today + 100 * day, setupHandling: "waived", setupReason: "test contract", createdAt: 1 });
    return { schoolId, otherSchoolId, personId, membershipId, groupId, contractId };
  });
  const platform = t.withIdentity({ subject: "platform", tokenIdentifier: "test|platform" });
  const owner = t.withIdentity({ subject: "owner", issuer: "test", tokenIdentifier: "test|owner" });
  const publishArgs = { journalSchoolId: ids.schoolId, code: "core_usage", name: "Core usage", expectedVersion: 0, effectiveFrom: today - day, entitlement, confirmation: "CONFIRM" };
  const versionId = await platform.mutation(fn.publish, publishArgs) as Id<"usageEntitlementVersions">;
  const cycleId = await platform.mutation(fn.cycle, { schoolId: ids.schoolId, contractId: ids.contractId, entitlementVersionId: versionId, startAt: today - day, endAt: today + 30 * day, confirmation: "CONFIRM" }) as Id<"usageCycles">;
  return { ...ids, t, platform, owner, publishArgs, versionId, cycleId };
}
it("restricts immutable entitlement versions/cycles to Platform and exposes source-separated allowance", async () => {
  const f = await setup();
  await expect(f.owner.mutation(fn.publish, f.publishArgs)).rejects.toThrow("Platform");
  await expect(f.platform.mutation(fn.publish, f.publishArgs)).rejects.toThrow("conflict");
  await expect(f.platform.mutation(fn.cycle, { schoolId: f.schoolId, contractId: f.contractId, entitlementVersionId: f.versionId, startAt: today, endAt: today + day, confirmation: "CONFIRM" })).rejects.toThrow("overlap");
  const view = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as { meters: Array<{ meterType: string; baseUnits: number; graceUnits: number; topUpUnits: number }> };
  expect(view.meters.find(row => row.meterType === "ai_tokens")).toMatchObject({ baseUnits: 100, graceUnits: 20, topUpUnits: 0 });
});
it("quotes authoritatively and confirmed unavailable dispatch releases without double charging", async () => {
  const f = await setup(); const quoteArgs = { schoolId: f.schoolId, task: "teacher_lesson_plan", itemCount: 3, idempotencyKey: "lesson-operation-1" };
  const quote = await f.owner.mutation(fn.quote, quoteArgs) as { _id: Id<"usageOperationAttempts">; estimatedUnits: number };
  expect(quote.estimatedUnits).toBe(30); expect((await f.owner.mutation(fn.quote, quoteArgs) as { _id: string })._id).toBe(quote._id);
  await expect(f.owner.mutation(fn.quote, { ...quoteArgs, itemCount: 4 })).rejects.toThrow("different work");
  const confirmations = await Promise.all([f.owner.mutation(fn.confirm, { schoolId: f.schoolId, attemptId: quote._id, expectedUnits: 30, confirmation: "CONFIRM" }), f.owner.mutation(fn.confirm, { schoolId: f.schoolId, attemptId: quote._id, expectedUnits: 30, confirmation: "CONFIRM" })]);
  expect(confirmations).toEqual([expect.objectContaining({ chargedUnits: 0, status: "released_provider_unavailable" }), expect.objectContaining({ chargedUnits: 0, status: "released_provider_unavailable" })]);
  const records = await f.t.run(async ctx => ({ allocation: await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", f.schoolId).eq("meterType", "ai_tokens")).unique(), events: await ctx.db.query("usageEvents").take(10), transitions: await ctx.db.query("usageOperationTransitions").withIndex("by_attempt", q => q.eq("attemptId", quote._id)).take(10) }));
  expect(records.allocation).toMatchObject({ consumedUnits: 0, reservedUnits: 0 }); expect(records.events).toEqual([]); expect(records.transitions.map(row => row.state)).toEqual(["quoted", "reserved", "dispatch_started", "provider_unavailable", "released"]);
});
it("cancel is idempotent and quota failures report exact shortfall", async () => {
  const f = await setup();
  const quote = await f.owner.mutation(fn.quote, { schoolId: f.schoolId, task: "provider_ocr", itemCount: 10, idempotencyKey: "ocr-cancel-1" }) as { _id: Id<"usageOperationAttempts"> };
  await f.owner.mutation(fn.cancel, { schoolId: f.schoolId, attemptId: quote._id }); expect(await f.owner.mutation(fn.cancel, { schoolId: f.schoolId, attemptId: quote._id })).toBe(quote._id);
  await expect(f.owner.mutation(fn.quote, { schoolId: f.schoolId, task: "provider_ocr", itemCount: 11, idempotencyKey: "ocr-blocked-2" })).rejects.toThrow("exact shortfall 1");
  await expect(f.owner.mutation(fn.quote, { schoolId: f.schoolId, task: "teacher_lesson_plan", itemCount: 6, idempotencyKey: "too-many-items" })).rejects.toThrow("task profile");
});
it("records top-ups separately and exception requests grant nothing until one append-only Platform decision", async () => {
  const f = await setup(); const top = { schoolId: f.schoolId, cycleId: f.cycleId, meterType: "ocr_pages", units: 5, evidenceReference: "reviewed-topup-1", reason: "Approved offline allowance evidence", confirmation: "CONFIRM" };
  const topId = await f.platform.mutation(fn.topUp, top); expect(await f.platform.mutation(fn.topUp, top)).toBe(topId); await expect(f.platform.mutation(fn.topUp, { ...top, units: 6 })).rejects.toThrow("Conflicting");
  const requestId = await f.owner.mutation(fn.request, { schoolId: f.schoolId, cycleId: f.cycleId, meterType: "ocr_pages", units: 7, reason: "Temporary reviewed school need", confirmation: "REQUEST" }) as Id<"usageExceptionRequests">;
  let view = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as { meters: Array<{ meterType: string; topUpUnits: number; exceptionUnits: number }> }; expect(view.meters.find(row => row.meterType === "ocr_pages")).toMatchObject({ topUpUnits: 5, exceptionUnits: 0 });
  const decision = await f.platform.mutation(fn.decide, { schoolId: f.schoolId, requestId, outcome: "approved", reason: "Approved bounded temporary exception", confirmation: "CONFIRM" }); expect(decision).toBeTruthy(); await expect(f.platform.mutation(fn.decide, { schoolId: f.schoolId, requestId, outcome: "declined", reason: "different replay", confirmation: "CONFIRM" })).rejects.toThrow("Conflicting");
  view = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as typeof view; expect(view.meters.find(row => row.meterType === "ocr_pages")?.exceptionUnits).toBe(7);
});
it("creates a bounded group pool and only the proprietor can allocate matching-cycle branch units", async () => {
  const f = await setup();
  const poolId = await f.platform.mutation(fn.pool, { journalSchoolId: f.schoolId, groupId: f.groupId, entitlementVersionId: f.versionId, meterType: "ai_tokens", totalUnits: 50, startAt: today - day, endAt: today + 20 * day, reason: "Reviewed shared group pool", confirmation: "CONFIRM" }) as Id<"usageGroupPools">;
  await f.owner.mutation(fn.allocatePool, { poolId, schoolId: f.schoolId, cycleId: f.cycleId, units: 40, reason: "Allocate to headquarters need", confirmation: "ALLOCATE" });
  await expect(f.owner.mutation(fn.allocatePool, { poolId, schoolId: f.schoolId, cycleId: f.cycleId, units: 11, reason: "Exceeds remaining pool", confirmation: "ALLOCATE" })).rejects.toThrow("exceeds");
  const view = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as { meters: Array<{ meterType: string; poolUnits: number }> };
  expect(view.meters.find(row => row.meterType === "ai_tokens")?.poolUnits).toBe(40);
  expect(view.meters.find(row => row.meterType === "ocr_pages")?.poolUnits).toBe(0);
  await f.t.run(ctx => ctx.db.patch(f.groupId, { status: "archived" }));
  const archivedGroup = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as typeof view;
  expect(archivedGroup.meters.find(row => row.meterType === "ai_tokens")?.poolUnits).toBe(0);
  await f.t.run(ctx => ctx.db.patch(f.groupId, { status: "active" }));

  const clock = vi.spyOn(Date, "now").mockReturnValue(today + 21 * day);
  try {
    const expired = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as typeof view;
    expect(expired.meters.find(row => row.meterType === "ai_tokens")?.poolUnits).toBe(0);
  } finally {
    clock.mockRestore();
  }
});

it("closes with provenance-validated effective-at-end totals while preserving cumulative expired source history", async () => {
  const f = await setup();
  await f.platform.mutation(fn.topUp, {
    schoolId: f.schoolId,
    cycleId: f.cycleId,
    meterType: "ocr_pages",
    units: 5,
    evidenceReference: "expiring-close-topup",
    reason: "Expires before closing boundary",
    expiresAt: today + 10 * day,
    confirmation: "CONFIRM",
  });
  const requestId = await f.owner.mutation(fn.request, {
    schoolId: f.schoolId,
    cycleId: f.cycleId,
    meterType: "ocr_pages",
    units: 7,
    reason: "Temporary allowance before close",
    confirmation: "REQUEST",
  }) as Id<"usageExceptionRequests">;
  await f.platform.mutation(fn.decide, {
    schoolId: f.schoolId,
    requestId,
    outcome: "approved",
    reason: "Approved only until mid-cycle",
    expiresAt: today + 15 * day,
    confirmation: "CONFIRM",
  });
  const poolId = await f.platform.mutation(fn.pool, {
    journalSchoolId: f.schoolId,
    groupId: f.groupId,
    entitlementVersionId: f.versionId,
    meterType: "ai_tokens",
    totalUnits: 40,
    startAt: today - day,
    endAt: today + 20 * day,
    reason: "Pool expires before cycle closes",
    confirmation: "CONFIRM",
  }) as Id<"usageGroupPools">;
  await f.owner.mutation(fn.allocatePool, {
    poolId,
    schoolId: f.schoolId,
    cycleId: f.cycleId,
    units: 40,
    reason: "Temporary reviewed pool allocation",
    confirmation: "ALLOCATE",
  });

  const staleCumulativeReview = {
    schoolId: f.schoolId,
    cycleId: f.cycleId,
    expectedMeters: [
      { meterType: "ai_tokens" as const, allocatedUnits: 160, consumedUnits: 0 },
      { meterType: "ocr_pages" as const, allocatedUnits: 22, consumedUnits: 0 },
      { meterType: "storage_bytes" as const, allocatedUnits: 1100, consumedUnits: 0 },
    ],
    reconciliationNote: "Reviewed cumulative source totals",
    confirmation: "CLOSE",
  };
  const clock = vi.spyOn(Date, "now").mockReturnValue(today + 30 * day);
  try {
    await expect(f.platform.mutation(fn.closeCycle, staleCumulativeReview)).rejects.toThrow("balances changed");
    await f.platform.mutation(fn.closeCycle, {
      ...staleCumulativeReview,
      expectedMeters: [
        { meterType: "ai_tokens", allocatedUnits: 120, consumedUnits: 0 },
        { meterType: "ocr_pages", allocatedUnits: 10, consumedUnits: 0 },
        { meterType: "storage_bytes", allocatedUnits: 1100, consumedUnits: 0 },
      ],
      reconciliationNote: "Reviewed effective totals at cycle end",
    });
    const state = await f.t.run(async ctx => ({
      aiSnapshot: await ctx.db.query("usageCycleMeterSnapshots").withIndex("by_cycle_and_meter", q => q.eq("cycleId", f.cycleId).eq("meterType", "ai_tokens")).unique(),
      ocrSnapshot: await ctx.db.query("usageCycleMeterSnapshots").withIndex("by_cycle_and_meter", q => q.eq("cycleId", f.cycleId).eq("meterType", "ocr_pages")).unique(),
      grants: await ctx.db.query("usageAllowanceGrants").withIndex("by_cycle", q => q.eq("cycleId", f.cycleId)).take(10),
      poolAllocations: await ctx.db.query("usageBranchPoolAllocations").withIndex("by_cycle", q => q.eq("cycleId", f.cycleId)).take(10),
    }));
    expect(state.aiSnapshot).toMatchObject({ allocatedUnits: 120, poolUnits: 0 });
    expect(state.ocrSnapshot).toMatchObject({ allocatedUnits: 10, topUpUnits: 0, exceptionUnits: 0 });
    expect(state.grants.reduce((sum, grant) => sum + grant.units, 0)).toBe(12);
    expect(state.poolAllocations.reduce((sum, allocation) => sum + allocation.units, 0)).toBe(40);
  } finally {
    clock.mockRestore();
  }
});

it("closes an ended cycle with no active reservations, preserves its balances, and starts a clean next cycle", async () => {
  const f = await setup();
  await f.t.run(async ctx => {
    const meter = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", f.schoolId).eq("meterType", "ai_tokens")).unique();
    if (!meter) throw new Error("missing meter");
    await ctx.db.patch(meter._id, { consumedUnits: 30, reservedUnits: 1 });
  });
  const closeArgs = {
    schoolId: f.schoolId,
    cycleId: f.cycleId,
    expectedMeters: [
      { meterType: "ai_tokens" as const, allocatedUnits: 120, consumedUnits: 30 },
      { meterType: "ocr_pages" as const, allocatedUnits: 10, consumedUnits: 0 },
      { meterType: "storage_bytes" as const, allocatedUnits: 1100, consumedUnits: 0 },
    ],
    reconciliationNote: "Reviewed final synthetic balances",
    confirmation: "CLOSE",
  };
  const clock = vi.spyOn(Date, "now").mockReturnValue(today + 30 * day);
  try {
    await expect(f.platform.mutation(fn.closeCycle, closeArgs)).rejects.toThrow("active reservations");
    await f.t.run(async ctx => {
      const meter = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", f.schoolId).eq("meterType", "ai_tokens")).unique();
      if (!meter) throw new Error("missing meter");
      await ctx.db.patch(meter._id, { reservedUnits: 0 });
    });
    await f.platform.mutation(fn.closeCycle, closeArgs);
    const nextCycleId = await f.platform.mutation(fn.cycle, {
      schoolId: f.schoolId,
      contractId: f.contractId,
      entitlementVersionId: f.versionId,
      startAt: today + 30 * day,
      endAt: today + 60 * day,
      confirmation: "CONFIRM",
    });
    const state = await f.t.run(async ctx => ({
      prior: await ctx.db.get(f.cycleId),
      snapshots: await ctx.db.query("usageCycleMeterSnapshots").withIndex("by_cycle", q => q.eq("cycleId", f.cycleId)).take(4),
      current: await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", f.schoolId).eq("meterType", "ai_tokens")).unique(),
    }));
    expect(state.prior).toMatchObject({ status: "closed" });
    expect(state.snapshots).toHaveLength(3);
    expect(state.snapshots.find(row => row.meterType === "ai_tokens")).toMatchObject({ consumedUnits: 30, reservedUnits: 0 });
    expect(state.current).toMatchObject({ cycleId: nextCycleId, consumedUnits: 0, reservedUnits: 0, allocatedUnits: 120 });
  } finally {
    clock.mockRestore();
  }
});
