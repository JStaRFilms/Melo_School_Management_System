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
        { isArchived: true },
      ].entries()) {
        const userId = await ctx.db.insert("users", {
          schoolId,
          authId: `student-${index}`,
          name: `Student ${index}`,
          email: `student-${index}@school.test`,
          role: "student",
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

  it("initializes newly provisioned schools at zero", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("platformAdmins", {
        authId: platformIdentity.subject,
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
