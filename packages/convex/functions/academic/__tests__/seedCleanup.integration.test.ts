import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { internal } from "../../../_generated/api";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);

it("resumes demo storage cleanup after the seed run row was already removed", async () => {
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

  const interrupted = await t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {
    seedProfile: "demo",
  });
  expect(interrupted).toMatchObject({ complete: false, deletedCount: 1, storageIds: [logoStorageId] });
  expect(await t.run((ctx) => ctx.db.get(schoolId))).not.toBeNull();
  expect(await t.run(async (ctx) => Boolean(await ctx.storage.get(logoStorageId)))).toBe(true);

  const resumed = await t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {
    seedProfile: "demo",
  });
  expect(resumed).toMatchObject({ complete: true, deletedCount: 1 });
  expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {
    seedProfile: "demo",
  })).toEqual([logoStorageId]);

  await t.run((ctx) => ctx.storage.delete(logoStorageId));
  await t.mutation(internal.functions.academic.seed.acknowledgeDemoStorageCleanupInternal, {
    storageIds: [logoStorageId],
  });
  expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {
    seedProfile: "demo",
  })).toEqual([]);
});
