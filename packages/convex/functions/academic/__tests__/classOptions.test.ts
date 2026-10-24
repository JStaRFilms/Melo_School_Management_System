import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import { listClasses, listClassOptions } from "../academicSetup";
import { seedReviewedTenantOperator, seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";
import { observeReads, queryHandler } from "./readMetrics";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob("../../../**/*.ts"))
  .map(([path, load]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, load]));
const endpoint = api.functions.academic.academicSetup.listClassOptions;
const identity = { subject: "class-options-admin", tokenIdentifier: "class-options-admin" };
const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Synthetic", slug: "class-options", status: "active", createdAt: 1, updatedAt: 1 });
    const foreignId = await ctx.db.insert("schools", { name: "Foreign", slug: "class-options-foreign", status: "active", createdAt: 1, updatedAt: 1 });
    const operator = await seedReviewedTenantOperator(ctx, [schoolId], identity.tokenIdentifier);
    const userId = operator.memberships[0].userId;
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "class-options-teacher", ["academic.report_cards.preview"], { role: "teacher" });
    await ctx.db.insert("classes", { schoolId: foreignId, name: "Foreign class", level: "Primary", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("classes", { schoolId, name: "Archived class", level: "Primary", isArchived: true, createdAt: 1, updatedAt: 1 });
    const subjects = await Promise.all(Array.from({ length: 12 }, (_, i) => ctx.db.insert("subjects", {
      schoolId, name: `Synthetic subject ${i + 1}`, code: `S${i}`, createdAt: 1, updatedAt: 1,
    })));
    for (let i = 0; i < 12; i++) {
      const classId = await ctx.db.insert("classes", { schoolId, name: `primary ${i + 1}`, gradeName: `primary ${i + 1}`, classLabel: "a", level: "pri", formTeacherId: userId,
        ...(i % 2 ? { isArchived: false } : {}), createdAt: 1, updatedAt: 1 });
      for (const subjectId of subjects) await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: 1, updatedAt: 1 });
      for (let j = 0; j < 30; j++) await ctx.db.insert("students", { schoolId, classId, userId, admissionNumber: `SYN-${i}-${j}`, createdAt: 1, updatedAt: 1 });
    }
  });
  return { t, viewer: t.withIdentity(identity) };
}

it("returns every active class option with identical names, levels and ordering, without detail reads", { timeout: 30_000 }, async () => {
  const { viewer } = await fixture();
  const before = await viewer.run(async (ctx) => {
    const observed = observeReads(ctx.db);
    return { result: await queryHandler(listClasses)({ ...ctx, db: observed.db }, {}), metrics: observed.metrics };
  });
  const after = await viewer.run(async (ctx) => {
    const observed = observeReads(ctx.db);
    return { result: await queryHandler(listClassOptions)({ ...ctx, db: observed.db }, {}), metrics: observed.metrics, tables: observed.tables };
  });
  expect(after.result).toEqual(before.result.map(({ _id, name, level, gradeName }) => ({ _id, name, level, gradeName })));
  expect(after.result).toHaveLength(12);
  expect(after.result[0].name).toBe("Primary 1 - A");
  expect(after.result[11].name).toBe("Primary 12 - A");
  expect(after.result.every((row) => row.level === "Primary")).toBe(true);
  expect(after.tables).not.toEqual(expect.arrayContaining(["students"]));
  expect(after.tables.some((table) => ["classSubjects", "subjects", "classSessionFormTeachers", "teacherAssignments"].includes(table))).toBe(false);
  expect(after.metrics.documents).toBeLessThan(before.metrics.documents / 5);
  expect(jsonBytes(after.result)).toBeLessThan(jsonBytes(before.result) / 2);
  console.info("class-options synthetic read occurrences and JSON-byte proxies", JSON.stringify({
    fixture: { classes: 12, subjectsPerClass: 12, studentsPerClass: 30 },
    before: { ...before.metrics, responseBytes: jsonBytes(before.result) },
    after: { ...after.metrics, responseBytes: jsonBytes(after.result) },
  }));
});

it("keeps anonymous and non-admin access denied at the registered API", async () => {
  const { t } = await fixture();
  await expect(t.query(endpoint, {})).rejects.toThrow();
  await expect(t.withIdentity({ subject: "class-options-teacher", tokenIdentifier: "class-options-teacher" }).query(endpoint, {})).rejects.toThrow();
  const result = await t.withIdentity(identity).query(endpoint, {});
  expect(result.some((row) => /Foreign|Archived/.test(row.name))).toBe(false);
});
