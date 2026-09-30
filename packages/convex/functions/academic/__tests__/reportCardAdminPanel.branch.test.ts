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
const settings = api.functions.academic.reportCardTermSettings;
const comments = api.functions.academic.reportCards.saveStudentReportCardComments;

async function setup() {
  const t = convexTest(schema, mapped);
  const ids = await t.run(async (ctx) => {
    const schools = [];
    for (const slug of ["panel-default", "panel-branch", "panel-foreign"]) {
      schools.push(await ctx.db.insert("schools", { name: slug, slug, status: "active", createdAt: 1, updatedAt: 1 }));
    }
    const operator = await seedReviewedTenantOperatorWithCapabilities(ctx, schools.slice(0, 2), "panel-admin", [
      "academic.report_cards.preview", "academic.grading_bands.manage", "academic.assessments.enter",
    ]);
    await ctx.db.patch(operator.memberships[0].userId, { authTokenIdentifier: "panel-admin" });
    const rows = [];
    for (const schoolId of schools) {
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: 1, endDate: 100, isActive: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 1, endDate: 50, isActive: true, createdAt: 1, updatedAt: 1 });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "primary", createdAt: 1, updatedAt: 1 });
      const userId = await ctx.db.insert("users", { schoolId, authId: `student-${schoolId}`, name: "Pupil", email: `student-${schoolId}@test.invalid`, role: "student", createdAt: 1, updatedAt: 1 });
      const studentId = await ctx.db.insert("students", { schoolId, userId, classId, admissionNumber: "A-1", gender: "female", createdAt: 1, updatedAt: 1 });
      rows.push({ schoolId, sessionId, termId, classId, studentId });
    }
    return rows;
  });
  return { t, rows: ids, admin: t.withIdentity({ subject: "panel-admin", tokenIdentifier: "panel-admin" }) };
}

const defaults = { nextTermBegins: null, defaultTimesSchoolOpened: 42, resultCalculationMode: "standalone" as const };
const group = { groupId: null, name: "Juniors", nextTermBegins: null, timesSchoolOpened: 27 };

describe("report card Admin panel branch settings", () => {
  it("reads and writes the selected branch while no-arg callers still use the default", async () => {
    const { t, rows, admin } = await setup();
    const [legacy, branch] = rows;
    expect((await admin.query(settings.getTermReportCardSettings, { termId: legacy.termId })).termId).toBe(legacy.termId);
    expect((await admin.query(settings.getTermReportCardSettings, { schoolId: branch.schoolId, termId: branch.termId })).termId).toBe(branch.termId);
    await admin.mutation(settings.saveTermReportCardDefaults, { schoolId: branch.schoolId, termId: branch.termId, ...defaults });
    const groupId = await admin.mutation(settings.saveTermReportCardSettingGroup, { schoolId: branch.schoolId, termId: branch.termId, classIds: [branch.classId], ...group });
    await admin.mutation(comments, { schoolId: branch.schoolId, studentId: branch.studentId, sessionId: branch.sessionId, termId: branch.termId, classTeacherComment: "Progress", headTeacherComment: "Approved" });
    expect(await admin.query(settings.getTermReportCardSettings, { schoolId: branch.schoolId, termId: branch.termId })).toMatchObject({ defaultTimesSchoolOpened: 42, groups: [{ _id: groupId, timesSchoolOpened: 27 }] });
    expect((await admin.query(settings.getTermReportCardSettings, { termId: legacy.termId })).groups).toEqual([]);
    await t.run(async (ctx) => {
      const stored = await ctx.db.query("reportCardComments").withIndex("by_student_session_term", q => q.eq("studentId", branch.studentId).eq("sessionId", branch.sessionId).eq("termId", branch.termId)).unique();
      expect(stored).toMatchObject({ schoolId: branch.schoolId, headTeacherComment: "Approved" });
    });
    await admin.mutation(settings.deleteTermReportCardSettingGroup, { schoolId: branch.schoolId, groupId });
    expect((await admin.query(settings.getTermReportCardSettings, { schoolId: branch.schoolId, termId: branch.termId })).groups).toEqual([]);
    await admin.mutation(settings.saveTermReportCardDefaults, { termId: legacy.termId, ...defaults });
    const legacyGroupId = await admin.mutation(settings.saveTermReportCardSettingGroup, { termId: legacy.termId, classIds: [legacy.classId], ...group });
    await admin.mutation(comments, { studentId: legacy.studentId, sessionId: legacy.sessionId, termId: legacy.termId, classTeacherComment: "Legacy" });
    expect((await admin.query(settings.getTermReportCardSettings, { termId: legacy.termId })).groups).toMatchObject([{ _id: legacyGroupId }]);
    await admin.mutation(settings.deleteTermReportCardSettingGroup, { groupId: legacyGroupId });
  });

  it("rejects foreign schools, mismatched tuples and cross-branch group IDs", async () => {
    const { rows, admin } = await setup();
    const [legacy, branch, foreign] = rows;
    await expect(admin.query(settings.getTermReportCardSettings, { schoolId: foreign.schoolId, termId: foreign.termId })).rejects.toThrow();
    await expect(admin.mutation(settings.saveTermReportCardDefaults, { schoolId: foreign.schoolId, termId: foreign.termId, ...defaults })).rejects.toThrow();
    await expect(admin.mutation(settings.saveTermReportCardSettingGroup, { schoolId: foreign.schoolId, termId: foreign.termId, classIds: [foreign.classId], ...group })).rejects.toThrow();
    await expect(admin.mutation(comments, { schoolId: foreign.schoolId, studentId: foreign.studentId, sessionId: foreign.sessionId, termId: foreign.termId, classTeacherComment: "No", headTeacherComment: "No" })).rejects.toThrow();
    await expect(admin.query(settings.getTermReportCardSettings, { schoolId: branch.schoolId, termId: legacy.termId })).rejects.toThrow();
    await expect(admin.mutation(settings.saveTermReportCardDefaults, { schoolId: branch.schoolId, termId: legacy.termId, ...defaults })).rejects.toThrow();
    await expect(admin.mutation(settings.saveTermReportCardSettingGroup, { schoolId: branch.schoolId, termId: branch.termId, classIds: [legacy.classId], ...group })).rejects.toThrow();
    await expect(admin.mutation(comments, { schoolId: branch.schoolId, studentId: legacy.studentId, sessionId: legacy.sessionId, termId: legacy.termId, classTeacherComment: "No" })).rejects.toThrow();
    const groupId = await admin.mutation(settings.saveTermReportCardSettingGroup, { schoolId: branch.schoolId, termId: branch.termId, classIds: [branch.classId], ...group });
    await expect(admin.mutation(settings.deleteTermReportCardSettingGroup, { schoolId: legacy.schoolId, groupId })).rejects.toThrow();
    await expect(admin.mutation(settings.deleteTermReportCardSettingGroup, { schoolId: foreign.schoolId, groupId })).rejects.toThrow();
  });
});
