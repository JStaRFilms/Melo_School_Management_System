import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import {
  assertTeacherAssignment,
  teacherHasClassAccess,
} from "../teacherAccess";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "S", slug: "p8-teacher", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "O", slug: "p8-other", status: "active", createdAt: now, updatedAt: now });
    const teacherId = await ctx.db.insert("users", { schoolId, authId: "t1", name: "T1", email: "t1@p8.test", role: "teacher", createdAt: now, updatedAt: now });
    const strangerId = await ctx.db.insert("users", { schoolId, authId: "t2", name: "T2", email: "t2@p8.test", role: "teacher", createdAt: now, updatedAt: now });
    const formTeacherId = await ctx.db.insert("users", { schoolId, authId: "t3", name: "T3", email: "t3@p8.test", role: "teacher", createdAt: now, updatedAt: now });
    const branchTeacherId = await ctx.db.insert("users", { schoolId: otherSchoolId, authId: "t4", name: "T4", email: "t4@p8.test", role: "teacher", createdAt: now, updatedAt: now });
    const classId = await ctx.db.insert("classes", { schoolId, name: "P1", level: "primary", createdAt: now, updatedAt: now });
    const formClassId = await ctx.db.insert("classes", { schoolId, name: "P2", level: "primary", formTeacherId, createdAt: now, updatedAt: now });
    const subjectAId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "M", createdAt: now, updatedAt: now });
    const subjectBId = await ctx.db.insert("subjects", { schoolId, name: "Eng", code: "E", createdAt: now, updatedAt: now });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId: subjectAId, createdAt: now, updatedAt: now });
    await ctx.db.insert("classSubjects", { schoolId, classId: formClassId, subjectId: subjectAId, createdAt: now, updatedAt: now });
    await ctx.db.insert("teacherAssignments", { schoolId, teacherId, classId, subjectId: subjectAId, createdAt: now, updatedAt: now });
    await ctx.db.insert("teacherAssignments", { schoolId, teacherId: branchTeacherId, classId, subjectId: subjectAId, createdAt: now, updatedAt: now });
    return { schoolId, teacherId, strangerId, formTeacherId, branchTeacherId, classId, formClassId, subjectAId, subjectBId };
  });
  return { t, ...ids };
}

describe("teacherAccess granularity matrix (consolidation P8)", () => {
  it("allows the assigned pair and class", async () => {
    const f = await fixture();
    await f.t.run((ctx) => assertTeacherAssignment(ctx, f.teacherId, f.classId, f.subjectAId));
    expect(await f.t.run((ctx) => teacherHasClassAccess(ctx, f.teacherId, f.schoolId, f.classId))).toBe(true);
  });

  it("denies the wrong subject at pair level but allows class level (reportCards policy)", async () => {
    const f = await fixture();
    await expect(
      f.t.run((ctx) => assertTeacherAssignment(ctx, f.teacherId, f.classId, f.subjectBId)),
    ).rejects.toThrow("Not assigned to this class-subject");
    expect(await f.t.run((ctx) => teacherHasClassAccess(ctx, f.teacherId, f.schoolId, f.classId))).toBe(true);
  });

  it("denies unassigned teachers at both levels", async () => {
    const f = await fixture();
    await expect(
      f.t.run((ctx) => assertTeacherAssignment(ctx, f.strangerId, f.classId, f.subjectAId)),
    ).rejects.toThrow("Not assigned to this class-subject");
    expect(await f.t.run((ctx) => teacherHasClassAccess(ctx, f.strangerId, f.schoolId, f.classId))).toBe(false);
  });

  it("allows the form teacher for offered subjects without assignment rows", async () => {
    const f = await fixture();
    await f.t.run((ctx) => assertTeacherAssignment(ctx, f.formTeacherId, f.formClassId, f.subjectAId));
    expect(await f.t.run((ctx) => teacherHasClassAccess(ctx, f.formTeacherId, f.schoolId, f.formClassId))).toBe(true);
  });

  it("denies branch-projected teachers joined only by assignment rows", async () => {
    const f = await fixture();
    await expect(
      f.t.run((ctx) => assertTeacherAssignment(ctx, f.branchTeacherId, f.classId, f.subjectAId)),
    ).rejects.toThrow("Not assigned to this class-subject");
    expect(await f.t.run((ctx) => teacherHasClassAccess(ctx, f.branchTeacherId, f.schoolId, f.classId))).toBe(false);
  });
});
