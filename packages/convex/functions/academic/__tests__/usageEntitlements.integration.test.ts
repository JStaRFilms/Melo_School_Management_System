import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import type { UsageEntitlement } from "../../foundation/usageContract";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const fn = {
  publish: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:publishEntitlementVersion"),
  cycle: makeFunctionReference<"mutation">("functions/academic/usageEntitlements:startUsageCycle"),
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
  const view = await f.owner.query(fn.workspace, { schoolId: f.schoolId }) as { meters: Array<{ meterType: string; poolUnits: number }> }; expect(view.meters.find(row => row.meterType === "ai_tokens")?.poolUnits).toBe(40);
});
