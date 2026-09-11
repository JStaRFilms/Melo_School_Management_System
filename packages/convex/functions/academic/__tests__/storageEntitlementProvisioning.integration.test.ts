import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "../../../_generated/api";
import schema from "../../../schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);

it("provisions reviewed free-trial contracts and storage exactly once", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run((ctx) =>
    ctx.db.insert("schools", {
      name: "Trial School",
      slug: "trial-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const startAt = 1_800_057_600_000;
  const endAt = startAt + 365 * 86_400_000;

  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.provisionReviewedFreeTrialStorage,
    {
      schoolIds: [schoolId],
      bytesPerSchool: 100 * 1024 * 1024,
      startAt,
      endAt,
      actorEmail: "operator@example.com",
      confirmation: "PROVISION FREE TRIAL STORAGE",
    },
  )).resolves.toEqual({
    schoolCount: 1,
    bytesPerSchool: 100 * 1024 * 1024,
    totalEntitledBytes: 100 * 1024 * 1024,
  });

  const records = await t.run(async (ctx) => ({
    contract: await ctx.db.query("commercialContracts").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).unique(),
    cycle: await ctx.db.query("usageCycles").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).unique(),
    meter: await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique(),
    audits: await ctx.db.query("auditEvents").withIndex("by_school_and_timestamp", (q) => q.eq("schoolId", schoolId)).take(10),
  }));
  expect(records.contract).toMatchObject({ code: "free_trial", version: 2, setupHandling: "waived" });
  expect(records.cycle).toMatchObject({
    code: "free_trial_storage",
    version: 2,
    status: "active",
    entitlement: { maxPagesPerOperation: 80 },
  });
  expect(records.meter).toMatchObject({
    cycleId: records.cycle?._id,
    allocatedUnits: 100 * 1024 * 1024,
    consumedUnits: 0,
  });
  expect(records.audits).toEqual([
    expect.objectContaining({
      action: "usage.free_trial_storage_provisioned",
      actorKind: "platform_admin",
      actorEmailSnapshot: "operator@example.com",
    }),
  ]);

  const earlierSchoolId = await t.run((ctx) =>
    ctx.db.insert("schools", {
      name: "Earlier Trial School",
      slug: "earlier-trial-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.provisionReviewedFreeTrialStorage,
    {
      schoolIds: [earlierSchoolId],
      bytesPerSchool: 100 * 1024 * 1024,
      startAt: startAt - 86_400_000,
      endAt: endAt - 86_400_000,
      actorEmail: "operator@example.com",
      confirmation: "PROVISION FREE TRIAL STORAGE",
    },
  )).rejects.toThrow("not effective for the requested storage period");

  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.provisionReviewedFreeTrialStorage,
    {
      schoolIds: [schoolId],
      bytesPerSchool: 100 * 1024 * 1024,
      startAt,
      endAt,
      actorEmail: "operator@example.com",
      confirmation: "PROVISION FREE TRIAL STORAGE",
    },
  )).rejects.toThrow("already has commercial or storage history");
});

it("automatically provisions bounded storage for a newly activated school", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run((ctx) =>
    ctx.db.insert("schools", {
      name: "Future Trial School",
      slug: "future-trial-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    }),
  );

  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
    { schoolId, actorEmail: "NEW.OPERATOR@EXAMPLE.COM" },
  )).resolves.toMatchObject({ status: "created" });
  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
    { schoolId, actorEmail: "new.operator@example.com" },
  )).resolves.toEqual({ status: "already_configured" });

  const records = await t.run(async (ctx) => ({
    contract: await ctx.db.query("commercialContracts").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).unique(),
    cycle: await ctx.db.query("usageCycles").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).unique(),
    meter: await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique(),
    audits: await ctx.db.query("auditEvents").withIndex("by_school_and_timestamp", (q) => q.eq("schoolId", schoolId)).collect(),
  }));
  if (!records.contract) throw new Error("Contract was not provisioned");
  expect(records.contract.effectiveTo).toBe(records.contract.effectiveFrom + 365 * 86_400_000);
  expect(records.cycle).toMatchObject({ status: "active" });
  expect(records.meter).toMatchObject({ allocatedUnits: 100 * 1024 * 1024 });
  expect(records.audits).toEqual([
    expect.objectContaining({
      actorKind: "platform_admin",
      actorEmailSnapshot: "new.operator@example.com",
    }),
  ]);

  if (!records.contract || !records.cycle || !records.meter) {
    throw new Error("Storage contract, cycle, or meter was not provisioned");
  }
  const contractId = records.contract._id;
  const contractEndAt = records.contract.effectiveTo;
  const cycleId = records.cycle._id;
  const meterId = records.meter._id;
  await t.run((ctx) => ctx.db.patch(contractId, { effectiveTo: Date.now() - 1 }));
  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
    { schoolId, actorEmail: "new.operator@example.com" },
  )).resolves.toEqual({ status: "requires_review" });
  await t.run((ctx) => ctx.db.patch(contractId, { effectiveTo: contractEndAt }));
  await t.run((ctx) => ctx.db.patch(meterId, { topUpUnits: 1 }));
  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
    { schoolId, actorEmail: "new.operator@example.com" },
  )).resolves.toEqual({ status: "requires_review" });
  await t.run((ctx) => ctx.db.patch(meterId, { topUpUnits: 0 }));
  await t.run((ctx) => ctx.db.patch(cycleId, { status: "closed" }));
  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
    { schoolId, actorEmail: "new.operator@example.com" },
  )).resolves.toEqual({ status: "requires_review" });
});

it("fails closed when automatic provisioning reaches the reviewed aggregate pool", async () => {
  const t = convexTest(schema, modules);
  const schoolIds = await t.run(async (ctx) => {
    const ids = [];
    for (let index = 0; index < 8; index += 1) {
      ids.push(await ctx.db.insert("schools", {
        name: `Pool School ${index + 1}`,
        slug: `pool-school-${index + 1}`,
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      }));
    }
    return ids;
  });
  for (const schoolId of schoolIds.slice(0, 7)) {
    await expect(t.mutation(
      internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
      { schoolId, actorEmail: "operator@example.com" },
    )).resolves.toMatchObject({ status: "created" });
  }
  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.ensureSchoolFreeTrialStorage,
    { schoolId: schoolIds[7], actorEmail: "operator@example.com" },
  )).resolves.toEqual({ status: "pool_exhausted" });
});

it("rejects operator-selected storage allowances outside the reviewed preset", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run((ctx) =>
    ctx.db.insert("schools", {
      name: "Bounded Trial School",
      slug: "bounded-trial-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const startAt = 1_800_057_600_000;

  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.provisionReviewedFreeTrialStorage,
    {
      schoolIds: [schoolId],
      bytesPerSchool: 700 * 1024 * 1024,
      startAt,
      endAt: startAt + 365 * 86_400_000,
      actorEmail: "operator@example.com",
      confirmation: "PROVISION FREE TRIAL STORAGE",
    },
  )).rejects.toThrow("reviewed 100 MiB allowance");
});
