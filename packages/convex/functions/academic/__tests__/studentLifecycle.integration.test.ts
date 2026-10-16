import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import { scoreRowBaseline } from "@school/shared/drafts/scoreRowBaseline";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob("../../../**/*.ts")).map(([path, module]) =>
  [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const enrollment = api.functions.academic.studentEnrollment;
const platform = api.functions.platform.index;
const identity = { subject: "lifecycle-admin", tokenIdentifier: "test|lifecycle-admin" };
const platformIdentity = { subject: "lifecycle-platform", tokenIdentifier: "test|lifecycle-platform" };
const NOW = Date.parse("2026-10-11T12:30:00Z");

async function fixture(initialized = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Lifecycle", slug: "lifecycle", status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-lifecycle", status: "active", createdAt: 1, updatedAt: 1 });
    const adminId = await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Admin", email: "admin@test.invalid", role: "admin", isSchoolAdmin: true, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("platformAdmins", { authId: platformIdentity.subject, authTokenIdentifier: platformIdentity.tokenIdentifier, name: "Platform", email: "platform@test.invalid", isActive: true, createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { authTokenIdentifier: "test|lifecycle-student", name: "Student", email: "student@test.invalid", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId, personId, authId: "student-auth", authTokenIdentifier: "test|lifecycle-student", name: "Student", email: "student@test.invalid", role: "student", createdAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "Primary", createdAt: 1, updatedAt: 1 });
    const nextClassId = await ctx.db.insert("classes", { schoolId, name: "Primary 2", level: "Primary", createdAt: 1, updatedAt: 1 });
    const foreignClassId = await ctx.db.insert("classes", { schoolId: otherSchoolId, name: "Other class", level: "Primary", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/2027", startDate: Date.parse("2026-09-01"), endDate: Date.parse("2027-07-31"), isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: Date.parse("2026-09-01"), endDate: Date.parse("2026-12-31"), isActive: true, createdAt: 1, updatedAt: 1 });
    const futureSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2027/2028", startDate: Date.parse("2027-09-01"), endDate: Date.parse("2028-07-31"), isActive: false, createdAt: 1, updatedAt: 1 });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "MAT", createdAt: 1, updatedAt: 1 });
    for (const selectedClassId of [classId, nextClassId]) await ctx.db.insert("classSubjects", { schoolId, classId: selectedClassId, subjectId, createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId, admissionNumber: "LIFE-1", guardianEmail: "guardian@test.invalid", customAttributes: { custom: "retain" }, unmappedData: { unknown: "retain" }, photoProvenance: "application_upload", photoRetentionHold: true, createdAt: 1, updatedAt: 1 });
    if (initialized) await ctx.db.insert("schoolEnrollmentCounts", { schoolId, currentStudentCount: 1, updatedAt: 1 });
    return { schoolId, otherSchoolId, adminId, personId, userId, classId, nextClassId, foreignClassId, sessionId, futureSessionId, termId, subjectId, studentId };
  });
  const admin = t.withIdentity(identity);
  const platformAdmin = t.withIdentity(platformIdentity);
  const read = () => t.run(async ctx => ({
    student: await ctx.db.get(ids.studentId), account: await ctx.db.get(ids.userId),
    events: await ctx.db.query("studentEnrollmentEvents").withIndex("by_student_revision", q => q.eq("studentId", ids.studentId)).collect(),
    periods: await ctx.db.query("studentEnrollmentPeriods").withIndex("by_student", q => q.eq("studentId", ids.studentId)).collect(),
    count: await ctx.db.query("schoolEnrollmentCounts").withIndex("by_school", q => q.eq("schoolId", ids.schoolId)).unique(),
    snapshot: (await ctx.db.query("students").withIndex("by_school", q => q.eq("schoolId", ids.schoolId)).collect()).filter(s => !s.isArchived && (s.enrollmentStatus ?? "active") === "active").length,
  }));
  const depart = (action: "withdraw" | "suspend" = "withdraw", revision = 0, key: string = action) => admin.mutation(enrollment.transitionStudentEnrollment, {
    studentId: ids.studentId, action, expectedRevision: revision, operationKey: key, reason: "Reviewed departure", effectiveDay: revision === 0 ? "2026-10-01" : "2026-10-11",
  });
  const placement = { confirmed: true, classId: ids.nextClassId, subjectIds: [ids.subjectId] };
  return { t, ids, admin, platformAdmin, read, depart, placement };
}

async function assessmentFixture() {
  const f = await fixture();
  const recordId = await f.t.run(async ctx => {
    await ctx.db.insert("gradingBands", { schoolId: f.ids.schoolId, minScore: 0, maxScore: 100, gradeLetter: "A", remark: "Pass", isActive: true, version: 1, createdAt: 1, updatedAt: 1, updatedBy: f.ids.adminId });
    await ctx.db.patch(f.ids.termId, { isActive: false, endDate: Date.parse("2026-09-30") });
    return ctx.db.insert("assessmentRecords", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId, subjectId: f.ids.subjectId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 40, examScaledScore: 40, total: 70, gradeLetter: "A", remark: "Pass", examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft", enteredBy: f.ids.adminId, updatedBy: f.ids.adminId, createdAt: 1, updatedAt: 1 });
  });
  const tuple = { classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId, subjectId: f.ids.subjectId };
  const scores = { studentId: f.ids.studentId, ca1: 11, ca2: 10, ca3: 10, examRawScore: 40 };
  return { ...f, recordId, tuple, scores };
}

beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); });

describe("student lifecycle and registered headcounts", () => {
  it.each(["withdraw", "suspend"] as const)("closes %s periods, returns on the same identity, and gives old retries zero writes", async action => {
    const f = await fixture();
    const request = { studentId: f.ids.studentId, action, expectedRevision: 0, operationKey: "leave-1", reason: "Reviewed departure", effectiveDay: "2026-10-01" };
    const first = await f.admin.mutation(enrollment.transitionStudentEnrollment, request);
    expect((await f.read()).count?.currentStudentCount).toBe(0);
    const returned = await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: action === "withdraw" ? "re_enrol" : "reinstate", expectedRevision: 1, operationKey: "return-1", reason: "Placement reviewed", placement: f.placement });
    expect(returned).toMatchObject({ revision: 2, status: "active" });
    const state = await f.read();
    expect(state.student).toMatchObject({ userId: f.ids.userId, classId: f.ids.nextClassId, enrollmentRevision: 2 });
    expect(state.periods).toHaveLength(2);
    expect(state.periods[0]).toMatchObject({ startProvenance: "legacy_unknown", endDay: "2026-10-01" });
    expect(state.periods[0].startDay).toBeUndefined();
    expect(state.periods[1]).toMatchObject({ startDay: "2026-10-11", classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.termId });
    expect(state.events[1]).toMatchObject({ effectiveDay: "2026-10-11", recordedAt: NOW, actorUserId: f.ids.adminId });
    expect(state.count?.currentStudentCount).toBe(state.snapshot);
    const classes = await f.admin.query(api.functions.academic.academicSetup.listClasses, {});
    expect(classes.find(row => row._id === f.ids.classId)?.studentCount).toBe(0);
    expect(classes.find(row => row._id === f.ids.nextClassId)?.studentCount).toBe(1);
    const matrix = await f.admin.query(enrollment.getClassStudentSubjectMatrix, { classId: f.ids.nextClassId, sessionId: f.ids.sessionId });
    expect(matrix.students).toContainEqual(expect.objectContaining({ _id: f.ids.studentId, enrollmentStatus: "active", enrollmentRevision: 2 }));
    const reportRoster = await f.admin.query(api.functions.academic.reportCards.getStudentsForReportCardBatch, { classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.termId });
    expect(reportRoster.map(row => row.studentId)).toContain(f.ids.studentId);
    expect(await f.admin.mutation(enrollment.transitionStudentEnrollment, request)).toEqual(first);
    expect(await f.read()).toEqual(state);
    expect(await f.platformAdmin.mutation(platform.recalculateSchoolEnrollmentCount, { schoolId: f.ids.schoolId })).toEqual({ currentStudentCount: 1 });
    const secondLeave = await f.depart("withdraw", 2, "leave-2");
    expect(secondLeave).toMatchObject({ revision: 3 });
    await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "re_enrol", expectedRevision: 3, operationKey: "return-2", reason: "Second return", placement: f.placement });
    expect((await f.read()).periods).toHaveLength(3);
  });

  it("finds inactive enrollment across empty bounded school pages without a new status index", async () => {
    const f = await fixture();
    const targetId = await f.t.run(async ctx => {
      await ctx.db.insert("students", { schoolId: f.ids.otherSchoolId, classId: f.ids.foreignClassId, userId: f.ids.userId, admissionNumber: "FOREIGN", enrollmentStatus: "withdrawn", createdAt: 2, updatedAt: 2 });
      return ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId, userId: f.ids.userId, admissionNumber: "INACTIVE", enrollmentStatus: "withdrawn", enrollmentRevision: 1, createdAt: 3, updatedAt: 3 });
    });
    const first = await f.admin.query(enrollment.listStudentEnrollmentDirectory, { status: "withdrawn", paginationOpts: { numItems: 1, cursor: null } });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await f.admin.query(enrollment.listStudentEnrollmentDirectory, { status: "withdrawn", paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(second.page.map(row => row.studentId)).toEqual([targetId]);
    expect(second.isDone).toBe(true);
  });

  it("serializes competing revision-zero departures into one event and count delta", async () => {
    const f = await fixture();
    const outcomes = await Promise.allSettled([f.depart("withdraw", 0, "competing-withdraw"), f.depart("suspend", 0, "competing-suspend")]);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    const state = await f.read();
    expect(state.events).toHaveLength(1);
    expect(state.periods).toHaveLength(1);
    expect(state.count?.currentStudentCount).toBe(state.snapshot);
    expect(state.count?.currentStudentCount).toBe(0);
  });

  it("requires current session setup for return without inventing missing departure context", async () => {
    const f = await fixture();
    await f.t.run(async ctx => { await ctx.db.patch(f.ids.sessionId, { isActive: false }); await ctx.db.patch(f.ids.termId, { isActive: false }); });
    await f.depart();
    const before = await f.read();
    expect(before.events[0].sessionId).toBeUndefined();
    expect(before.events[0].termId).toBeUndefined();
    await expect(f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "re_enrol", expectedRevision: 1, operationKey: "setup-return", reason: "Return", placement: f.placement })).rejects.toThrow("Set up");
    expect(await f.read()).toEqual(before);
  });

  it("rejects an old promotion cancellation after departure and return placement review", async () => {
    const f = await fixture();
    await expect(f.admin.mutation(enrollment.promoteStudents, { studentIds: [f.ids.studentId], fromClassId: f.ids.nextClassId, toClassId: f.ids.classId, fromSessionId: f.ids.sessionId, toSessionId: f.ids.futureSessionId, subjectEnrollmentMode: "none" })).rejects.toThrow("source promotion placement");
    await f.admin.mutation(enrollment.promoteStudents, { studentIds: [f.ids.studentId], fromClassId: f.ids.classId, toClassId: f.ids.nextClassId, fromSessionId: f.ids.sessionId, toSessionId: f.ids.futureSessionId, subjectEnrollmentMode: "none" });
    await f.depart("suspend", 1);
    await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "reinstate", expectedRevision: 2, operationKey: "reviewed-placement", reason: "Return", placement: f.placement });
    const state = await f.read();
    await expect(f.admin.mutation(enrollment.cancelStudentPromotion, { studentId: f.ids.studentId, fromSessionId: f.ids.sessionId })).rejects.toThrow("changed after");
    expect(await f.read()).toEqual(state);
  });

  it("withdraws a suspended student without a second count decrement or invented period", async () => {
    const f = await fixture();
    await f.depart("suspend");
    await f.depart("withdraw", 1, "withdraw-after-suspension");
    const state = await f.read();
    expect(state.periods).toHaveLength(1);
    expect(state.count?.currentStudentCount).toBe(0);
    expect(state.events.map(event => event.type)).toEqual(["suspend", "withdraw"]);
  });

  it("rejects stale revisions, changed key payloads and unreviewed or foreign return placement atomically", async () => {
    const f = await fixture();
    await f.depart();
    const baseline = await f.read();
    await expect(f.depart("suspend", 0, "withdraw")).rejects.toThrow("different request");
    await expect(f.depart("withdraw", 0, "new-key")).rejects.toThrow("changed");
    const args = { studentId: f.ids.studentId, action: "re_enrol" as const, expectedRevision: 1, operationKey: "return", reason: "Return" };
    await expect(f.admin.mutation(enrollment.transitionStudentEnrollment, args)).rejects.toThrow("confirm");
    await expect(f.admin.mutation(enrollment.transitionStudentEnrollment, { ...args, placement: { ...f.placement, classId: f.ids.foreignClassId } })).rejects.toThrow("unavailable");
    await expect(f.admin.mutation(enrollment.transitionStudentEnrollment, { ...args, effectiveDay: "2026-09-30", placement: f.placement })).rejects.toThrow("precedes");
    expect(await f.read()).toEqual(baseline);
  });

  it.each(["2026-02-30", "2030-01-01", "not-a-date"])("rejects invalid or future effective day %s", async effectiveDay => {
    const f = await fixture();
    await expect(f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "withdraw", expectedRevision: 0, operationKey: "date", reason: "Leave", effectiveDay })).rejects.toThrow();
    expect((await f.read()).events).toEqual([]);
  });

  it.each(["graduated", "transferred_out"] as const)("does not locally re-enroll terminal %s records", async status => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.ids.studentId, { enrollmentStatus: status }));
    await expect(f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "re_enrol", expectedRevision: 0, operationKey: "bypass", reason: "Return", placement: f.placement })).rejects.toThrow("not allowed");
  });

  it("keeps inactive archive/restore inactive and active archive/restore count exact", async () => {
    const f = await fixture();
    await f.admin.mutation(enrollment.archiveStudent, { studentId: f.ids.studentId });
    expect((await f.read()).count?.currentStudentCount).toBe(0);
    expect((await f.read()).periods).toEqual([]);
    await expect(f.depart("withdraw", 1)).rejects.toThrow("Restore");
    await f.admin.mutation(enrollment.restoreStudent, { studentId: f.ids.studentId });
    expect((await f.read()).count?.currentStudentCount).toBe(1);
    await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "withdraw", expectedRevision: 2, operationKey: "backdated-after-restore", reason: "Historical departure reviewed", effectiveDay: "2026-10-01" });
    await f.admin.mutation(enrollment.archiveStudent, { studentId: f.ids.studentId });
    await f.admin.mutation(enrollment.restoreStudent, { studentId: f.ids.studentId });
    const state = await f.read();
    expect(state.student).toMatchObject({ enrollmentStatus: "withdrawn", isArchived: false });
    expect(state.count?.currentStudentCount).toBe(state.snapshot);
    expect(state.periods).toHaveLength(1);
  });

  it("leaves missing counters null and rolls back all evidence on initialized underflow", async () => {
    const f = await fixture(false);
    await f.depart();
    expect((await f.read()).count).toBeNull();
    expect((await f.platformAdmin.query(platform.listSchools, {})).find(s => s._id === f.ids.schoolId)?.currentStudentCount).toBeNull();
    const broken = await fixture();
    await broken.t.run(async ctx => {
      const count = await ctx.db.query("schoolEnrollmentCounts").withIndex("by_school", q => q.eq("schoolId", broken.ids.schoolId)).unique();
      if (!count) throw new Error("Missing count");
      await ctx.db.patch(count._id, { currentStudentCount: 0 });
    });
    const before = await broken.read();
    await expect(broken.depart()).rejects.toThrow("recalculation");
    expect(await broken.read()).toEqual(before);
  });

  it("preserves canonical identity and protected profile data and denies inactive class/subject changes", async () => {
    const f = await fixture();
    await f.depart();
    await f.admin.mutation(enrollment.updateStudent, { studentId: f.ids.studentId, name: "Corrected Student", guardianPhone: "123" });
    const state = await f.read();
    expect(state.account).toMatchObject({ personId: f.ids.personId, authId: "student-auth", authTokenIdentifier: "test|lifecycle-student" });
    expect(state.student).toMatchObject({ guardianEmail: "guardian@test.invalid", customAttributes: { custom: "retain" }, unmappedData: { unknown: "retain" }, photoProvenance: "application_upload", photoRetentionHold: true, enrollmentRevision: 1 });
    await expect(f.admin.mutation(enrollment.updateStudent, { studentId: f.ids.studentId, classId: f.ids.nextClassId })).rejects.toThrow("inactive");
    await expect(f.admin.mutation(enrollment.setStudentSubjectSelections, { studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, subjectIds: [f.ids.subjectId] })).rejects.toThrow("inactive");
    await expect(f.admin.mutation(enrollment.promoteStudents, { studentIds: [f.ids.studentId], fromClassId: f.ids.classId, toClassId: f.ids.nextClassId, fromSessionId: f.ids.sessionId, toSessionId: f.ids.futureSessionId, subjectEnrollmentMode: "none" })).rejects.toThrow("inactive");
    expect((await f.admin.query(enrollment.listStudentsByClass, { classId: f.ids.classId }))).toEqual([]);
    const directory = await f.admin.query(enrollment.listStudentEnrollmentDirectory, { status: "withdrawn", paginationOpts: { cursor: null, numItems: 20 } });
    expect(directory.page).toContainEqual(expect.objectContaining({ studentId: f.ids.studentId, revision: 1 }));
  });

  it("requires tenant authority and enrollment capability, including for old replay and history", async () => {
    const f = await fixture();
    const deniedIdentity = { subject: "denied", tokenIdentifier: "test|denied" };
    await f.t.run(ctx => seedReviewedTenantOperatorWithCapabilities(ctx, [f.ids.schoolId], deniedIdentity.tokenIdentifier, []));
    const denied = f.t.withIdentity(deniedIdentity);
    await expect(denied.mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "withdraw", expectedRevision: 0, operationKey: "forbidden", reason: "Leave" })).rejects.toThrow();
    await expect(denied.query(enrollment.getStudentEnrollmentHistory, { studentId: f.ids.studentId, paginationOpts: { cursor: null, numItems: 20 } })).rejects.toThrow();
    const foreignIdentity = { subject: "foreign", tokenIdentifier: "test|foreign" };
    await f.t.run(ctx => ctx.db.insert("users", { schoolId: f.ids.otherSchoolId, authId: foreignIdentity.subject, authTokenIdentifier: foreignIdentity.tokenIdentifier, name: "Foreign", email: "foreign@test.invalid", role: "admin", isSchoolAdmin: true, createdAt: 1, updatedAt: 1 }));
    await expect(f.t.withIdentity(foreignIdentity).mutation(enrollment.transitionStudentEnrollment, { studentId: f.ids.studentId, action: "withdraw", expectedRevision: 0, operationKey: "foreign", reason: "Leave" })).rejects.toThrow("not found");
    await expect(f.admin.mutation(platform.recalculateSchoolEnrollmentCount, { schoolId: f.ids.schoolId })).rejects.toThrow();
  });

  it("guards graduation correction and leaves old graduation replay unable to resurrect or re-graduate a returned student", async () => {
    const f = await fixture();
    const args = { studentIds: [f.ids.studentId], classId: f.ids.classId, sessionId: f.ids.sessionId, certificateNumber: "CERT-PRESERVE" };
    await f.admin.mutation(enrollment.graduateStudents, args);
    expect((await f.read()).count?.currentStudentCount).toBe(0);
    await expect(f.admin.mutation(enrollment.cancelStudentGraduation, { studentId: f.ids.studentId, sessionId: f.ids.futureSessionId })).rejects.toThrow("matching");
    await f.admin.mutation(enrollment.cancelStudentGraduation, { studentId: f.ids.studentId, sessionId: f.ids.sessionId });
    await f.admin.mutation(enrollment.graduateStudents, args);
    expect((await f.read()).student?.enrollmentStatus).toBe("active");
    await f.depart("withdraw", 2);
    const state = await f.read();
    await expect(f.admin.mutation(enrollment.cancelStudentGraduation, { studentId: f.ids.studentId, sessionId: f.ids.sessionId })).rejects.toThrow("matching");
    expect(await f.read()).toEqual(state);
    expect(state.events.map(e => e.type)).toEqual(["graduate", "graduation_corrected", "withdraw"]);
    expect(state.events[0].graduation?.certificateNumber).toBe("CERT-PRESERVE");
    expect(state.events[1].graduation?.certificateNumber).toBe("CERT-PRESERVE");
  });

  it.each(["withdraw", "suspend"] as const)("corrects an existing completed-term assessment after %s in a still-active session", async action => {
    const f = await assessmentFixture();
    const upsert = api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk;
    expect(await f.admin.mutation(upsert, { ...f.tuple, records: [f.scores] }))
      .toEqual({ updated: 1, created: 0, errors: [] });
    await f.depart(action);
    const history = await f.read();
    const baseline = scoreRowBaseline(await f.t.run(ctx => ctx.db.get(f.recordId)));
    expect(await f.admin.mutation(upsert, { ...f.tuple, records: [{ ...f.scores, ca1: 12, expectedRow: baseline }] }))
      .toEqual({ updated: 1, created: 0, errors: [] });
    const corrected = await f.t.run(ctx => ctx.db.get(f.recordId));
    expect(corrected).toMatchObject({ ca1: 12, total: 72, enteredBy: f.ids.adminId, createdAt: 1 });
    expect(await f.read()).toEqual(history);
    expect(await f.t.run(ctx => ctx.db.get(f.ids.sessionId))).toMatchObject({ isActive: true });

    expect(await f.admin.mutation(upsert, { ...f.tuple, records: [{ ...f.scores, expectedRow: baseline }] }))
      .toMatchObject({ updated: 0, created: 0, errors: [{ message: expect.stringContaining("changed since") }] });
    const missingSubjectId = await f.t.run(ctx => ctx.db.insert("subjects", { schoolId: f.ids.schoolId, name: "English", code: "ENG", createdAt: 1, updatedAt: 1 }));
    expect(await f.admin.mutation(upsert, { ...f.tuple, subjectId: missingSubjectId, records: [f.scores] }))
      .toMatchObject({ updated: 0, created: 0, errors: [{ field: "record", message: expect.stringContaining("Inactive") }] });
    expect(await f.admin.mutation(upsert, { ...f.tuple, classId: f.ids.nextClassId, records: [f.scores] }))
      .toMatchObject({ updated: 0, created: 0, errors: [{ message: expect.stringContaining("selected class") }] });
    await expect(f.admin.mutation(upsert, { ...f.tuple, classId: f.ids.foreignClassId, records: [f.scores] })).rejects.toThrow();
    await f.t.run(ctx => ctx.db.insert("assessmentEditingPolicies", { schoolId: f.ids.schoolId, sessionId: f.ids.sessionId, termId: f.ids.termId, editingWindowEnabled: false, finalizationEnabled: true, finalizeAt: NOW - 1, createdAt: 1, updatedAt: 1, updatedBy: f.ids.adminId }));
    await expect(f.admin.mutation(upsert, { ...f.tuple, records: [f.scores] })).rejects.toThrow("Editing closed");
    expect(await f.t.run(ctx => ctx.db.get(f.recordId))).toEqual(corrected);
    expect(await f.t.run(ctx => ctx.db.query("assessmentRecords").collect())).toHaveLength(1);
  });

  it.each(["active", "ongoing", "future", "ends-now", "active-past", "inactive-session-future", "wrong-session"] as const)("denies inactive-student corrections for a noncompleted or mismatched term: %s", async kind => {
    const f = await assessmentFixture();
    await f.depart();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.termId, {
        isActive: kind === "active" || kind === "active-past",
        startDate: kind === "future" || kind === "inactive-session-future" ? NOW + 1 : Date.parse("2026-09-01"),
        endDate: kind === "ends-now" ? NOW : kind === "active-past" || kind === "wrong-session" ? NOW - 1 : NOW + 1000,
        sessionId: kind === "wrong-session" ? f.ids.futureSessionId : f.ids.sessionId,
      });
      if (kind === "inactive-session-future") await ctx.db.patch(f.ids.sessionId, { isActive: false });
    });
    const before = await f.t.run(ctx => ctx.db.get(f.recordId));
    expect(await f.admin.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, { ...f.tuple, records: [f.scores] }))
      .toMatchObject({ updated: 0, created: 0, errors: [{ field: "record" }] });
    expect(await f.t.run(ctx => ctx.db.get(f.recordId))).toEqual(before);
  });

  it("denies current scoring, attendance and narrative drafts while retaining the existing grade", async () => {
    const f = await fixture();
    const recordId = await f.t.run(async ctx => {
      await ctx.db.insert("gradingBands", { schoolId: f.ids.schoolId, minScore: 0, maxScore: 100, gradeLetter: "A", remark: "Pass", isActive: true, version: 1, createdAt: 1, updatedAt: 1, updatedBy: f.ids.adminId });
      return ctx.db.insert("assessmentRecords", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId, subjectId: f.ids.subjectId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 40, examScaledScore: 40, total: 70, gradeLetter: "A", remark: "Pass", examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft", enteredBy: f.ids.adminId, updatedBy: f.ids.adminId, createdAt: 1, updatedAt: 1 });
    });
    await f.depart("suspend");
    const before = await f.t.run(ctx => ctx.db.get(recordId));
    const tuple = { classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId };
    expect((await f.admin.query(api.functions.academic.assessmentRecords.getExamEntrySheet, { ...tuple, subjectId: f.ids.subjectId })).roster).toEqual([]);
    const result = await f.admin.mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, { ...tuple, subjectId: f.ids.subjectId, records: [{ studentId: f.ids.studentId, ca1: 20, ca2: 20, ca3: 20, examRawScore: 40 }] });
    expect(result).toMatchObject({ updated: 0, created: 0, errors: [expect.objectContaining({ studentId: f.ids.studentId })] });
    await expect(f.admin.mutation(api.functions.academic.reportCardExtras.saveStudentReportCardExtrasEntry, { ...tuple, studentId: f.ids.studentId, bundleValues: [] })).rejects.toThrow("Inactive");
    expect((await f.admin.query(api.functions.academic.reportCardExtras.getStudentReportCardExtrasEntry, { ...tuple, studentId: f.ids.studentId })).canEdit).toBe(false);
    await f.t.run(ctx => ctx.db.insert("classSessionReportModes", { schoolId: f.ids.schoolId, classId: f.ids.classId, sessionId: f.ids.sessionId, mode: "narrative", updatedAt: 1, updatedBy: f.ids.adminId }));
    await expect(f.admin.query(api.functions.academic.narrativeReports.getDraft, { ...tuple, studentId: f.ids.studentId, subjectId: f.ids.subjectId })).rejects.toThrow("inactive");
    expect(await f.t.run(ctx => ctx.db.get(recordId))).toEqual(before);
  });

  it("retains issued invoice liability but denies single and bulk new routine fees for inactive students", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("schoolBankAccounts", { schoolId: f.ids.schoolId, bankName: "Test Bank", accountNumber: "0123456789", accountName: "Lifecycle", currency: "NGN", isDefault: true, status: "active", createdAt: 1, updatedAt: 1, updatedBy: f.ids.adminId }));
    const first = await f.admin.mutation(api.functions.billing.createFeePlan, { name: "First fees", lineItems: [{ label: "Tuition", amount: 5000, category: "tuition" }] });
    const second = await f.admin.mutation(api.functions.billing.createFeePlan, { name: "Second fees", lineItems: [{ label: "Tuition", amount: 5000, category: "tuition" }] });
    const tuple = { classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId };
    const invoice = await f.admin.mutation(api.functions.billing.createInvoiceFromFeePlan, { ...tuple, feePlanId: first._id, studentId: f.ids.studentId });
    const before = await f.t.run(ctx => ctx.db.get(invoice._id));
    await f.depart();
    await expect(f.admin.mutation(api.functions.billing.createInvoiceFromFeePlan, { ...tuple, feePlanId: second._id, studentId: f.ids.studentId })).rejects.toThrow("inactive");
    const bulk = await f.admin.mutation(api.functions.billing.applyFeePlanToClassStudents, { ...tuple, feePlanId: second._id });
    expect(bulk).toMatchObject({ createdCount: 0 });
    expect(await f.t.run(ctx => ctx.db.get(invoice._id))).toEqual(before);
    const history = await f.admin.query(api.functions.billing.listStudentInvoicesAndPayments, { studentId: f.ids.studentId });
    expect(history.invoices).toContainEqual(expect.objectContaining({ invoice: expect.objectContaining({ _id: invoice._id, balanceDue: 5000 }) }));
  });

  it.each(["admission", "return"] as const)("authorizes reviewed narrative placement after %s, not the period entry class", async entry => {
    const f = await fixture();
    const narrative = api.functions.academic.narrativeReports;
    await f.admin.mutation(narrative.setClassModes, { sessionId: f.ids.sessionId, classIds: [f.ids.classId, f.ids.nextClassId], mode: "narrative" });
    const studentId = await f.admin.mutation(enrollment.createStudent, {
      requestKey: `narrative-${entry}`, classId: f.ids.classId, admissionNumber: "NARRATIVE-2", name: "Narrative Student", gender: "Female",
    });
    if (entry === "return") {
      await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId, action: "suspend", expectedRevision: 1, operationKey: "narrative-leave", reason: "Departure reviewed" });
      await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId, action: "reinstate", expectedRevision: 2, operationKey: "narrative-return", reason: "Return reviewed", placement: { ...f.placement, classId: f.ids.classId } });
    }
    const original = { studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId };
    await f.admin.mutation(narrative.saveDraft, { ...original, subjectId: f.ids.subjectId, comment: "Entry-class draft" });
    const before = await f.admin.query(enrollment.getStudentEnrollmentPeriods, { studentId, paginationOpts: { cursor: null, numItems: 20 } });
    await f.admin.mutation(enrollment.updateStudent, { studentId, classId: f.ids.nextClassId, confirmClassAssignment: true, expectedClassId: f.ids.classId, expectedSessionId: f.ids.sessionId });
    expect(await f.admin.query(enrollment.getStudentEnrollmentPeriods, { studentId, paginationOpts: { cursor: null, numItems: 20 } })).toEqual(before);
    expect(before.page.every(period => period.classId === f.ids.classId)).toBe(true);
    const history = await f.admin.query(enrollment.getStudentEnrollmentHistory, { studentId, paginationOpts: { cursor: null, numItems: 20 } });
    expect(history.page[0]).toMatchObject({ type: "placement_changed", classId: f.ids.nextClassId });
    const current = { ...original, classId: f.ids.nextClassId };
    expect((await f.admin.query(api.functions.academic.narrativeEntrySheet.getSheet, { classId: current.classId, sessionId: current.sessionId, termId: current.termId, subjectId: f.ids.subjectId })).map(row => row.studentId)).toContain(studentId);
    expect(await f.admin.query(narrative.getDraft, { ...current, subjectId: f.ids.subjectId })).toEqual({ comment: "", issued: false });
    await expect(f.admin.query(narrative.getDraft, { ...original, subjectId: f.ids.subjectId })).rejects.toThrow("not enrolled");
    await expect(f.admin.mutation(narrative.saveDraft, { ...original, subjectId: f.ids.subjectId, comment: "Stale class" })).rejects.toThrow("not enrolled");
    await expect(f.admin.query(narrative.getStaffPreview, original)).rejects.toThrow("not enrolled");
    await expect(f.admin.mutation(narrative.publish, { ...original, reviewedKey: "stale" })).rejects.toThrow("not enrolled");
    await f.admin.mutation(narrative.saveDraft, { ...current, subjectId: f.ids.subjectId, comment: "Reviewed current class" });
    expect(await f.admin.query(narrative.getDraft, { ...current, subjectId: f.ids.subjectId })).toEqual({ comment: "Reviewed current class", issued: false });
    const ready = await f.admin.query(narrative.getStaffPreview, current);
    if (ready.reviewedKey === null) throw new Error("Expected unpublished current report");
    const issued = await f.admin.mutation(narrative.publish, { ...current, reviewedKey: ready.reviewedKey });
    expect(issued).toMatchObject({ classId: f.ids.nextClassId, snapshot: { subjects: [{ comment: "Reviewed current class" }] } });
  });

  it("retains exact issued and historical narrative evidence after reviewed placement without leaking current entry-class access", async () => {
    const f = await fixture();
    const narrative = api.functions.academic.narrativeReports;
    await f.admin.mutation(narrative.setClassModes, { sessionId: f.ids.sessionId, classIds: [f.ids.classId, f.ids.nextClassId], mode: "narrative" });
    const studentId = await f.admin.mutation(enrollment.createStudent, {
      requestKey: "narrative-history", classId: f.ids.classId, admissionNumber: "NARRATIVE-HISTORY", name: "Historical Student", gender: "Female", admissionDay: "2026-09-01",
    });
    const original = { studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.termId };
    await f.admin.mutation(narrative.saveDraft, { ...original, subjectId: f.ids.subjectId, comment: "Issued in entry class" });
    const ready = await f.admin.query(narrative.getStaffPreview, original);
    if (ready.reviewedKey === null) throw new Error("Expected unpublished entry report");
    const issued = await f.admin.mutation(narrative.publish, { ...original, reviewedKey: ready.reviewedKey });
    const unissuedTermId = await f.t.run(ctx => ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: f.ids.sessionId, name: "Unissued term", startDate: Date.parse("2026-10-01"), endDate: Date.parse("2026-12-31"), isActive: false, createdAt: 1, updatedAt: 1 }));
    await f.admin.mutation(enrollment.updateStudent, { studentId, classId: f.ids.nextClassId, confirmClassAssignment: true, expectedClassId: f.ids.classId, expectedSessionId: f.ids.sessionId });
    const unissuedOriginal = { ...original, termId: unissuedTermId };
    expect(await f.admin.query(narrative.getStaffPreview, original)).toMatchObject({ status: "issued", snapshot: issued.snapshot, reviewedKey: null });
    await expect(f.admin.query(narrative.getStaffPreview, { ...original, classId: f.ids.nextClassId })).rejects.toThrow("Invalid issued report selection");
    await expect(f.admin.query(narrative.getStaffPreview, unissuedOriginal)).rejects.toThrow("not enrolled");
    await expect(f.admin.query(narrative.getDraft, { ...original, subjectId: f.ids.subjectId })).rejects.toThrow("not enrolled");
    await f.admin.mutation(enrollment.transitionStudentEnrollment, { studentId, action: "suspend", expectedRevision: 2, operationKey: "historical-leave", reason: "Departure reviewed" });
    const current = { ...original, classId: f.ids.nextClassId, termId: unissuedTermId };
    await expect(f.admin.query(narrative.getDraft, { ...current, subjectId: f.ids.subjectId })).rejects.toThrow("inactive");
    await expect(f.admin.mutation(narrative.saveDraft, { ...current, subjectId: f.ids.subjectId, comment: "Inactive" })).rejects.toThrow("inactive");
    await expect(f.admin.mutation(narrative.publish, { ...current, reviewedKey: "inactive" })).rejects.toThrow("inactive");
    const pupilIdentity = { subject: "narrative-history-student", tokenIdentifier: "test|narrative-history-student" };
    await f.t.run(async ctx => {
      const student = await ctx.db.get(studentId);
      if (!student) throw new Error("Missing admitted student");
      await ctx.db.patch(student.userId, { authTokenIdentifier: pupilIdentity.tokenIdentifier });
    });
    const pupil = f.t.withIdentity(pupilIdentity);
    const issuedPeriod = { studentId, sessionId: original.sessionId, termId: original.termId };
    expect(await pupil.query(narrative.getIssuedForPortal, issuedPeriod)).toMatchObject({ snapshot: issued.snapshot, issuedAt: issued.issuedAt });
    expect(await f.admin.query(narrative.getStaffPreview, original)).toMatchObject({ status: "issued", snapshot: issued.snapshot });
    await f.t.run(ctx => ctx.db.patch(f.ids.sessionId, { isActive: false }));
    expect(await f.admin.query(narrative.getStaffPreview, unissuedOriginal)).toMatchObject({ status: "draft", snapshot: { className: "Primary 1" } });
    await expect(f.admin.query(narrative.getStaffPreview, current)).rejects.toThrow("not enrolled");
    expect(await pupil.query(narrative.getIssuedForPortal, issuedPeriod)).toMatchObject({ snapshot: issued.snapshot });
  });

  it("records admission once through the registered create/replay path with current date/context", async () => {
    const f = await fixture();
    const args = { requestKey: "admit", classId: f.ids.classId, admissionNumber: "LIFE-2", name: "New Student", gender: "Female" };
    const studentId = await f.admin.mutation(enrollment.createStudent, args);
    expect(await f.admin.mutation(enrollment.createStudent, args)).toBe(studentId);
    const events = await f.admin.query(enrollment.getStudentEnrollmentHistory, { studentId, paginationOpts: { cursor: null, numItems: 20 } });
    expect(events.page).toHaveLength(1);
    expect(events.page[0]).toMatchObject({ type: "admitted", actorUserId: f.ids.adminId, effectiveDay: "2026-10-11", sessionId: f.ids.sessionId, termId: f.ids.termId });
    expect((await f.read()).count?.currentStudentCount).toBe(2);
  });
});
