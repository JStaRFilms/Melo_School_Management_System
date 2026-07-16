/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { DEMO_STUDENTS } from "./functions/academic/demoData";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type TestConvex = ReturnType<typeof convexTest>;

async function assets(t: TestConvex) {
  return await t.run(async (ctx) => ({
    logoStorageId: await ctx.storage.store(new Blob(["logo"], { type: "image/png" })),
    portraitStorageIds: await Promise.all(DEMO_STUDENTS.map(() => ctx.storage.store(new Blob(["portrait"], { type: "image/png" })))),
  }));
}

async function start(t: TestConvex) {
  const runId = await t.mutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
    adminAuthId: "auth-admin", teacherAuthId: "auth-teacher", portalAuthId: "auth-portal", ...(await assets(t)),
  });
  await t.mutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
  return runId;
}

async function finish(t: TestConvex, runId: Awaited<ReturnType<typeof start>>) {
  for (let index = 0; index < 3; index += 1) await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
  for (let index = 0; index < 6; index += 1) await t.mutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId });
  for (let index = 0; index < 3; index += 1) await t.mutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId });
  return await t.mutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
}

describe("demo-school phased seed integration", () => {
  test("reset traversal preserves another tenant", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const demoSchoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
      const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
      const demoUserId = await ctx.db.insert("users", { schoolId: demoSchoolId, authId: "demo", name: "Demo", email: "demo@example.test", role: "admin", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("users", { schoolId: otherSchoolId, authId: "other", name: "Other", email: "other@example.test", role: "admin", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("families", { schoolId: demoSchoolId, name: "Demo family", createdAt: 1, updatedAt: 1, createdBy: demoUserId, updatedBy: demoUserId });
    });
    for (let attempt = 0; attempt < 10; attempt += 1) if ((await t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {})).complete) break;
    expect((await t.run((ctx) => ctx.db.query("schools").collect())).map((school) => school.slug)).toEqual(["other-school"]);
  });

  test("auth conflict inspection rejects an email attached to another tenant", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("users", { schoolId, authId: "external-auth", name: "External", email: "admin@demo-academy.school", role: "admin", createdAt: 1, updatedAt: 1 });
    });
    const inspection = await t.query(internal.functions.academic.seed.inspectDemoAuthUsageInternal, { authIds: ["external-auth"], emails: ["admin@demo-academy.school"] });
    expect(inspection.conflicts.join(" ")).toContain("other-school");
  });

  test("storage cleanup deduplicates IDs and acknowledges legacy duplicate rows", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["portrait"], { type: "image/png" })));
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("demoSeedStorageCleanup", { schoolId, schoolSlug: "demo-school", storageId, createdAt: 1 });
      await ctx.db.insert("demoSeedStorageCleanup", { schoolId, schoolSlug: "demo-school", storageId, createdAt: 2 });
    });
    expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {})).toEqual([storageId]);
    // A failed storage delete leaves one deduplicated ID available to the next retry.
    expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {})).toEqual([storageId]);
    await t.mutation(internal.functions.academic.seed.acknowledgeDemoStorageCleanupInternal, { storageIds: [storageId, storageId] });
    expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("demoSeedStorageCleanup").collect())).toEqual([]);
  });

  test("persists cursors and safely restarts a partial run by reset", async () => {
    const t = convexTest(schema, modules);
    const runId = await start(t);
    const firstBatch = await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
    expect(firstBatch).toMatchObject({ phase: "students", cursor: 12 });
    const persisted = await t.run((ctx) => ctx.db.get(runId));
    expect(persisted?.studentCursor).toBe(12);
    for (let attempt = 0; attempt < 100; attempt += 1) if ((await t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {})).complete) break;
    const rerun = await finish(t, await start(t));
    expect(rerun).toMatchObject({ studentCount: 36, invoiceCount: 36, assessmentRecordCount: 756 });
  });

  test("phases create correct family, billing, and portal relationships", async () => {
    const t = convexTest(schema, modules); const seeded = await finish(t, await start(t));
    const counts = await t.run(async (ctx) => ({
      families: await ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      members: await ctx.db.query("familyMembers").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      applications: await ctx.db.query("feePlanApplications").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      portalMaterials: await ctx.db.query("knowledgeMaterials").withIndex("by_school_and_visibility", (q) => q.eq("schoolId", seeded.schoolId).eq("visibility", "student_approved")).collect(),
      topics: await ctx.db.query("knowledgeTopics").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      bindings: await ctx.db.query("knowledgeMaterialClassBindings").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      classes: await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      run: await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).unique(),
    }));
    expect(counts.families).toHaveLength(18); expect(counts.members).toHaveLength(18);
    expect(counts.applications.map((row) => row.createdInvoiceCount)).toEqual([12, 12, 12]);
    expect(counts.portalMaterials).toHaveLength(6); expect(counts.topics).toHaveLength(6);
    expect(counts.bindings).toHaveLength(12);
    expect(new Set(counts.bindings.map((binding) => binding.classId))).toEqual(new Set(counts.classes.slice(0, 2).map((classDoc) => classDoc._id)));
    expect(counts.run).toMatchObject({ status: "succeeded", phase: "complete" });
  });
});
