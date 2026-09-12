import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(
    ([path, module]) => [
      `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
      module,
    ],
  ),
);

it("lets a Platform Super Admin inspect and provision one reviewed active school", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run(async (ctx) => {
    await ctx.db.insert("platformAdmins", {
      authId: "platform-operator",
      authTokenIdentifier: "test|platform-operator",
      email: "OPERATOR@EXAMPLE.TEST",
      name: "Platform Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("schools", {
      name: "Reviewed School",
      slug: "reviewed-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  const platform = t.withIdentity({
    subject: "platform-operator",
    tokenIdentifier: "test|platform-operator",
  });

  await expect(
    t.query(api.functions.platform.index.getSchoolStorageProvisioningState, {
      schoolId,
    }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.mutation(api.functions.platform.index.provisionSchoolFreeTrialStorage, {
      schoolId,
      confirmation: "PROVISION FREE TRIAL STORAGE",
    }),
  ).rejects.toThrow("Unauthorized");

  await expect(
    platform.mutation(api.functions.platform.index.provisionSchoolFreeTrialStorage, {
      schoolId,
      confirmation: "PROVISION STORAGE",
    }),
  ).rejects.toThrow("PROVISION FREE TRIAL STORAGE");

  await expect(
    platform.query(api.functions.platform.index.getSchoolStorageProvisioningState, {
      schoolId,
    }),
  ).resolves.toMatchObject({
    school: { _id: schoolId, name: "Reviewed School", status: "active" },
    recordState: "not_configured",
    proposal: { allocatedUnits: 100 * 1024 * 1024, durationDays: 365 },
    contract: null,
    cycle: null,
    meter: null,
  });

  await expect(
    platform.mutation(api.functions.platform.index.provisionSchoolFreeTrialStorage, {
      schoolId,
      confirmation: "PROVISION FREE TRIAL STORAGE",
    }),
  ).resolves.toEqual({ status: "created" });

  const configured = await platform.query(
    api.functions.platform.index.getSchoolStorageProvisioningState,
    { schoolId },
  );
  expect(configured).toMatchObject({
    recordState: "configured",
    contract: { code: "free_trial", version: 2 },
    cycle: { code: "free_trial_storage", version: 2, status: "active" },
    meter: {
      allocatedUnits: 100 * 1024 * 1024,
      consumedUnits: 0,
      reservedUnits: 0,
      availableUnits: 100 * 1024 * 1024,
    },
  });
  expect(configured.contract?.effectiveTo).toBe(
    configured.contract!.effectiveFrom + 365 * 86_400_000,
  );

  await expect(
    platform.mutation(api.functions.platform.index.provisionSchoolFreeTrialStorage, {
      schoolId,
      confirmation: "PROVISION FREE TRIAL STORAGE",
    }),
  ).resolves.toEqual({ status: "already_configured" });

  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_school_and_timestamp", (q) => q.eq("schoolId", schoolId))
      .unique(),
  );
  expect(audit).toMatchObject({
    action: "usage.free_trial_storage_provisioned",
    actorKind: "platform_admin",
    actorEmailSnapshot: "operator@example.test",
    safeSummary:
      "Provisioned the reviewed 104857600-byte free-trial storage entitlement for an existing school through Platform; no invoice or payment created",
  });
});

it("returns requires_review when the selected school has conflicting storage history", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run(async (ctx) => {
    await ctx.db.insert("platformAdmins", {
      authId: "review-operator",
      email: "review@example.test",
      name: "Review Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const id = await ctx.db.insert("schools", {
      name: "History School",
      slug: "history-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const rate = {
      currency: "NGN",
      perStudentMinor: 0,
      setupMinor: 0,
      minimumMinor: 0,
      discountBps: 0,
      bands: [],
      cadence: "termly" as const,
      proration: "daily" as const,
    };
    const rateVersionId = await ctx.db.insert("commercialRateVersions", {
      code: "legacy",
      name: "Legacy",
      version: 1,
      effectiveFrom: 1,
      rate,
      createdAt: 1,
    });
    await ctx.db.insert("commercialContracts", {
      schoolId: id,
      rateVersionId,
      code: "legacy",
      version: 1,
      rate,
      effectiveFrom: 1,
      effectiveTo: 2,
      setupHandling: "waived",
      setupReason: "Legacy reviewed history",
      createdAt: 1,
    });
    return id;
  });
  const platform = t.withIdentity({
    subject: "review-operator",
    tokenIdentifier: "test|review-operator",
  });

  await expect(
    platform.query(api.functions.platform.index.getSchoolStorageProvisioningState, {
      schoolId,
    }),
  ).resolves.toMatchObject({ recordState: "requires_review" });
  await expect(
    platform.mutation(api.functions.platform.index.provisionSchoolFreeTrialStorage, {
      schoolId,
      confirmation: "PROVISION FREE TRIAL STORAGE",
    }),
  ).resolves.toEqual({ status: "requires_review" });
});

it("requires review instead of creating a zeroed meter for existing storage", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("platformAdmins", {
      authId: "storage-review-operator",
      email: "storage-review@example.test",
      name: "Storage Review Operator",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const id = await ctx.db.insert("schools", {
      name: "Legacy Storage Academy",
      slug: "legacy-storage-academy",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const storageId = await ctx.storage.store(new Blob(["legacy school asset"]));
    await ctx.db.insert("schoolAssets", {
      schoolId: id,
      storageId,
      fileName: "legacy.txt",
      mimeType: "text/plain",
      byteSize: 19,
      sha256: "legacy-storage-sha256",
      category: "document",
      scanStatus: "clean",
      isTrashed: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });
  const platform = t.withIdentity({
    subject: "storage-review-operator",
    tokenIdentifier: "test|storage-review-operator",
  });

  await expect(
    platform.query(api.functions.platform.index.getSchoolStorageProvisioningState, {
      schoolId,
    }),
  ).resolves.toMatchObject({ recordState: "requires_review" });
  await expect(
    platform.mutation(api.functions.platform.index.provisionSchoolFreeTrialStorage, {
      schoolId,
      confirmation: "PROVISION FREE TRIAL STORAGE",
    }),
  ).resolves.toEqual({ status: "requires_review" });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("usageMeterAllocations")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .collect(),
    ),
  ).toHaveLength(0);
});
