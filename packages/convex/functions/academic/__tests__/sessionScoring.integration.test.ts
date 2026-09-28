import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const endpoint = api.functions.academic.sessionScoring;
const policy = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50 };
const legacy = { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 };
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

async function scan(f: Awaited<ReturnType<typeof fixture>>) {
  await f.viewer.mutation(endpoint.startSessionScoringScan, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "school", status: "active", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { name: "Owner", email: "owner@school.test", authTokenIdentifier: "test|owner", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId, personId, authId: "owner", authTokenIdentifier: "test|owner", name: "Owner", email: "owner@school.test", role: "admin", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: userId, isDefaultBranch: true, status: "active", joinedAt: 1, updatedAt: 1 });
    await ctx.db.insert("gradingBands", { schoolId, minScore: 0, maxScore: 100,
      gradeLetter: "A", remark: "Good", isActive: true, createdAt: 1, updatedAt: 1, updatedBy: userId });
    const first = await ctx.db.insert("academicSessions", { schoolId, name: "First", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const second = await ctx.db.insert("academicSessions", { schoolId, name: "Second", startDate: 3, endDate: 4, isActive: false, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId: first, name: "Term", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Class", level: "Primary", isArchived: false, createdAt: 1, updatedAt: 1 });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "M", isArchived: false, createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId, userId, classId, admissionNumber: "123", isArchived: false, createdAt: 1, updatedAt: 1 });
    const insert = (sessionId: typeof first, ca3: number) => ctx.db.insert("assessmentRecords", {
      schoolId, sessionId, termId, classId, subjectId, studentId, ca1: 10, ca2: 10, ca3,
      examRawScore: 30, examScaledScore: 30, total: 60 + ca3, gradeLetter: "B", remark: "Good",
      examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft" as const,
      enteredBy: userId, updatedBy: userId, createdAt: 1, updatedAt: 1,
    });
    const recordId = await insert(first, 15);
    const otherRecordId = await insert(second, 5);
    return { schoolId, userId, first, second, termId, classId, subjectId, studentId, recordId, otherRecordId };
  });
  return { t, viewer: t.withIdentity({ subject: "owner", issuer: "test", tokenIdentifier: "test|owner" }), ...ids };
}

it("uses the selected non-default branch for policy queries, scan and apply without exposing other schools", async () => {
  const f = await fixture();
  const selector = api.functions.academic.adminSelectors.getAdminSessions;
  expect(await f.viewer.query(selector, {})).toEqual([
    { id: f.second, name: "Second" }, { id: f.first, name: "First" },
  ]);
  const branch = await f.t.run(async ctx => {
    const owner = await ctx.db.get(f.userId);
    if (!owner?.personId) throw new Error("Missing owner");
    const schoolId = await ctx.db.insert("schools", { name: "Branch", slug: "branch", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId, personId: owner.personId, authId: "owner",
      authTokenIdentifier: "test|owner", name: "Owner", email: "owner@school.test", role: "admin", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { schoolId, personId: owner.personId, legacyUserId: userId,
      isDefaultBranch: false, status: "active", joinedAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Branch session",
      startDate: 5, endDate: 6, isActive: true, createdAt: 1, updatedAt: 1 });
    const foreignSchoolId = await ctx.db.insert("schools", { name: "Foreign", slug: "foreign", status: "active", createdAt: 1, updatedAt: 1 });
    const foreignSessionId = await ctx.db.insert("academicSessions", { schoolId: foreignSchoolId,
      name: "Foreign session", startDate: 7, endDate: 8, isActive: true, createdAt: 1, updatedAt: 1 });
    return { schoolId, sessionId, foreignSchoolId, foreignSessionId };
  });
  expect(await f.viewer.query(selector, { schoolId: branch.schoolId })).toEqual([
    { id: branch.sessionId, name: "Branch Session" },
  ]);
  await expect(f.viewer.query(selector, { schoolId: branch.foreignSchoolId })).rejects.toThrow();
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).policy).toEqual(legacy);
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: branch.sessionId })).policy).toEqual(legacy);
  expect((await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: branch.sessionId, policy })).phase).toBe("not_started");
  await f.viewer.mutation(endpoint.startSessionScoringScan, { sessionId: branch.sessionId,
    policy, expectedVersion: 0, expectedPolicy: legacy });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: branch.sessionId }))
    .toMatchObject({ phase: "ready", scanned: 0 });
  await f.viewer.mutation(endpoint.applySessionScoringChange, { sessionId: branch.sessionId,
    policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: branch.sessionId })).version).toBe(1);
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).version).toBe(0);
  await expect(f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: branch.foreignSessionId })).rejects.toThrow();
  await expect(f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: branch.foreignSessionId, policy })).rejects.toThrow();
  await expect(f.viewer.mutation(endpoint.startSessionScoringScan, { sessionId: branch.foreignSessionId,
    policy, expectedVersion: 0, expectedPolicy: legacy })).rejects.toThrow();
  await expect(f.viewer.mutation(endpoint.applySessionScoringChange, { sessionId: branch.foreignSessionId,
    policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true })).rejects.toThrow();
});

it("rejects over-limit scores atomically and leaves another session alone", async () => {
  const f = await fixture();
  await scan(f);
  const preview = await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: f.first, policy });
  expect(preview.current.policy).toEqual(legacy);
  expect(preview.canApply).toBe(false);
  expect(preview.invalidExamples[0]).toMatchObject({ recordId: f.recordId, classId: f.classId,
    subjectId: f.subjectId, field: "ca3" });
  await expect(f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  })).rejects.toThrow(/Raw scores exceed/);
  await f.viewer.mutation(endpoint.cancelSessionScoringScan, { sessionId: f.first });
  await f.t.run(ctx => ctx.db.patch(f.recordId, { ca3: 8 }));
  await scan(f);
  const result = await f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  });
  expect(result).toMatchObject({ phase: "regrading", updated: 0 });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "complete", updated: 1 });
  const rows = await f.t.run(async ctx => ({ first: await ctx.db.get(f.recordId), other: await ctx.db.get(f.otherRecordId),
    events: await ctx.db.query("sessionScoringPolicyEvents").withIndex("by_school_and_sessionId", q => q.eq("schoolId", f.schoolId).eq("sessionId", f.first)).collect() }));
  expect(rows.first).toMatchObject({ total: 46.75, examScaledScore: 18.75, sessionScoringPolicyVersion: 1, examRawMaxSnapshot: 80, examInputModeSnapshot: "custom" });
  expect(rows.other).toMatchObject({ total: 65, examRawMaxSnapshot: 40 });
  expect(rows.events).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).collect()))
    .toEqual(expect.arrayContaining([expect.objectContaining({ action: "session_scoring.regrade_completed", outcome: "success" })]));
  const write = await f.viewer.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, {
    sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId,
    records: [{ studentId: f.studentId, ca1: 10, ca2: 10, ca3: 8, examRawScore: 50 }],
  });
  expect(write).toMatchObject({ updated: 1, errors: [] });
  expect(await f.t.run(ctx => ctx.db.get(f.recordId))).toMatchObject({
    examRawMaxSnapshot: 80, examInputModeSnapshot: "custom", sessionScoringPolicyVersion: 1,
    examScaledScore: 31.25, total: 59.25,
  });
  await expect(f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 1, expectedPolicy: legacy, confirmRegrade: true,
  })).rejects.toThrow(/Policy changed/);
  await expect(f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  })).rejects.toThrow(/Policy changed/);
});

it("scans and regrades more than 100 rows in bounded batches", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.recordId, { ca3: 5 });
    for (let i = 0; i < 100; i++) {
      await ctx.db.insert("assessmentRecords", {
        schoolId: f.schoolId, sessionId: f.first, termId: f.termId, classId: f.classId,
        subjectId: f.subjectId, studentId: f.studentId, ca1: 10, ca2: 10, ca3: 5,
        examRawScore: 30, examScaledScore: 30, total: 55, gradeLetter: "B", remark: "Good",
        examInputModeSnapshot: i === 99 ? "raw60_scaled_to_40" : "raw40",
        examRawMaxSnapshot: i === 99 ? 60 : 40, status: "draft",
        enteredBy: f.userId, updatedBy: f.userId, createdAt: 1, updatedAt: 1,
      });
    }
  });
  await scan(f);
  const preview = await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: f.first, policy });
  expect(preview).toMatchObject({ phase: "ready", canApply: true, count: 101,
    invalidCount: 0, mixedLegacyCount: 1, mixedLegacyExamples: [{ snapshot: { examRawMax: 60 } }] });
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.second })).version).toBe(0);
  expect(await f.t.run(ctx => ctx.db.get(f.otherRecordId))).toMatchObject({ total: 65 });
  await expect(f.viewer.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, {
    sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId, records: [],
  })).rejects.toThrow(/regrade is in progress/);
  await f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "complete", scanned: 101, updated: 101 });
  expect(await f.t.run(ctx => ctx.db.get(f.recordId))).toMatchObject({ total: 43.75, examRawMaxSnapshot: 80 });
  const events = await f.t.run(ctx => ctx.db.query("sessionScoringPolicyEvents")
    .withIndex("by_school_and_sessionId", q => q.eq("schoolId", f.schoolId).eq("sessionId", f.first)).collect());
  expect(events).toMatchObject([{ version: 1, affectedRecords: 101 }]);
  expect((await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: f.first, policy })).current.version).toBe(1);
});

it("counts invalid scores beyond the first batch and bounds examples", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.recordId, { ca3: 5 });
    for (let i = 0; i < 110; i++) {
      await ctx.db.insert("assessmentRecords", {
        schoolId: f.schoolId, sessionId: f.first, termId: f.termId, classId: f.classId,
        subjectId: f.subjectId, studentId: f.studentId, ca1: 10, ca2: 10, ca3: 25,
        examRawScore: 30, examScaledScore: 30, total: 75, gradeLetter: "B", remark: "Good",
        examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft",
        enteredBy: f.userId, updatedBy: f.userId, createdAt: 1, updatedAt: 1,
      });
    }
  });
  await scan(f);
  const preview = await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: f.first, policy });
  expect(preview).toMatchObject({ count: 111, invalidCount: 110, invalidCountIsPartial: false,
    canApply: false, phase: "invalid" });
  expect(preview.invalidExamples).toHaveLength(10);
});

it("keeps a failed batch blocked, rolls it back, and resumes without double-counting", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    await ctx.db.patch(f.recordId, { ca3: 5 });
    for (let i = 0; i < 85; i++) await ctx.db.insert("assessmentRecords", {
      schoolId: f.schoolId, sessionId: f.first, termId: f.termId, classId: f.classId,
      subjectId: f.subjectId, studentId: f.studentId, ca1: 10, ca2: 10, ca3: 5,
      examRawScore: 30, examScaledScore: 30, total: 55, gradeLetter: "B", remark: "Good",
      examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft",
      enteredBy: f.userId, updatedBy: f.userId, createdAt: 1, updatedAt: 1,
    });
  });
  await scan(f);
  await f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  });
  const job = await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first });
  if (!job) throw new Error("Missing job");
  await f.t.mutation(internal.functions.academic.sessionScoring.processSessionScoringBatch, { jobId: job._id });
  const laterRecord = await f.t.run(async ctx => (await ctx.db.query("assessmentRecords")
    .withIndex("by_sheet", q => q.eq("schoolId", f.schoolId).eq("sessionId", f.first))
    .take(50))[45]);
  // Simulate corruption in the next batch; the first 40 row patches must stay durable.
  await f.t.run(ctx => ctx.db.patch(laterRecord._id, { ca3: 99 }));
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "failed_regrading", updated: 40, failureReason: expect.stringMatching(/Invalid score/) });
  expect(await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).collect()))
    .toEqual(expect.arrayContaining([expect.objectContaining({ action: "session_scoring.regrade_failed", outcome: "failed" })]));
  expect(await f.t.run(ctx => ctx.db.get(laterRecord._id))).toMatchObject({ ca3: 99, total: 55, examRawMaxSnapshot: 40 });
  await expect(f.viewer.query(api.functions.academic.assessmentRecords.getExamEntrySheet, {
    sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId,
  })).rejects.toThrow(/regrade is in progress/);
  await expect(f.viewer.query(api.functions.academic.reportCards.getStudentReportCard, {
    sessionId: f.first, termId: f.termId, classId: f.classId, studentId: f.studentId,
  })).rejects.toThrow(/regrade is in progress/);
  await f.t.run(ctx => ctx.db.patch(laterRecord._id, { ca3: 5 }));
  await f.viewer.mutation(endpoint.resumeSessionScoringJob, { sessionId: f.first });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "complete", updated: 86 });
  expect(await f.t.run(ctx => ctx.db.get(f.otherRecordId))).toMatchObject({ total: 65 });
});

it("uses the recorded legacy exam maximum after school settings change", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.insert("schoolAssessmentSettings", {
    schoolId: f.schoolId, examInputMode: "raw60_scaled_to_40", ca1Max: 20, ca2Max: 20,
    ca3Max: 20, examContributionMax: 40, isActive: true, createdAt: 2, updatedAt: 2, updatedBy: f.userId,
  }));
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).policy).toEqual(legacy);
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.second })).policy).toEqual(legacy);
});

it("keeps custom legacy weights across successive manual edits and resolves them for new rows", async () => {
  const f = await fixture();
  const custom = { ca1Max: 50, ca2Max: 0, ca3Max: 0, examRawMax: 80, examContributionMax: 50 };
  await f.t.run(ctx => ctx.db.patch(f.recordId, {
    ca1: 10, ca2: 0, ca3: 0, examRawScore: 40, examScaledScore: 25, total: 35,
    examRawMaxSnapshot: 80, examInputModeSnapshot: "custom",
    assessmentPolicySnapshot: { ...custom, source: "branch_legacy", mode: "legacy",
      groupVersion: 0, revision: 1, examInputMode: "custom" },
    gradingPolicySnapshot: { version: 1, bands: [] },
  }));
  const args = { sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId };
  const save = (examRawScore: number) => f.viewer.mutation(
    api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk,
    { ...args, records: [{ studentId: f.studentId, ca1: 20, ca2: 0, ca3: 0, examRawScore }] },
  );
  expect(await save(50)).toMatchObject({ updated: 1, errors: [] });
  const first = await f.t.run(ctx => ctx.db.get(f.recordId));
  expect(first).toMatchObject({ total: 51.25, examScaledScore: 31.25,
    examInputModeSnapshot: "custom", assessmentPolicySnapshot: custom });
  expect(first?.assessmentPolicySnapshot).toEqual(custom);
  expect(first?.gradingPolicySnapshot).toBeUndefined();
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).policy).toEqual(custom);
  expect(await save(80)).toMatchObject({ updated: 1, errors: [] });
  expect(await f.t.run(ctx => ctx.db.get(f.recordId))).toMatchObject({ total: 70,
    examScaledScore: 50, assessmentPolicySnapshot: custom });
  const studentId = await f.t.run(ctx => ctx.db.insert("students", { schoolId: f.schoolId,
    userId: f.userId, classId: f.classId, admissionNumber: "124", isArchived: false, createdAt: 2, updatedAt: 2 }));
  expect(await f.viewer.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, {
    ...args, records: [{ studentId, ca1: 20, ca2: 0, ca3: 0, examRawScore: 80 }],
  })).toMatchObject({ created: 1, errors: [] });
  const inserted = await f.t.run(ctx => ctx.db.query("assessmentRecords")
    .withIndex("by_student_sheet", q => q.eq("schoolId", f.schoolId).eq("sessionId", f.first)
      .eq("termId", f.termId).eq("classId", f.classId).eq("subjectId", f.subjectId).eq("studentId", studentId)).unique());
  expect(inserted).toMatchObject({ examInputModeSnapshot: "custom", examRawMaxSnapshot: 80,
    assessmentPolicySnapshot: custom, examScaledScore: 50, total: 70 });
});

it("records custom mode for a legacy raw-50 policy", async () => {
  const f = await fixture();
  const custom = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 50, examContributionMax: 50 };
  await f.t.run(ctx => ctx.db.patch(f.recordId, { ca3: 5, examRawMaxSnapshot: 50,
    assessmentPolicySnapshot: custom }));
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).policy).toEqual(custom);
  expect(await f.viewer.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, {
    sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId,
    records: [{ studentId: f.studentId, ca1: 10, ca2: 10, ca3: 5, examRawScore: 50 }],
  })).toMatchObject({ updated: 1, errors: [] });
  expect(await f.t.run(ctx => ctx.db.get(f.recordId))).toMatchObject({
    examInputModeSnapshot: "custom", assessmentPolicySnapshot: custom, total: 75,
  });
});

it("keeps mixed legacy rows readable and reconciles only after an explicit full scan", async () => {
  const f = await fixture();
  const mixedId = await f.t.run(async ctx => {
    await ctx.db.patch(f.recordId, { ca3: 5 });
    const row = await ctx.db.get(f.recordId);
    if (!row) throw new Error("Missing row");
    const { _id, _creationTime, ...fields } = row;
    return ctx.db.insert("assessmentRecords", { ...fields, examScaledScore: 20, total: 45,
      createdAt: 2, updatedAt: 2, examRawMaxSnapshot: 60, examInputModeSnapshot: "raw60_scaled_to_40" });
  });
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).policy).toEqual(legacy);
  const sheet = await f.viewer.query(api.functions.academic.assessmentRecords.getExamEntrySheet, {
    sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId,
  });
  expect(sheet).toBeDefined();
  await f.t.run(ctx => ctx.db.insert("classSubjects", { schoolId: f.schoolId,
    classId: f.classId, subjectId: f.subjectId, createdAt: 1, updatedAt: 1 }));
  const report = await f.viewer.query(api.functions.academic.reportCards.getStudentReportCard, {
    sessionId: f.first, termId: f.termId, classId: f.classId, studentId: f.studentId,
  });
  expect(report).toBeDefined();
  expect(await f.viewer.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, {
    sessionId: f.first, termId: f.termId, classId: f.classId, subjectId: f.subjectId,
    records: [{ studentId: f.studentId, ca1: 10, ca2: 10, ca3: 5, examRawScore: 45 }],
  })).toMatchObject({ updated: 1, errors: [] });
  expect(await f.t.run(ctx => ctx.db.get(mixedId))).toMatchObject({ total: 55, examRawMaxSnapshot: 60 });
  await scan(f);
  const preview = await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: f.first, policy });
  expect(preview).toMatchObject({ phase: "ready", canApply: true, count: 2,
    mixedLegacyCount: 1, mixedLegacyExamples: [{ recordId: mixedId, classId: f.classId,
      subjectId: f.subjectId, snapshot: { examRawMax: 60 } }] });
  expect(await f.t.run(ctx => ctx.db.get(mixedId))).toMatchObject({ total: 55, examRawMaxSnapshot: 60 });
  await f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run(ctx => ctx.db.get(mixedId))).toMatchObject({ total: 53.13,
    examRawMaxSnapshot: 80, sessionScoringPolicyVersion: 1 });
  expect(await f.t.run(ctx => ctx.db.get(f.otherRecordId))).toMatchObject({ examRawMaxSnapshot: 40 });
});

it("lets admins cancel a scan or resume a regrade after group override permission is removed", async () => {
  const f = await fixture();
  const groupId = await f.t.run(async ctx => {
    const owner = await ctx.db.get(f.userId);
    if (!owner?.personId) throw new Error("Missing owner");
    const groupId = await ctx.db.insert("schoolGroups", { name: "Group", slug: "group",
      proprietorPersonId: owner.personId, status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("schoolGroupBranches", { groupId, schoolId: f.schoolId,
      isHeadquarters: false, linkedAt: 1 });
    await ctx.db.insert("branchSettingOverrides", { groupId, schoolId: f.schoolId,
      domain: "academic_policy", mode: "inherit", revision: 1, groupVersion: 1,
      createdAt: 1, createdBy: owner.personId });
    await ctx.db.insert("groupSettingVersions", { groupId, domain: "academic_policy",
      version: 1, allowBranchOverride: true, value: { examInputMode: "raw40" },
      createdAt: 1, createdBy: owner.personId });
    return groupId;
  });
  const setPermission = (version: number, allowBranchOverride: boolean) => f.t.run(async ctx => {
    const owner = await ctx.db.get(f.userId);
    if (!owner?.personId) throw new Error("Missing owner");
    await ctx.db.insert("groupSettingVersions", { groupId, domain: "academic_policy",
      version, allowBranchOverride, value: { examInputMode: "raw40" },
      createdAt: version, createdBy: owner.personId });
  });
  await f.viewer.mutation(endpoint.startSessionScoringScan, { sessionId: f.first,
    policy, expectedVersion: 0, expectedPolicy: legacy });
  await setPermission(2, false);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "scanning" });
  await f.viewer.mutation(endpoint.cancelSessionScoringScan, { sessionId: f.first });
  await expect(f.viewer.mutation(endpoint.startSessionScoringScan, { sessionId: f.first,
    policy, expectedVersion: 0, expectedPolicy: legacy })).rejects.toThrow(/does not allow branch overrides/);
  // A regrade started under the old permission must still be recoverable.
  await f.t.run(async ctx => {
    const owner = await ctx.db.get(f.userId);
    if (!owner?.personId) throw new Error("Missing owner");
    const link = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).unique();
    if (!link) throw new Error("Missing group");
    await ctx.db.insert("groupSettingVersions", { groupId: link.groupId, domain: "academic_policy",
      version: 3, allowBranchOverride: true, value: { examInputMode: "raw40" }, createdAt: 3, createdBy: owner.personId });
    await ctx.db.patch(f.recordId, { ca3: 5 });
  });
  await scan(f);
  await f.viewer.mutation(endpoint.applySessionScoringChange, { sessionId: f.first,
    policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true });
  await setPermission(4, false);
  await f.viewer.mutation(endpoint.resumeSessionScoringJob, { sessionId: f.first });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "complete" });
});

it("completes a zero-row scan and regrade without claiming to update scores", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.delete(f.recordId));
  await scan(f);
  expect(await f.viewer.query(endpoint.previewSessionScoringChange, { sessionId: f.first, policy }))
    .toMatchObject({ phase: "ready", count: 0, canApply: true });
  await f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "complete", scanned: 0, updated: 0 });
});

it("does not report a zero-row regrade complete if a record appeared after its scan", async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.delete(f.recordId));
  await scan(f);
  await f.viewer.mutation(endpoint.applySessionScoringChange, {
    sessionId: f.first, policy, expectedVersion: 0, expectedPolicy: legacy, confirmRegrade: true,
  });
  await f.t.run(async ctx => {
    const other = await ctx.db.get(f.otherRecordId);
    if (!other) throw new Error("Missing row");
    const { _id, _creationTime, ...fields } = other;
    await ctx.db.insert("assessmentRecords", { ...fields, sessionId: f.first });
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.viewer.query(endpoint.getSessionScoringJob, { sessionId: f.first }))
    .toMatchObject({ phase: "failed_regrading", scanned: 0, updated: 0 });
  expect((await f.viewer.query(endpoint.getSessionScoringPolicy, { sessionId: f.first })).version).toBe(0);
});

it("lists other archived sessions while one session has an invalid scoring scan", async () => {
  const f = await fixture();
  await scan(f);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.first, { isArchived: true, archivedAt: 3 });
    await ctx.db.patch(f.second, { isArchived: true, archivedAt: 3 });
  });
  const archive = await f.viewer.query(api.functions.academic.archiveRecords.listArchivedRecords, {});
  const first = archive.records.find(row => row.recordId === f.first);
  const second = archive.records.find(row => row.recordId === f.second);
  expect(first?.linkedHistory).toMatch(/Assessment count unavailable/);
  expect(first?.detailFields).toContainEqual({ label: "Assessment records", value: "Unavailable during scoring job" });
  expect(second?.detailFields).toContainEqual({ label: "Assessment records", value: "1" });
});

it("denies a cross-school session before reading scores", async () => {
  const f = await fixture();
  const foreignSession = await f.t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Foreign", slug: "foreign", status: "active", createdAt: 1, updatedAt: 1 });
    return ctx.db.insert("academicSessions", { schoolId, name: "Foreign", startDate: 1, endDate: 2,
      isActive: true, createdAt: 1, updatedAt: 1 });
  });
  await expect(f.viewer.query(endpoint.previewSessionScoringChange, {
    sessionId: foreignSession, policy,
  })).rejects.toThrow();
});
