import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import { assertPaidUsageAvailable } from "../../foundation/paidUsageGate";
const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]);
const modules = Object.fromEntries(Object.entries(rawModules).map(([path, module]) => [
  `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module,
]));
const metering = internal.functions.academic.metering;
async function setup() {
  const t = convexTest(schema, modules);
  const schoolId = await t.run(ctx => ctx.db.insert("schools", { name: "Usage test", slug: "usage-test", status: "active", createdAt: 1, updatedAt: 1 }));
  return { t, schoolId };
}
describe("usage accounting safety", () => {
  it("rejects invalid unit amounts and unsupported thresholds before writing", async () => {
    const { t, schoolId } = await setup();
    for (const allocatedUnits of [NaN, Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(t.mutation(metering.allocateQuota, { schoolId, meterType: "ocr_pages", allocatedUnits })).rejects.toThrow();
    }
    await expect(t.mutation(metering.allocateQuota, { schoolId, meterType: "ocr_pages", allocatedUnits: 100, hardStopThresholdPercent: 110 })).rejects.toThrow("versioned plan");
    expect(await t.run(ctx => ctx.db.query("usageMeterAllocations").take(1))).toEqual([]);
  });
  it("exposes terminal reservation status and never holds or settles twice", async () => {
    const { t, schoolId } = await setup();
    await t.mutation(metering.allocateQuota, { schoolId, meterType: "ocr_pages", allocatedUnits: 100 });
    const request = { schoolId, meterType: "ocr_pages" as const, unitsRequested: 70, idempotencyKey: "operation-1", operationName: "ocr" };
    expect(await t.mutation(metering.reserveUsageQuota, request)).toMatchObject({ status: "reserved", availableUnits: 30 });
    await t.mutation(metering.releaseUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: request.idempotencyKey });
    expect(await t.mutation(metering.reserveUsageQuota, request)).toMatchObject({ status: "released" });
    expect(await t.run(ctx => ctx.db.query("usageMeterAllocations").first())).toMatchObject({ consumedUnits: 0, reservedUnits: 0 });
    await expect(t.mutation(metering.reserveUsageQuota, { ...request, idempotencyKey: "invalid", unitsRequested: NaN })).rejects.toThrow();
  });
  it("retains idempotent failed provider costs independently of customer allowance and rejects conflicts", async () => {
    const { t, schoolId } = await setup();
    const evidence = { schoolId, operationId: "op-1", evidenceId: "provider-1", provider: "test-double", model: "local", outcome: "failed" as const, currency: "USD", costMinor: 3, inputTokens: 40, measuredAt: 10 };
    const id = await t.mutation(metering.recordProviderCost, evidence);
    expect(await t.mutation(metering.recordProviderCost, evidence)).toEqual(id);
    await expect(t.mutation(metering.recordProviderCost, { ...evidence, costMinor: 4 })).rejects.toThrow("Conflicting");
    const { inputTokens: _unused, ...missingDimension } = evidence;
    await expect(t.mutation(metering.recordProviderCost, missingDimension)).rejects.toThrow("Conflicting");
    expect(await t.run(ctx => ctx.db.query("usageEvents").take(10))).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("usageProviderCosts").take(10))).toHaveLength(1);
    await t.run(ctx => ctx.db.insert("platformAdmins", { authId: "platform", authTokenIdentifier: "test|platform", email: "platform@test.invalid", name: "Platform", isActive: true, createdAt: 1, updatedAt: 1 }));
    const platform = t.withIdentity({ subject: "platform", tokenIdentifier: "test|platform" });
    const costs = await platform.query(api.functions.academic.metering.getPlatformUsageCosts, { schoolId });
    expect(costs.rows[0]).toMatchObject({ costMinor: 3, outcome: "failed", inputTokens: 40 });
    expect(costs.rows[0]).not.toHaveProperty("evidenceId");
  });
  it("denies unauthorized allowance, events and internal economics", async () => {
    const { t, schoolId } = await setup();
    await expect(t.query(api.functions.academic.metering.getUsageStatus, { schoolId })).rejects.toThrow();
    await expect(t.query(api.functions.academic.metering.listUsageEvents, { schoolId })).rejects.toThrow();
    await expect(t.query(api.functions.academic.metering.getPlatformUsageCosts, { schoolId })).rejects.toThrow();
    await t.run(ctx => ctx.db.insert("users", { schoolId, authId: "finance", authTokenIdentifier: "test|finance", name: "Finance", email: "finance@test.invalid", role: "admin", isSchoolAdmin: true, createdAt: 1, updatedAt: 1 }));
    const finance = t.withIdentity({ subject: "finance", tokenIdentifier: "test|finance" });
    await expect(finance.query(api.functions.academic.metering.getPlatformUsageCosts, { schoolId })).rejects.toThrow("Platform authority");
  });
  it("does not enable paid execution merely because a provider key might exist", () => {
    expect(() => assertPaidUsageAvailable()).toThrow("unavailable");
  });
});
