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
  expect(records.contract).toMatchObject({ code: "free_trial", setupHandling: "waived" });
  expect(records.cycle).toMatchObject({ code: "free_trial_storage", status: "active" });
  expect(records.meter).toMatchObject({
    cycleId: records.cycle?._id,
    allocatedUnits: 100 * 1024 * 1024,
    consumedUnits: 0,
  });
  expect(records.audits).toEqual([
    expect.objectContaining({ action: "usage.free_trial_storage_provisioned" }),
  ]);

  await expect(t.mutation(
    internal.functions.academic.storageEntitlementProvisioning.provisionReviewedFreeTrialStorage,
    {
      schoolIds: [schoolId],
      bytesPerSchool: 100 * 1024 * 1024,
      startAt,
      endAt,
      confirmation: "PROVISION FREE TRIAL STORAGE",
    },
  )).rejects.toThrow("already exist");
});
