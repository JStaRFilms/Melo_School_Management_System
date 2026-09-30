/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { api } from "../../../_generated/api";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const fn = {
  quote: makeFunctionReference<"mutation">("functions/academic/aiSpend:quote"),
  confirm: makeFunctionReference<"mutation">("functions/academic/aiSpend:confirm"),
  claim: makeFunctionReference<"mutation">("functions/academic/aiSpend:claim"),
  settle: makeFunctionReference<"mutation">("functions/academic/aiSpend:settle"),
  uncertain: makeFunctionReference<"mutation">("functions/academic/aiSpend:uncertain"),
  cancel: makeFunctionReference<"mutation">("functions/academic/aiSpend:cancel"),
  status: makeFunctionReference<"query">("functions/academic/aiSpend:status"),
  expire: makeFunctionReference<"mutation">("functions/academic/aiSpend:expire"),
};
async function setup() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "ai-school", status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "ai-other", status: "active", createdAt: 1, updatedAt: 1 });
    const rateVersionId = await ctx.db.insert("commercialRateVersions", { code: "core", name: "Core", version: 1, effectiveFrom: now - 1000, rate: { currency: "NGN", perStudentMinor: 100, setupMinor: 0, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly", proration: "none" }, createdAt: 1 });
    const contractId = await ctx.db.insert("commercialContracts", { schoolId, rateVersionId, rate: { currency: "NGN", perStudentMinor: 100, setupMinor: 0, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly", proration: "none" }, code: "core", version: 1, effectiveFrom: now - 1000, effectiveTo: now + 3600_000, setupHandling: "waived", setupReason: "fixture", createdAt: now });
    const entitlement = { allowances: [{ meterType: "ai_tokens" as const, baseUnits: 100, graceUnits: 0 }], warningPercent: 50, criticalPercent: 70, hardStopPercent: 90, maxFileSizeBytes: 100, maxPagesPerOperation: 1, profiles: [{ task: "teacher_lesson_plan" as const, meterType: "ai_tokens" as const, unitsPerItem: 10, maxItems: 1, modelProfile: "reviewed-model" }] };
    const versionId = await ctx.db.insert("usageEntitlementVersions", { code: "core", name: "Core", version: 1, effectiveFrom: now - 1000, entitlement, createdAt: 1 });
    const cycleId = await ctx.db.insert("usageCycles", { schoolId, contractId, entitlementVersionId: versionId, code: "core", version: 1, entitlement, startAt: now - 1000, endAt: now + 3600_000, status: "active", createdAt: 1 });
    const meterId = await ctx.db.insert("usageMeterAllocations", { schoolId, cycleId, meterType: "ai_tokens", allocatedUnits: 100, consumedUnits: 0, reservedUnits: 0, warningThresholdPercent: 50, criticalThresholdPercent: 70, hardStopThresholdPercent: 90, resetCadence: "termly", lastResetAt: now, updatedAt: now });
    for (const [subject, authTokenIdentifier] of [["one", "test|one"], ["two", "test|two"]]) {
      const personId = await ctx.db.insert("persons", { authTokenIdentifier, email: `${subject}@test.invalid`, name: subject, status: "active", createdAt: 1, updatedAt: 1 });
      const userId = await ctx.db.insert("users", { schoolId, authId: subject, authTokenIdentifier, personId, email: `${subject}@test.invalid`, name: subject, role: "admin", createdAt: 1, updatedAt: 1 });
      const membershipId = await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: userId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
      await ctx.db.insert("membershipDirectGrants", { membershipId, capability: "academic.planning.use", grantedAt: 1 });
    }
    return { schoolId, otherSchoolId, cycleId, meterId, contractId };
  });
  const one = t.withIdentity({ subject: "one", tokenIdentifier: "test|one" });
  const two = t.withIdentity({ subject: "two", tokenIdentifier: "test|two" });
  const quote = (idempotencyKey: string, digest = "a".repeat(64)) => one.mutation(fn.quote, { schoolId: ids.schoolId, task: "teacher_lesson_plan", digest, modelId: "reviewed-model", idempotencyKey, minimumUnits: 5 }) as Promise<{ attemptId: Id<"usageOperationAttempts">; estimate: number }>;
  return { ...ids, t, one, two, quote };
}
it("finds active cycles after more than 100 closed historical cycles", async () => {
  const f = await setup();
  await f.t.run(async ctx => {
    const cycle = await ctx.db.get(f.cycleId);
    if (!cycle) throw new Error("missing cycle");
    for (let i = 0; i < 125; i += 1) {
      await ctx.db.insert("usageCycles", { schoolId: f.schoolId, contractId: cycle.contractId,
        entitlementVersionId: cycle.entitlementVersionId, code: cycle.code, version: cycle.version,
        entitlement: cycle.entitlement, startAt: cycle.startAt - (i + 2) * 86_400_000,
        endAt: cycle.startAt - (i + 1) * 86_400_000, status: "closed", createdAt: i });
    }
  });
  const quoted = await f.quote("historical-001");
  await f.one.mutation(fn.confirm, { attemptId: quoted.attemptId, expectedUnits: 10, confirmation: "CONFIRM" });
  await f.one.mutation(fn.claim, { attemptId: quoted.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" });
  expect(await f.one.query(fn.status, { attemptId: quoted.attemptId })).toMatchObject({ status: "dispatch_started" });
});
it("paginates unresolved attempts by school despite 150 newer other-school rows", async () => {
  const f = await setup();
  await f.t.run(ctx => ctx.db.insert("platformAdmins", { authId: "operator", authTokenIdentifier: "test|operator", email: "op@test.invalid", name: "Operator", isActive: true, createdAt: 1, updatedAt: 1 }));
  const operator = f.t.withIdentity({ subject: "operator", tokenIdentifier: "test|operator" });
  const first = await f.quote("pending-0001");
  await f.one.mutation(fn.confirm, { attemptId: first.attemptId, expectedUnits: 10, confirmation: "CONFIRM" });
  await f.one.mutation(fn.claim, { attemptId: first.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" });
  await f.one.mutation(fn.uncertain, { attemptId: first.attemptId });
  const source = await f.t.run(ctx => ctx.db.get(first.attemptId));
  if (!source) throw new Error("missing attempt");
  for (const [schoolId, count] of [[f.schoolId, 60], [f.otherSchoolId, 150]] as const) {
    for (let start = 0; start < count; start += 30) await f.t.run(async ctx => {
      for (let i = start; i < Math.min(start + 30, count); i += 1)
        await ctx.db.insert("usageOperationAttempts", { schoolId, cycleId: source.cycleId,
          idempotencyKey: `pending-${schoolId}-${i}`, task: source.task, meterType: source.meterType,
          itemCount: 1, estimatedUnits: 10, modelProfile: source.modelProfile, status: "needs_reconciliation",
          actorTokenIdentifier: source.actorTokenIdentifier, createdAt: Date.now(), updatedAt: Date.now() + i,
          requestDigest: source.requestDigest, modelId: source.modelId });
    });
  }
  const firstPage = await operator.query(api.functions.academic.aiSpend.unresolved, { schoolId: f.schoolId,
    paginationOpts: { numItems: 25, cursor: null } });
  expect(firstPage.page).toHaveLength(25);
  expect(firstPage.page.every(row => row.id !== undefined)).toBe(true);
  const secondPage = await operator.query(api.functions.academic.aiSpend.unresolved, { schoolId: f.schoolId,
    paginationOpts: { numItems: 25, cursor: firstPage.continueCursor } });
  expect(secondPage.page).toHaveLength(25);
  expect(new Set([...firstPage.page, ...secondPage.page].map(row => row.id)).size).toBe(50);
});
it("binds request and identity, and allows one confirmation and dispatch", async () => {
  const f = await setup();
  const row = await f.quote("attempt-0001");
  expect(row.estimate).toBe(10);
  await expect(f.quote("attempt-0001", "b".repeat(64))).rejects.toThrow("different work");
  await expect(f.two.mutation(fn.confirm, { attemptId: row.attemptId, expectedUnits: 10, confirmation: "CONFIRM" })).rejects.toThrow("quoting teacher");
  const args = { attemptId: row.attemptId, expectedUnits: 10, confirmation: "CONFIRM" };
  await Promise.all([f.one.mutation(fn.confirm, args), f.one.mutation(fn.confirm, args)]);
  await expect(f.two.mutation(fn.claim, { attemptId: row.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" })).rejects.toThrow("quoting teacher");
  await expect(f.one.mutation(fn.claim, { attemptId: row.attemptId, digest: "b".repeat(64), modelId: "reviewed-model" })).rejects.toThrow("changed");
  await f.one.mutation(fn.claim, { attemptId: row.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" });
  await expect(f.one.mutation(fn.claim, { attemptId: row.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" })).rejects.toThrow("already dispatched");
  await expect(f.one.mutation(fn.cancel, { attemptId: row.attemptId })).rejects.toThrow("cannot be cancelled");
  await f.one.mutation(fn.uncertain, { attemptId: row.attemptId });
  expect(await f.one.query(fn.status, { attemptId: row.attemptId })).toMatchObject({ status: "needs_reconciliation" });
  expect((await f.t.run(ctx => ctx.db.get(f.meterId)))?.reservedUnits).toBe(10);
});
it("reserves atomically at hard stop; measures failed calls and returns unused hold exactly once", async () => {
  const f = await setup();
  await f.t.run(ctx => ctx.db.patch(f.meterId, { consumedUnits: 80 }));
  const first = await f.quote("attempt-0002"); const second = await f.quote("attempt-0003");
  const attempts = await Promise.allSettled([f.one.mutation(fn.confirm, { attemptId: first.attemptId, expectedUnits: 10, confirmation: "CONFIRM" }), f.one.mutation(fn.confirm, { attemptId: second.attemptId, expectedUnits: 10, confirmation: "CONFIRM" })]);
  expect(attempts.filter(row => row.status === "fulfilled")).toHaveLength(1);
  const held = attempts[0].status === "fulfilled" ? first : second;
  await f.one.mutation(fn.claim, { attemptId: held.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" });
  const measurement = { attemptId: held.attemptId, inputTokens: 2, outputTokens: 3, outcome: "failed", evidence: "call-1:provider:response-1" };
  expect(await f.one.mutation(fn.settle, measurement)).toBe(5);
  expect(await f.one.mutation(fn.settle, measurement)).toBe(5);
  await expect(f.one.mutation(fn.settle, { ...measurement, outputTokens: 4 })).rejects.toThrow("Conflicting");
  const state = await f.t.run(async ctx => ({ meter: await ctx.db.get(f.meterId), events: await ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(10) }));
  expect(state.meter).toMatchObject({ consumedUnits: 85, reservedUnits: 0 });
  expect(state.events).toHaveLength(1);
  expect(state.events[0]).toMatchObject({ unitsDelta: 5 });
});
it("measures zero, exact hold and overage without releasing a disputed hold", async () => {
  const f = await setup();
  for (const [key, input, output] of [["attempt-0010", 0, 0], ["attempt-0011", 4, 6], ["attempt-0012", 7, 8]] as const) {
    const row = await f.quote(key);
    await f.one.mutation(fn.confirm, { attemptId: row.attemptId, expectedUnits: 10, confirmation: "CONFIRM" });
    await f.one.mutation(fn.claim, { attemptId: row.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" });
    if (key === "attempt-0012") {
      await f.one.mutation(fn.uncertain, { attemptId: row.attemptId });
      expect((await f.t.run(ctx => ctx.db.get(f.meterId)))?.reservedUnits).toBe(10);
    }
    await f.one.mutation(fn.settle, { attemptId: row.attemptId, inputTokens: input, outputTokens: output, outcome: "succeeded", evidence: `${key}:provider` });
  }
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 25, reservedUnits: 0, aiOverageRequiresReview: true });
  await expect(f.quote("attempt-0013")).rejects.toThrow("overage");
  const events = await f.t.run(ctx => ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(10));
  expect(events.map(row => row.unitsDelta)).toEqual([0, 10, 15]);
});
it("reviews two overages after 125 normal attempts without clearing another cycle's block", async () => {
  const f = await setup();
  await f.t.run(ctx => ctx.db.insert("platformAdmins", { authId: "operator", authTokenIdentifier: "test|operator", email: "operator@test.invalid", name: "Operator", isActive: true, createdAt: 1, updatedAt: 1 }));
  const operator = f.t.withIdentity({ subject: "operator", tokenIdentifier: "test|operator" });
  const first = await f.quote("overage-review-01");
  const second = await f.quote("overage-review-02");
  for (const attempt of [first, second]) {
    await f.one.mutation(fn.confirm, { attemptId: attempt.attemptId, expectedUnits: 10, confirmation: "CONFIRM" });
    await f.one.mutation(fn.claim, { attemptId: attempt.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" });
  }
  for (const attempt of [first, second]) {
    await f.one.mutation(fn.settle, { attemptId: attempt.attemptId, inputTokens: 9, outputTokens: 6, outcome: "succeeded", evidence: `provider:${attempt.attemptId}` });
  }
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ aiOutstandingOverageCount: 2, aiOverageRequiresReview: true, consumedUnits: 30 });
  await f.t.run(async ctx => {
    const cycle = await ctx.db.get(f.cycleId);
    if (!cycle) throw new Error("cycle missing");
    const oldCycleId = await ctx.db.insert("usageCycles", { schoolId: f.schoolId, contractId: cycle.contractId, entitlementVersionId: cycle.entitlementVersionId,
      code: cycle.code, version: cycle.version, entitlement: cycle.entitlement, startAt: cycle.startAt - 200_000, endAt: cycle.startAt - 100_000,
      status: "closed", createdAt: 1 });
    await ctx.db.insert("usageOperationAttempts", { ...{ schoolId: f.schoolId, cycleId: oldCycleId, task: "teacher_lesson_plan" as const, meterType: "ai_tokens" as const,
      itemCount: 1, estimatedUnits: 10, modelProfile: "reviewed-model", status: "settled" as const, actorTokenIdentifier: "test|one",
      createdAt: 1, updatedAt: 1, idempotencyKey: "old-cycle-overage", overage: true, actualUnits: 15, inputTokens: 9, outputTokens: 6, outcome: "succeeded", evidence: "old-evidence" } });
    for (let i = 0; i < 125; i += 1) {
      await ctx.db.insert("usageOperationAttempts", { schoolId: f.schoolId, cycleId: f.cycleId, task: "teacher_lesson_plan", meterType: "ai_tokens",
        itemCount: 1, estimatedUnits: 10, modelProfile: "reviewed-model", status: "settled", actorTokenIdentifier: "test|one",
        createdAt: i + 2, updatedAt: i + 2, idempotencyKey: `normal-history-${i}`, overage: false });
    }
  });
  const review = (attemptId: Id<"usageOperationAttempts">) => operator.mutation(api.functions.academic.aiSpend.reviewOverage,
    { attemptId, evidence: "provider:response-123", reason: "Checked provider evidence", confirmation: "REVIEW" });
  await review(first.attemptId);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ aiOutstandingOverageCount: 1, aiOverageRequiresReview: true });
  await expect(review(first.attemptId)).rejects.toThrow("Reviewed overage evidence");
  await expect(f.quote("overage-review-03")).rejects.toThrow("overage");
  const old = await f.t.run(ctx => ctx.db.query("usageOperationAttempts").withIndex("by_school_and_idempotency", q => q.eq("schoolId", f.schoolId).eq("idempotencyKey", "old-cycle-overage")).unique());
  if (!old) throw new Error("old attempt missing");
  await expect(review(old._id)).rejects.toThrow("Cycle meter requires reconciliation");
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ aiOutstandingOverageCount: 1, aiOverageRequiresReview: true });
  await review(second.attemptId);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ aiOutstandingOverageCount: 0, aiOverageRequiresReview: false });
  expect((await f.quote("overage-review-04")).estimate).toBe(10);
});
it("expires only unclaimed work and denies changes in capability", async () => {
  const f = await setup();
  const row = await f.quote("attempt-0020");
  await f.one.mutation(fn.confirm, { attemptId: row.attemptId, expectedUnits: 10, confirmation: "CONFIRM" });
  const date = Date.now;
  try {
    Date.now = () => date() + 10 * 60_000;
    await f.one.mutation(fn.expire, { attemptId: row.attemptId });
  } finally { Date.now = date; }
  expect((await f.t.run(ctx => ctx.db.get(f.meterId)))?.reservedUnits).toBe(0);
  await expect(f.one.mutation(fn.claim, { attemptId: row.attemptId, digest: "a".repeat(64), modelId: "reviewed-model" })).rejects.toThrow("already dispatched");
  const next = await f.quote("attempt-0021");
  await f.t.run(async ctx => {
    const person = await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", "test|one")).unique();
    if (!person) throw new Error("person unavailable");
    const membership = await ctx.db.query("branchMemberships").withIndex("by_school_and_person", q => q.eq("schoolId", f.schoolId).eq("personId", person._id)).unique();
    if (!membership) throw new Error("membership unavailable");
    const grants = await ctx.db.query("membershipDirectGrants").withIndex("by_membership", q => q.eq("membershipId", membership._id)).take(10);
    for (const grant of grants) await ctx.db.delete(grant._id);
    await ctx.db.patch(membership._id, { status: "suspended" });
  });
  await expect(f.one.mutation(fn.confirm, { attemptId: next.attemptId, expectedUnits: 10, confirmation: "CONFIRM" })).rejects.toThrow();
});
it("requires profile, allowance, active contract and capability", async () => {
  const f = await setup();
  await expect(f.two.mutation(fn.quote, { schoolId: f.otherSchoolId, task: "teacher_lesson_plan", digest: "a".repeat(64), modelId: "reviewed-model", idempotencyKey: "attempt-0004", minimumUnits: 1 })).rejects.toThrow();
  await expect(f.one.mutation(fn.quote, { schoolId: f.schoolId, task: "teacher_assessment", digest: "a".repeat(64), modelId: "reviewed-model", idempotencyKey: "attempt-0005", minimumUnits: 1 })).rejects.toThrow("profile");
  await expect(f.one.mutation(fn.quote, { schoolId: f.schoolId, task: "teacher_lesson_plan", digest: "a".repeat(64), modelId: "reviewed-model", idempotencyKey: "attempt-0006", minimumUnits: 11 })).rejects.toThrow("profile");
  await f.t.run(ctx => ctx.db.patch(f.contractId, { effectiveTo: Date.now() - 1 }));
  await expect(f.quote("attempt-0007")).rejects.toThrow("Contract");
});
