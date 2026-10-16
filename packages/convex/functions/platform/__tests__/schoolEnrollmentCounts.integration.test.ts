import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const platformIdentity = {
  subject: "platform-enrollment-admin",
  tokenIdentifier: "https://auth.school.test|platform-enrollment-admin",
};

describe("platform school enrollment visibility", () => {
  it("recalculates current enrollment without exposing student records", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = 1;
      await ctx.db.insert("platformAdmins", {
        authId: platformIdentity.subject,
        authTokenIdentifier: platformIdentity.tokenIdentifier,
        email: "owner@platform.test",
        name: "Platform Owner",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const schoolId = await ctx.db.insert("schools", {
        name: "Counted School",
        slug: "counted-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId,
        name: "Primary 1",
        gradeName: "Primary 1",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });

      for (const [index, state] of [
        {},
        { enrollmentStatus: "active" as const },
        { enrollmentStatus: "graduated" as const },
        { enrollmentStatus: "withdrawn" as const },
        { enrollmentStatus: "suspended" as const },
        { enrollmentStatus: "transferred_out" as const },
        { isArchived: true },
      ].entries()) {
        const userId = await ctx.db.insert("users", {
          schoolId,
          authId: `student-${index}`,
          name: `Student ${index}`,
          email: `student-${index}@school.test`,
          role: "student",
          isArchived: index === 0,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("students", {
          schoolId,
          classId,
          userId,
          admissionNumber: `COUNT-${index}`,
          ...state,
          createdAt: now,
          updatedAt: now,
        });
      }
      return schoolId;
    });

    await expect(t.query(api.functions.platform.index.listSchools, {})).rejects.toThrow(
      "Unauthorized",
    );

    const before = await t
      .withIdentity(platformIdentity)
      .query(api.functions.platform.index.listSchools, {});
    expect(before[0].currentStudentCount).toBeNull();
    expect(before[0]).not.toHaveProperty("students");

    await expect(
      t.withIdentity(platformIdentity).mutation(
        api.functions.platform.index.recalculateSchoolEnrollmentCount,
        { schoolId },
      ),
    ).resolves.toEqual({ currentStudentCount: 2 });

    const after = await t
      .withIdentity(platformIdentity)
      .query(api.functions.platform.index.listSchools, {});
    expect(after[0].currentStudentCount).toBe(2);
  });

  it("denies inactive Platform identities and rejects overflow without publishing a partial count", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const platformId = await ctx.db.insert("platformAdmins", { authId: platformIdentity.subject, authTokenIdentifier: platformIdentity.tokenIdentifier, email: "owner@platform.test", name: "Platform Owner", isActive: false, createdAt: 1, updatedAt: 1 });
      const schoolId = await ctx.db.insert("schools", { name: "Overflow", slug: "overflow-count", status: "active", createdAt: 1, updatedAt: 1 });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary", level: "Primary", createdAt: 1, updatedAt: 1 });
      const userId = await ctx.db.insert("users", { schoolId, authId: "overflow-student", name: "Student", email: "student@overflow.test", role: "student", createdAt: 1, updatedAt: 1 });
      const countId = await ctx.db.insert("schoolEnrollmentCounts", { schoolId, currentStudentCount: 7, updatedAt: 1 });
      for (let index = 0; index <= 10_000; index++) await ctx.db.insert("students", { schoolId, classId, userId, admissionNumber: `OVER-${index}`, createdAt: 1, updatedAt: 1 });
      return { platformId, schoolId, countId };
    });
    const actor = t.withIdentity(platformIdentity);
    await expect(actor.mutation(api.functions.platform.index.recalculateSchoolEnrollmentCount, { schoolId: ids.schoolId })).rejects.toThrow();
    await t.run(ctx => ctx.db.patch(ids.platformId, { isActive: true }));
    await expect(actor.mutation(api.functions.platform.index.recalculateSchoolEnrollmentCount, { schoolId: ids.schoolId })).rejects.toThrow("recalculation limit");
    expect(await t.run(ctx => ctx.db.get(ids.countId))).toMatchObject({ currentStudentCount: 7, updatedAt: 1 });
  });

  it("initializes newly provisioned schools at zero", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("platformAdmins", {
        authId: platformIdentity.subject,
        authTokenIdentifier: platformIdentity.tokenIdentifier,
        email: "owner@platform.test",
        name: "Platform Owner",
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.withIdentity(platformIdentity).mutation(
      api.functions.platform.index.createSchool,
      { name: "Empty School", slug: "empty-school" },
    );

    const schools = await t
      .withIdentity(platformIdentity)
      .query(api.functions.platform.index.listSchools, {});
    expect(schools[0].currentStudentCount).toBe(0);
  });
});
