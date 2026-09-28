import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { internal } from "../../../_generated/api";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const split = internal.functions.academic.branchSplitV2;
const policy = { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 };

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const source = await ctx.db.insert("schools", { name: "Fedrah", slug: "obhis-fedrah", status: "active", createdAt: 1, updatedAt: 1 });
    const target = await ctx.db.insert("schools", { name: "Ruga", slug: "obhis-ruga", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId: source, authId: "admin", name: "Admin", email: "admin@test.org", role: "admin", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId: source, name: "Year", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const targetSessionId = await ctx.db.insert("academicSessions", { schoolId: target, name: "Year", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId: source, sessionId, name: "Term", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId: source, name: "Class", level: "Primary", isArchived: false, createdAt: 1, updatedAt: 1 });
    const subjectId = await ctx.db.insert("subjects", { schoolId: source, name: "Math", code: "M", isArchived: false, createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId: source, userId, classId, admissionNumber: "123", isArchived: false, createdAt: 1, updatedAt: 1 });
    const recordId = await ctx.db.insert("assessmentRecords", { schoolId: source, sessionId, termId, classId, subjectId, studentId,
      ca1: 10, ca2: 10, ca3: 10, examRawScore: 30, examScaledScore: 30, total: 60, gradeLetter: "A", remark: "Good",
      examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft", enteredBy: userId, updatedBy: userId, createdAt: 1, updatedAt: 1 });
    const stateId = await ctx.db.insert("migrationState", { phase: "duplicating", sourceSchoolId: source, targetSchoolId: target,
      currentTable: "assessmentRecords", idMaps: JSON.stringify({ assessmentRecords: {} }), tablesCompleted: [], status: "running", createdAt: 1, updatedAt: 1 });
    return { source, target, userId, sessionId, targetSessionId, recordId, stateId };
  });
  return { t, ...ids };
}

it("fails closed when a target session mapping is absent or locked, before inserting a score", async () => {
  const f = await fixture();
  await expect(f.t.mutation(split.duplicateBatch, { stateId: f.stateId })).rejects.toThrow(/Missing target session mapping/);
  expect(await f.t.run(ctx => ctx.db.query("assessmentRecords").withIndex("by_school", q => q.eq("schoolId", f.target)).collect())).toEqual([]);
  await f.t.run(ctx => ctx.db.patch(f.stateId, {
    idMaps: JSON.stringify({ assessmentRecords: {}, academicSessions: { [f.sessionId]: f.sessionId } }),
  }));
  await expect(f.t.mutation(split.duplicateBatch, { stateId: f.stateId })).rejects.toThrow(/Invalid target session mapping/);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.stateId, { idMaps: JSON.stringify({ assessmentRecords: {}, academicSessions: { [f.sessionId]: f.targetSessionId } }) });
    await ctx.db.insert("sessionScoringRegradeJobs", { schoolId: f.target, sessionId: f.targetSessionId, phase: "ready",
      policy, before: policy, expectedVersion: 0, scanned: 0, batchSize: 40, invalidCount: 0, invalidExamples: [],
      updated: 0, startedAt: 1, updatedAt: 1, updatedBy: f.userId });
  });
  await expect(f.t.mutation(split.duplicateBatch, { stateId: f.stateId })).rejects.toThrow(/regrade is in progress/);
  expect(await f.t.run(ctx => ctx.db.query("assessmentRecords").withIndex("by_school", q => q.eq("schoolId", f.target)).collect())).toEqual([]);
});

it("reports a locked session as an integrity anomaly without aborting other diagnostics", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.insert("sessionScoringRegradeJobs", { schoolId: f.source, sessionId: f.sessionId, phase: "ready",
    policy, before: policy, expectedVersion: 0, scanned: 0, batchSize: 40, invalidCount: 0, invalidExamples: [],
    updated: 0, startedAt: 1, updatedAt: 1, updatedBy: f.userId }));
  const result = await f.t.query(split.runSplitIntegrityCheck, {});
  expect(result.passed).toBe(false);
  expect(result.anomalies).toContain(`Assessment ${f.recordId} belongs to locked scoring session ${f.sessionId}`);
  expect(result.anomalies?.length).toBeGreaterThan(1);
});
