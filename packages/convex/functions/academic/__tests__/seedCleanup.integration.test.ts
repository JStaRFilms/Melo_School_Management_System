import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { internal } from "../../../_generated/api";
import { storageIdsOnRow } from "../seed";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);

it("refuses legacy reset without touching its seed run or logo", async () => {
  const t = convexTest(schema, modules);
  const { schoolId, logoStorageId } = await t.run(async (ctx) => {
    const now = Date.now();
    const logoStorageId = await ctx.storage.store(new Blob(["demo logo"], { type: "image/png" }));
    const schoolId = await ctx.db.insert("schools", {
      name: "Demo School",
      slug: "demo-school",
      status: "active",
      logoStorageId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("demoSeedRuns", {
      schoolId,
      seedProfile: "demo",
      status: "running",
      phase: "foundation",
      studentCursor: 0,
      assessmentCursor: 0,
      billingCursor: 0,
      adminAuthId: "demo-admin",
      teacherAuthId: "demo-teacher",
      portalAuthId: "demo-portal",
      logoStorageId,
      portraitStorageIds: [],
      createdAt: now,
      updatedAt: now,
    });
    return { schoolId, logoStorageId };
  });

  await expect(t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {
    seedProfile: "demo",
  })).rejects.toThrow("disabled");
  expect(await t.run((ctx) => ctx.db.get(schoolId))).not.toBeNull();
  expect(await t.run(async (ctx) => Boolean(await ctx.storage.get(logoStorageId)))).toBe(true);
  expect(await t.run((ctx) => ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).first())).not.toBeNull();
});

it("captures issued-report snapshot storage fields for reset cleanup", async () => {
  const t = convexTest(schema, modules);
  const [logoStorageId, photoStorageId] = await t.run(async (ctx) => [
    await ctx.storage.store(new Blob(["historical logo"])),
    await ctx.storage.store(new Blob(["historical photo"])),
  ]);

  expect(storageIdsOnRow({ schoolLogoStorageId: logoStorageId, studentPhotoStorageId: photoStorageId })).toEqual([
    logoStorageId,
    photoStorageId,
  ]);
});

it("blocks legacy reset of commercial snapshot children", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", {
      name: "Demo School",
      slug: "demo-school",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const userId = await ctx.db.insert("users", {
      schoolId,
      authId: "demo-student",
      name: "Demo Student",
      email: "demo-student@example.test",
      role: "student",
      createdAt: now,
      updatedAt: now,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "Demo Class",
      level: "1",
      createdAt: now,
      updatedAt: now,
    });
    const studentId = await ctx.db.insert("students", {
      schoolId,
      classId,
      userId,
      admissionNumber: "DEMO-1",
      createdAt: now,
      updatedAt: now,
    });
    const rate = {
      currency: "NGN",
      perStudentMinor: 100000,
      setupMinor: 0,
      minimumMinor: 0,
      discountBps: 0,
      bands: [],
      cadence: "termly" as const,
      proration: "none" as const,
    };
    const rateVersionId = await ctx.db.insert("commercialRateVersions", {
      code: "demo",
      name: "Demo",
      version: 1,
      effectiveFrom: now - 1,
      rate,
      createdAt: now,
    });
    const contractId = await ctx.db.insert("commercialContracts", {
      schoolId,
      rateVersionId,
      rate,
      code: "demo",
      version: 1,
      effectiveFrom: now - 1,
      effectiveTo: now + 1,
      setupHandling: "waived",
      setupReason: "Demo reset fixture",
      createdAt: now,
    });
    const invoiceId = await ctx.db.insert("subscriptionInvoices", {
      schoolId,
      contractId,
      chargeClass: "saas_subscription",
      status: "issued_unpaid",
      periodLabel: "Demo period",
      periodStart: now - 1,
      periodEnd: now + 1,
      coveredStart: now - 1,
      coveredEnd: now + 1,
      rate,
      studentCount: 1,
      excludedCount: 0,
      snapshotPolicy: "active_unique_user_v1",
      prorationNumerator: 1,
      prorationDenominator: 1,
      unitMinor: 100000,
      subtotalMinor: 100000,
      proratedMinor: 100000,
      discountMinor: 0,
      setupMinor: 0,
      totalMinor: 100000,
      createdAt: now,
    });
    const invoiceStudentId = await ctx.db.insert("subscriptionInvoiceStudents", {
      invoiceId,
      studentId,
    });
    return { schoolId, rateVersionId, contractId, invoiceId, invoiceStudentId };
  });

  await expect(t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {
    seedProfile: "demo",
  })).rejects.toThrow("disabled");
  expect(await t.run((ctx) => ctx.db.get(ids.schoolId))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.contractId))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.invoiceId))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.invoiceStudentId))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(ids.rateVersionId))).not.toBeNull();
});
