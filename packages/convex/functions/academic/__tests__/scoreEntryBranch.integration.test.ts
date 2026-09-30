import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { scoreRowBaseline } from "@school/shared/drafts/scoreRowBaseline";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const selectors = api.functions.academic.adminSelectors;
const records = api.functions.academic.assessmentRecords;

it("lets an admin correct a selected branch score, retains default routing, and denies foreign branches", async () => {
  const t = convexTest(schema, modules);
  const f = await t.run(async ctx => {
    const personId = await ctx.db.insert("persons", { name: "Owner", email: "owner@school.test", authTokenIdentifier: "test|owner", status: "active", createdAt: 1, updatedAt: 1 });
    const makeSchool = async (name: string, member: boolean, isDefaultBranch: boolean) => {
      const schoolId = await ctx.db.insert("schools", { name, slug: name.toLowerCase(), status: "active", createdAt: 1, updatedAt: 1 });
      const userId = await ctx.db.insert("users", { schoolId, personId: member ? personId : undefined, authId: member ? "owner" : "foreign",
        ...(isDefaultBranch ? { authTokenIdentifier: "test|owner" } : {}), name: "Owner", email: "owner@school.test", role: "admin", createdAt: 1, updatedAt: 1 });
      if (member) await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: userId, isDefaultBranch, status: "active", joinedAt: 1, updatedAt: 1 });
      await ctx.db.insert("gradingBands", { schoolId, minScore: 0, maxScore: 100, gradeLetter: "A", remark: "Good",
        isActive: true, createdAt: 1, updatedAt: 1, updatedBy: userId });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: `${name} session`, startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Class", level: "Primary", isArchived: false, createdAt: 1, updatedAt: 1 });
      const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "M", isArchived: false, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: 1, updatedAt: 1 });
      const studentId = await ctx.db.insert("students", { schoolId, userId, classId, admissionNumber: "123", isArchived: false, createdAt: 1, updatedAt: 1 });
      const recordId = await ctx.db.insert("assessmentRecords", { schoolId, sessionId, termId, classId, subjectId, studentId,
        ca1: 10, ca2: 10, ca3: 15, examRawScore: 30, examScaledScore: 30, total: 65, gradeLetter: "A", remark: "Good",
        examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40,
        status: "draft", enteredBy: userId, updatedBy: userId, createdAt: 1, updatedAt: 1 });
      return { schoolId, sessionId, termId, classId, subjectId, studentId, recordId };
    };
    return { base: await makeSchool("Default", true, true), branch: await makeSchool("Branch", true, false), foreign: await makeSchool("Foreign", false, false) };
  });
  const viewer = t.withIdentity({ subject: "owner", issuer: "test", tokenIdentifier: "test|owner" });
  expect(await viewer.query(selectors.getAdminSessions, {})).toMatchObject([{ id: f.base.sessionId }]);
  expect(await viewer.query(selectors.getTermsBySession, { sessionId: f.base.sessionId })).toMatchObject([{ id: f.base.termId }]);
  expect(await viewer.query(selectors.getAllClasses, {})).toMatchObject([{ id: f.base.classId }]);
  expect(await viewer.query(selectors.getSubjectsByClass, { classId: f.base.classId })).toMatchObject([{ id: f.base.subjectId }]);
  expect(await viewer.query(selectors.getAdminSessions, { schoolId: f.branch.schoolId })).toMatchObject([{ id: f.branch.sessionId }]);
  expect(await viewer.query(selectors.getTermsBySession, { sessionId: f.branch.sessionId, schoolId: f.branch.schoolId })).toMatchObject([{ id: f.branch.termId }]);
  expect(await viewer.query(selectors.getAllClasses, { schoolId: f.branch.schoolId })).toMatchObject([{ id: f.branch.classId }]);
  expect(await viewer.query(selectors.getSubjectsByClass, { schoolId: f.branch.schoolId, classId: f.branch.classId })).toMatchObject([{ id: f.branch.subjectId }]);
  const sheetArgs = { schoolId: f.branch.schoolId, sessionId: f.branch.sessionId, termId: f.branch.termId,
    classId: f.branch.classId, subjectId: f.branch.subjectId };
  const originalSheet = await viewer.query(records.getExamEntrySheet, sheetArgs);
  expect(originalSheet.roster).toMatchObject([
    { studentId: f.branch.studentId, assessmentRecord: { ca3: 15 } },
  ]);
  const recoveredBaseline = scoreRowBaseline(originalSheet.roster[0].assessmentRecord);
  const draft = { studentId: f.branch.studentId, ca1: 10, ca2: 10, ca3: 8, examRawScore: 30, expectedRow: recoveredBaseline };
  // An unmodified recovered draft saves with its original expected row.
  expect(await viewer.mutation(records.upsertAssessmentRecordsBulk, { ...sheetArgs, records: [draft] }))
    .toMatchObject({ updated: 1, errors: [] });
  // A second teacher's change after that draft was captured cannot be overwritten.
  const freshBaseline = scoreRowBaseline(await t.run(ctx => ctx.db.get(f.branch.recordId)));
  expect(await viewer.mutation(records.upsertAssessmentRecordsBulk, { ...sheetArgs, records: [
    { ...draft, ca3: 9, expectedRow: freshBaseline },
  ] })).toMatchObject({ updated: 1, errors: [] });
  const newStudentId = await t.run(async ctx => ctx.db.insert("students", { schoolId: f.branch.schoolId,
    userId: (await ctx.db.get(f.branch.recordId))!.enteredBy, classId: f.branch.classId,
    admissionNumber: "456", isArchived: false, createdAt: 1, updatedAt: 1 }));
  const newRow = { studentId: newStudentId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 30, expectedRow: null };
  // A stale row cannot block an unrelated, newly entered row in the same batch.
  expect(await viewer.mutation(records.upsertAssessmentRecordsBulk, { ...sheetArgs, records: [draft, newRow] }))
    .toMatchObject({ updated: 0, created: 1, errors: [{ studentId: f.branch.studentId, field: "record", message: expect.stringContaining("changed") }] });
  expect(await t.run(ctx => ctx.db.get(f.branch.recordId))).toMatchObject({ ca3: 9 });
  expect(await viewer.mutation(records.upsertAssessmentRecordsBulk, { ...sheetArgs, records: [newRow] }))
    .toMatchObject({ updated: 0, errors: [{ studentId: newStudentId, field: "record" }] });
  expect(await t.run(ctx => ctx.db.get(f.base.recordId))).toMatchObject({ ca3: 15 });
  const defaultSheet = await viewer.query(records.getExamEntrySheet, { sessionId: f.base.sessionId, termId: f.base.termId,
    classId: f.base.classId, subjectId: f.base.subjectId });
  expect(defaultSheet.roster).toMatchObject([{ studentId: f.base.studentId }]);
  expect(await viewer.mutation(records.upsertAssessmentRecordsBulk, { sessionId: f.base.sessionId, termId: f.base.termId,
    classId: f.base.classId, subjectId: f.base.subjectId, records: [
      { studentId: f.base.studentId, ca1: 10, ca2: 10, ca3: 14, examRawScore: 30,
        expectedRow: scoreRowBaseline(defaultSheet.roster[0].assessmentRecord) },
    ] })).toMatchObject({ updated: 1, errors: [] });
  for (const schoolId of [f.branch.schoolId, f.foreign.schoolId]) {
    const sessionId = schoolId === f.branch.schoolId ? f.base.sessionId : f.foreign.sessionId;
    const classId = schoolId === f.branch.schoolId ? f.base.classId : f.foreign.classId;
    await expect(viewer.query(selectors.getTermsBySession, { schoolId, sessionId })).rejects.toThrow();
    await expect(viewer.query(selectors.getSubjectsByClass, { schoolId, classId })).rejects.toThrow();
  }
  await expect(viewer.query(selectors.getAllClasses, { schoolId: f.foreign.schoolId })).rejects.toThrow();
  await expect(viewer.query(selectors.getAdminSessions, { schoolId: f.foreign.schoolId })).rejects.toThrow();
  await expect(viewer.query(records.getExamEntrySheet, { ...sheetArgs, schoolId: f.foreign.schoolId })).rejects.toThrow();
  await expect(viewer.mutation(records.upsertAssessmentRecordsBulk, { ...sheetArgs, schoolId: f.foreign.schoolId, records: [] })).rejects.toThrow();
});
