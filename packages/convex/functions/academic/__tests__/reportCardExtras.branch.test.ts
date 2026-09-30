declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const modules = import.meta.glob("../../../**/*.ts");
const root = new URL("../../../", import.meta.url).pathname;
const mapped = Object.fromEntries(Object.entries(modules).map(([path, module]) =>
  [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const extras = api.functions.academic.reportCardExtras;

async function setup() {
  const t = convexTest(schema, mapped);
  const rows = await t.run(async (ctx) => {
    const schools = [];
    for (const slug of ["extras-default", "extras-branch", "extras-foreign"])
      schools.push(await ctx.db.insert("schools", { name: slug, slug, status: "active", createdAt: 1, updatedAt: 1 }));
    const operator = await seedReviewedTenantOperatorWithCapabilities(ctx, schools.slice(0, 2), "extras-admin", [
      "academic.report_cards.preview", "academic.assessments.enter",
    ]);
    await ctx.db.patch(operator.memberships[0].userId, { authTokenIdentifier: "extras-admin" });
    const result = [];
    for (const schoolId of schools) {
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: 1, endDate: 100, isActive: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 1, endDate: 50, isActive: true, createdAt: 1, updatedAt: 1 });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "primary", createdAt: 1, updatedAt: 1 });
      const userId = await ctx.db.insert("users", { schoolId, authId: `pupil-${schoolId}`, name: "Pupil", email: `pupil-${schoolId}@test.invalid`, role: "student", createdAt: 1, updatedAt: 1 });
      const studentId = await ctx.db.insert("students", { schoolId, userId, classId, admissionNumber: "A-1", gender: "female", createdAt: 1, updatedAt: 1 });
      result.push({ schoolId, sessionId, termId, classId, studentId });
    }
    return result;
  });
  return { rows, admin: t.withIdentity({ subject: "extras-admin", tokenIdentifier: "extras-admin" }) };
}

describe("report-card extras branch access", () => {
  it("reads and saves in an authorized non-default branch without changing legacy default callers", async () => {
    const { rows, admin } = await setup();
    const [legacy, branch] = rows;
    expect((await admin.query(extras.getStudentReportCardExtrasEntry, legacy)).studentId).toBe(legacy.studentId);
    expect((await admin.query(extras.getStudentReportCardExtrasEntry, branch)).studentId).toBe(branch.studentId);
    await expect(admin.mutation(extras.saveStudentReportCardExtrasEntry, { ...branch, bundleValues: [] })).resolves.toBeNull();
    await expect(admin.mutation(extras.saveStudentReportCardExtrasEntry, {
      studentId: legacy.studentId, classId: legacy.classId, sessionId: legacy.sessionId, termId: legacy.termId, bundleValues: [],
    })).resolves.toBeNull();
  });

  it("denies foreign membership and cross-branch tuples for both read and write", async () => {
    const { rows, admin } = await setup();
    const [legacy, branch, foreign] = rows;
    await expect(admin.query(extras.getStudentReportCardExtrasEntry, foreign)).rejects.toThrow();
    await expect(admin.mutation(extras.saveStudentReportCardExtrasEntry, { ...foreign, bundleValues: [] })).rejects.toThrow();
    await expect(admin.query(extras.getStudentReportCardExtrasEntry, { ...legacy, schoolId: branch.schoolId })).rejects.toThrow();
    await expect(admin.mutation(extras.saveStudentReportCardExtrasEntry, { ...legacy, schoolId: branch.schoolId, bundleValues: [] })).rejects.toThrow();
  });
});
