declare global { interface ImportMeta { glob(pattern: string): Record<string, () => Promise<unknown>> } }
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import { reportCardReviewKey } from "@school/shared/exam-recording";
import schema from "../../../schema";

const modules = import.meta.glob("../../../**/*.ts");
const root = new URL("../../../", import.meta.url).pathname;
const mapped = Object.fromEntries(Object.entries(modules).map(([path, module]) =>
  [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const parentIdentity = { subject: "portal-parent", tokenIdentifier: "https://school.test|portal-parent" };
const studentIdentity = { subject: "portal-student", tokenIdentifier: "https://school.test|portal-student" };
const adminIdentity = { subject: "portal-admin", tokenIdentifier: "https://school.test|portal-admin" };

async function fixture() {
  const t = convexTest(schema, mapped);
  const ids = await t.run(async ctx => {
    const now = 1;
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "portal-gate", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "portal-other", status: "active", createdAt: now, updatedAt: now });
    const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin", email: "admin@gate.test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    const parentId = await ctx.db.insert("users", { schoolId, authId: parentIdentity.subject, authTokenIdentifier: parentIdentity.tokenIdentifier, name: "Parent", email: "parent@gate.test", role: "parent", createdAt: now, updatedAt: now });
    const studentUserId = await ctx.db.insert("users", { schoolId, authId: studentIdentity.subject, authTokenIdentifier: studentIdentity.tokenIdentifier, name: "Student", email: "student@gate.test", role: "student", createdAt: now, updatedAt: now });
    const familyId = await ctx.db.insert("families", { schoolId, name: "Family", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
    await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, relationship: "Mother", isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
    const classId = await ctx.db.insert("classes", { schoolId, name: "JSS 1", level: "Junior", createdAt: now, updatedAt: now });
    const nextClassId = await ctx.db.insert("classes", { schoolId, name: "JSS 2", level: "Junior", createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025/26", startDate: 1, endDate: Date.now() + 100000, isActive: true, createdAt: now, updatedAt: now });
    const oldTermId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 2, endDate: Date.now() + 100000, isActive: true, createdAt: now, updatedAt: now });
    const recentTermId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Second", startDate: 3, endDate: Date.now() + 100000, isActive: false, createdAt: now, updatedAt: now });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "MAT", createdAt: now, updatedAt: now });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: now, updatedAt: now });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, familyId, admissionNumber: "STU-1", createdAt: now, updatedAt: now });
    await ctx.db.insert("studentSubjectSelections", { schoolId, studentId, classId, sessionId, subjectId, createdAt: now, updatedAt: now });
    await ctx.db.insert("gradingBands", { schoolId, minScore: 0, maxScore: 100, gradeLetter: "A", remark: "Pass", isActive: true, version: 1, createdAt: now, updatedAt: now, updatedBy: adminId });
    const recordId = await ctx.db.insert("assessmentRecords", { schoolId, studentId, classId, sessionId, termId: oldTermId, subjectId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 40, examScaledScore: 40, total: 70, gradeLetter: "A", remark: "Pass", examInputModeSnapshot: "raw_70", examRawMaxSnapshot: 70, status: "draft", enteredBy: adminId, updatedBy: adminId, createdAt: now, updatedAt: now });
    const strangerId = await ctx.db.insert("users", { schoolId, authId: "stranger", authTokenIdentifier: "https://school.test|stranger", name: "Stranger", email: "stranger@gate.test", role: "parent", createdAt: now, updatedAt: now });
    const otherFamilyId = await ctx.db.insert("families", { schoolId, name: "Unrelated", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
    await ctx.db.insert("familyMembers", { schoolId, familyId: otherFamilyId, parentUserId: strangerId, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
    return { schoolId, otherSchoolId, adminId, studentId, classId, nextClassId, sessionId, oldTermId, recentTermId, recordId };
  });
  const parent = t.withIdentity(parentIdentity);
  const student = t.withIdentity(studentIdentity);
  const admin = t.withIdentity(adminIdentity);
  const workspace = (termId = ids.oldTermId, historyLimit = 4) => parent.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: ids.studentId, sessionId: ids.sessionId, termId, historyLimit });
  const certify = async () => {
    const tuple = { studentId: ids.studentId, classId: ids.classId, sessionId: ids.sessionId, termId: ids.oldTermId };
    const report = await admin.query(api.functions.academic.reportCards.getStudentReportCard, tuple);
    await admin.mutation(api.functions.academic.reportCards.certifyStudentReportCard, { ...tuple, reviewedKey: reportCardReviewKey(report), confirmation: "STU-1" });
  };
  const release = async () => {
    await t.run(async ctx => {
      const issued = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q => q.eq("studentId", ids.studentId).eq("sessionId", ids.sessionId).eq("termId", ids.oldTermId)).unique();
      if (!issued) throw new Error("Certification missing");
      const publicationId = await ctx.db.insert("classResultPublications", { schoolId: ids.schoolId, classId: ids.classId, sessionId: ids.sessionId, termId: ids.oldTermId, releasedAt: 1, releasedBy: ids.adminId, reviewKey: "fixture", eligibleCount: 1, certifiedCount: 1, excludedCount: 0 });
      await ctx.db.insert("classResultPublicationStudents", { schoolId: ids.schoolId, publicationId, studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.oldTermId, classId: ids.classId, releasedAt: 1, issuedReportCardId: issued._id });
    });
  };
  return { t, ids, parent, student, workspace, certify, release };
}

describe("family graded release gate", () => {
  it("dispatches by family: a narrative period cannot borrow a frozen graded release", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    expect((await f.workspace()).selectedReportCard).not.toBeNull();
    // Simulate legacy conflicting configuration. A narrative mode must never
    // expose the graded frozen copy even if its inclusion remains in storage.
    await f.t.run(ctx => ctx.db.insert("classSessionReportModes", {
      schoolId: f.ids.schoolId, classId: f.ids.classId, sessionId: f.ids.sessionId,
      mode: "narrative", updatedAt: 2, updatedBy: f.ids.adminId,
    }));
    const hidden = await f.workspace();
    expect(hidden).toMatchObject({ selectedReportMode: "narrative", selectedResultState: "withheld",
      selectedReportCard: null, selectedNarrativeReport: null, history: [] });
    expect(JSON.stringify(hidden)).not.toContain("totalScore");
  });

  it("returns only an issued narrative snapshot after promotion, with numeric evidence still private", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("classSessionReportModes", { schoolId: f.ids.schoolId, classId: f.ids.classId,
        sessionId: f.ids.sessionId, mode: "narrative", updatedAt: 2, updatedBy: f.ids.adminId });
      await ctx.db.insert("assessmentRecords", { schoolId: f.ids.schoolId, studentId: f.ids.studentId,
        classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.recentTermId,
        subjectId: (await ctx.db.query("subjects").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).first())!._id,
        ca1: 10, ca2: 10, ca3: 10, examRawScore: 40, examScaledScore: 40,
        total: 70, gradeLetter: "A", remark: "Private numeric", examInputModeSnapshot: "raw_70",
        examRawMaxSnapshot: 70, status: "draft", enteredBy: f.ids.adminId, updatedBy: f.ids.adminId,
        createdAt: 1, updatedAt: 1 });
    });
    const args = { studentId: f.ids.studentId, sessionId: f.ids.sessionId, termId: f.ids.recentTermId };
    const unpublished = await f.parent.query(api.functions.portal.getWorkspaceData, args);
    expect(unpublished).toMatchObject({ selectedReportMode: "narrative", selectedReportCard: null,
      selectedNarrativeReport: null, history: [] });
    await f.t.run(async ctx => {
      const subject = (await ctx.db.query("subjects").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).first())!;
      await ctx.db.insert("issuedNarrativeReports", { schoolId: f.ids.schoolId, studentId: f.ids.studentId,
        classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.recentTermId,
        issuedAt: 3, issuedBy: f.ids.adminId,
        snapshot: { schoolName: "School", studentName: "Student", admissionNumber: "STU-1",
          className: "JSS 1", sessionName: "2025/26", termName: "Second",
          subjects: [{ subjectId: subject._id, name: "Math", order: 0, comment: "Issued comment" }] } });
      await ctx.db.patch(f.ids.studentId, { classId: f.ids.nextClassId });
      await ctx.db.insert("studentPromotions", { schoolId: f.ids.schoolId, studentId: f.ids.studentId,
        fromClassId: f.ids.classId, toClassId: f.ids.nextClassId, fromSessionId: f.ids.sessionId,
        toSessionId: f.ids.sessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0,
        batchKey: "joint", createdAt: 3, createdBy: f.ids.adminId });
    });
    const issued = await f.parent.query(api.functions.portal.getWorkspaceData, args);
    expect(issued.selectedNarrativeReport?.snapshot.subjects[0].comment).toBe("Issued comment");
    expect(issued.selectedReportCard).toBeNull();
    expect(issued.history).toMatchObject([{ mode: "narrative", issued: true, classId: f.ids.classId }]);
    expect(JSON.stringify(issued)).not.toContain("Private numeric");
  });
  it("shows upcoming school events beyond 256 past events without leaking another school's events", async () => {
    const f = await fixture();
    const now = Date.now();
    const upcomingIds = await f.t.run(async ctx => {
      const event = (schoolId: typeof f.ids.schoolId, title: string, startDate: number, isArchived = false) => ({
        schoolId, title, startDate, endDate: startDate + 1_000, isAllDay: false,
        isArchived, createdAt: 1, updatedAt: 1, updatedBy: f.ids.adminId,
      });
      for (let i = 0; i < 270; i++) {
        await ctx.db.insert("schoolEvents", event(f.ids.schoolId, `Past ${i}`, now - 10_000 - i));
      }
      await ctx.db.insert("schoolEvents", event(f.ids.schoolId, "Archived", now + 1_000, true));
      await ctx.db.insert("schoolEvents", event(f.ids.otherSchoolId, "Other school", now + 1_500));
      const first = await ctx.db.insert("schoolEvents", event(f.ids.schoolId, "School open day", now + 2_000));
      const second = await ctx.db.insert("schoolEvents", event(f.ids.schoolId, "Family meeting", now + 3_000));
      return [first, second];
    });
    const result = await f.parent.query(api.functions.portal.getWorkspaceData, {
      studentId: f.ids.studentId, now,
    });
    expect(result.selectedReportCard).toBeNull();
    expect(result.history).toEqual([]);
    expect(result.notifications.filter(notice => notice.id.startsWith("event-")).map(notice => notice.id))
      .toEqual(upcomingIds.map(id => `event-${id}`));
    expect(JSON.stringify(result.notifications)).not.toMatch(/Archived|Other school|Past 269/);
    const refreshed = await f.parent.query(api.functions.portal.getWorkspaceData, {
      studentId: f.ids.studentId, now: now + 2_500,
    });
    expect(refreshed.notifications.filter(notice => notice.id.startsWith("event-")).map(notice => notice.id))
      .toEqual([`event-${upcomingIds[1]}`]);
  });

  it("finds a live school event after more than 64 archived future events", async () => {
    const f = await fixture();
    const now = Date.now();
    const liveId = await f.t.run(async ctx => {
      const event = (schoolId: typeof f.ids.schoolId, title: string, startDate: number, isArchived = false) => ({
        schoolId, title, startDate, endDate: startDate + 1_000, isAllDay: false,
        isArchived, createdAt: 1, updatedAt: 1, updatedBy: f.ids.adminId,
      });
      for (let i = 0; i < 75; i++) {
        await ctx.db.insert("schoolEvents", event(f.ids.schoolId, `Archived ${i}`, now + 1_000 + i, true));
      }
      await ctx.db.insert("schoolEvents", event(f.ids.otherSchoolId, "Foreign event", now + 1_100));
      return ctx.db.insert("schoolEvents", event(f.ids.schoolId, "Open day", now + 2_000));
    });
    const result = await f.parent.query(api.functions.portal.getWorkspaceData, {
      studentId: f.ids.studentId, now,
    });
    expect(result.selectedReportCard).toBeNull();
    expect(result.notifications.filter(notice => notice.id.startsWith("event-")).map(notice => notice.id))
      .toEqual([`event-${liveId}`]);
    expect(JSON.stringify(result.notifications)).not.toMatch(/Archived|Foreign event/);
  });

  it("keeps legacy no-now requests callable without event notices or draft results", async () => {
    const f = await fixture();
    const now = Date.now();
    const eventId = await f.t.run(async ctx => {
      return ctx.db.insert("schoolEvents", {
        schoolId: f.ids.schoolId, title: "Upcoming open day", startDate: now + 10_000,
        endDate: now + 11_000, isAllDay: false, createdAt: 1, updatedAt: 1,
        updatedBy: f.ids.adminId,
      });
    });
    const legacyArgs = { studentId: f.ids.studentId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId };
    const withheld = await f.parent.query(api.functions.portal.getWorkspaceData, legacyArgs);
    expect(withheld).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
    expect(withheld.notifications.some(notice => notice.id.startsWith("event-"))).toBe(false);
    await f.certify();
    await f.release();
    const [legacy, current] = await Promise.all([
      f.parent.query(api.functions.portal.getWorkspaceData, legacyArgs),
      f.parent.query(api.functions.portal.getWorkspaceData, { ...legacyArgs, now }),
    ]);
    expect(legacy.selectedResultState).toBe("released");
    expect(legacy.selectedReportCard).toEqual(current.selectedReportCard);
    expect(legacy.history).toEqual(current.history);
    expect(legacy.notifications.some(notice => notice.id.startsWith("event-"))).toBe(false);
    expect(current.notifications.some(notice => notice.id === `event-${eventId}`)).toBe(true);
  });

  it("hides partial drafts and certified but unreleased cards for parent and student", async () => {
    const f = await fixture();
    for (const viewer of [f.parent, f.student]) {
      const result = await viewer.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId, termId: f.ids.oldTermId });
      expect(result).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
      expect(JSON.stringify(result.notifications)).not.toMatch(/pending|marks|comment|score|grade|\/report-cards/i);
    }
    await f.certify();
    for (const viewer of [f.parent, f.student]) {
      const result = await viewer.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId, termId: f.ids.oldTermId });
      expect(result).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
      expect(JSON.stringify(result.notifications)).not.toMatch(/pending|marks|comment|score|grade|\/report-cards/i);
    }
  });

  it("reads the pinned card after release, not later drafts, and keeps older released history behind newer withheld terms", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    const released = await f.workspace();
    expect(released.selectedResultState).toBe("released");
    expect(released.selectedReportCard?.summary.totalScore).toBeGreaterThan(0);
    const studentView = await f.student.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId, termId: f.ids.oldTermId });
    expect(studentView.selectedReportCard).toEqual(released.selectedReportCard);
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.recordId, { total: 1, remark: "Changed after release" });
      await ctx.db.patch(f.ids.studentId, { classId: f.ids.nextClassId });
      await ctx.db.insert("studentPromotions", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, fromClassId: f.ids.classId, toClassId: f.ids.nextClassId, fromSessionId: f.ids.sessionId, toSessionId: f.ids.sessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "test", createdAt: 2, createdBy: f.ids.adminId });
      await ctx.db.patch(f.ids.classId, { isArchived: true });
      for (let i = 0; i < 7; i++) await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: f.ids.sessionId, name: `Unreleased ${i}`, startDate: 10 + i, endDate: Date.now() + 100000, isActive: false, createdAt: 1, updatedAt: 1 });
    });
    const current = await f.workspace(f.ids.recentTermId, 1);
    expect(current).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null });
    expect(current.history).toHaveLength(1);
    expect(current.history[0]).toMatchObject({ classId: f.ids.classId, termId: f.ids.oldTermId, totalScore: released.selectedReportCard?.summary.totalScore });
    expect(current.notifications.some(n => n.id.startsWith("comment-") || n.id.startsWith("next-term-"))).toBe(false);
    expect((await f.workspace()).selectedReportCard).toEqual(released.selectedReportCard);
  });

  it("rejects ID mismatches, foreign families and schools and ambiguous same-term class cards", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    const secondSessionId = await f.t.run(ctx => ctx.db.insert("academicSessions", { schoolId: f.ids.schoolId, name: "Different session", startDate: 20, endDate: 30, isActive: false, createdAt: 1, updatedAt: 1 }));
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId, sessionId: secondSessionId, termId: f.ids.oldTermId })).rejects.toThrow();
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId, sessionId: f.ids.otherSchoolId as never, termId: f.ids.oldTermId })).rejects.toThrow();
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId, termId: f.ids.otherSchoolId as never })).rejects.toThrow();
    await expect(f.t.withIdentity({ subject: "stranger", tokenIdentifier: "https://school.test|stranger" }).query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: f.ids.studentId })).rejects.toThrow();
    const otherStudentId = await f.t.run(async ctx => {
      const userId = await ctx.db.insert("users", { schoolId: f.ids.otherSchoolId, authId: "other-student", name: "Other student", email: "other@student.test", role: "student", createdAt: 1, updatedAt: 1 });
      return ctx.db.insert("students", { schoolId: f.ids.otherSchoolId, classId: f.ids.nextClassId, userId, admissionNumber: "OTHER", createdAt: 1, updatedAt: 1 });
    });
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: otherStudentId })).rejects.toThrow();
    await f.t.run(async ctx => {
      const issued = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q => q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.oldTermId)).unique();
      await ctx.db.insert("issuedReportCards", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, issuedAt: issued!.issuedAt, issuedBy: f.ids.adminId, report: { ...issued!.report, classId: f.ids.nextClassId } });
    });
    expect(await f.workspace()).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
  });

  it("does not include late or excluded students without frozen inclusion", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    const late = await f.t.run(async ctx => {
      const existing = await ctx.db.get(f.ids.studentId);
      const userId = await ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: "late-student", name: "Late", email: "late@gate.test", role: "student", createdAt: 2, updatedAt: 2 });
      return ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId, userId, familyId: existing!.familyId, admissionNumber: "LATE", createdAt: 2, updatedAt: 2 });
    });
    const lateResult = await f.parent.query(api.functions.portal.getWorkspaceData, { now: Date.now(), studentId: late, termId: f.ids.oldTermId });
    expect(lateResult).toMatchObject({ selectedResultState: "no_eligible_record", selectedReportCard: null, history: [] });
    expect(JSON.stringify(lateResult)).not.toMatch(/Reviewed exclusion|gradeLetter|averageScore/);
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, { studentId: late, termId: f.ids.recentTermId }))
      .toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
    await f.t.run(ctx => ctx.db.patch(late, { createdAt: 0 }));
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, { studentId: late, termId: f.ids.oldTermId }))
      .toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
    await f.t.run(async ctx => {
      const rows = await ctx.db.query("classResultPublicationStudents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect();
      await ctx.db.delete(rows[0]._id);
      await ctx.db.insert("classResultExclusions", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, reason: "Reviewed exclusion", approvedBy: f.ids.adminId, approvedAt: 2 });
    });
    expect(await f.workspace()).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
  });

  it("distinguishes a frozen exclusion from an unreleased tuple without exposing its reason", async () => {
    const f = await fixture();
    const excluded = await f.t.run(async ctx => {
      const original = await ctx.db.get(f.ids.studentId);
      const userId = await ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: "excluded-student", name: "Excluded", email: "excluded@gate.test", role: "student", createdAt: 1, updatedAt: 1 });
      const studentId = await ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId, userId, familyId: original!.familyId, admissionNumber: "EX-1", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("classResultExclusions", { schoolId: f.ids.schoolId, studentId, classId: f.ids.classId,
        sessionId: f.ids.sessionId, termId: f.ids.oldTermId, reason: "Private reviewed reason", approvedBy: f.ids.adminId, approvedAt: 1 });
      return studentId;
    });
    const args = { studentId: excluded, sessionId: f.ids.sessionId, termId: f.ids.oldTermId };
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, args))
      .toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
    await f.certify();
    await f.release();
    await f.t.run(async ctx => {
      const publication = await ctx.db.query("classResultPublications")
        .withIndex("by_school_and_session_and_term_and_class", q => q.eq("schoolId", f.ids.schoolId)
          .eq("sessionId", f.ids.sessionId).eq("termId", f.ids.oldTermId).eq("classId", f.ids.classId)).unique();
      await ctx.db.patch(publication!._id, { excludedCount: 1 });
    });
    const result = await f.parent.query(api.functions.portal.getWorkspaceData, args);
    expect(result).toMatchObject({ selectedResultState: "no_eligible_record", selectedReportCard: null, history: [] });
    expect(JSON.stringify(result)).not.toMatch(/Private reviewed reason|gradeLetter|averageScore/);
    await f.t.run(ctx => ctx.db.patch(excluded, { classId: f.ids.nextClassId }));
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, args))
      .toMatchObject({ selectedResultState: "no_eligible_record", selectedReportCard: null, history: [] });
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, { ...args, termId: f.ids.recentTermId }))
      .toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
    await f.t.run(ctx => ctx.db.insert("classResultExclusions", { schoolId: f.ids.schoolId, studentId: excluded,
      classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId,
      reason: "Conflicting historical class", approvedBy: f.ids.adminId, approvedAt: 1 }));
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, args))
      .toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
  });

  it("finds the student's release among more than 32 other class releases", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    await f.t.run(async ctx => {
      for (let i = 0; i < 40; i++) {
        const classId = await ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: `Other ${i}`, level: "Junior", createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("classResultPublications", { schoolId: f.ids.schoolId, classId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, releasedAt: 2, releasedBy: f.ids.adminId, reviewKey: `other-${i}`, eligibleCount: 0, certifiedCount: 0, excludedCount: 0 });
      }
      const foreignClass = await ctx.db.insert("classes", { schoolId: f.ids.otherSchoolId, name: "Foreign", level: "Junior", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("classResultPublications", { schoolId: f.ids.otherSchoolId, classId: foreignClass, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, releasedAt: 2, releasedBy: f.ids.adminId, reviewKey: "foreign", eligibleCount: 0, certifiedCount: 0, excludedCount: 0 });
    });
    const result = await f.workspace();
    expect(result.selectedResultState).toBe("released");
    expect(result.history.map(row => row.termId)).toContain(f.ids.oldTermId);
    const late = await f.t.run(async ctx => {
      const original = await ctx.db.get(f.ids.studentId);
      const userId = await ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: "many-classes-late", name: "Late", email: "many-late@gate.test", role: "student", createdAt: 2, updatedAt: 2 });
      return ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId, userId, familyId: original!.familyId, admissionNumber: "MANY-LATE", createdAt: 2, updatedAt: 2 });
    });
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, { studentId: late, termId: f.ids.oldTermId }))
      .toMatchObject({ selectedResultState: "no_eligible_record", selectedReportCard: null, history: [] });
  });

  it("keeps the selected old card when released history exceeds its own budget", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    await f.t.run(async ctx => {
      const issued = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q => q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.oldTermId)).unique();
      for (let i = 0; i < 55; i++) {
        const termId = await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: f.ids.sessionId, name: `Released ${i}`, startDate: 10 + i, endDate: 100 + i, isActive: false, createdAt: 1, updatedAt: 1 });
        const copyId = await ctx.db.insert("issuedReportCards", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId, issuedAt: issued!.issuedAt, issuedBy: f.ids.adminId, report: { ...issued!.report, termName: `Released ${i}` } });
        const publicationId = await ctx.db.insert("classResultPublications", { schoolId: f.ids.schoolId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId, releasedAt: i + 2, releasedBy: f.ids.adminId, reviewKey: `released-${i}`, eligibleCount: 1, certifiedCount: 1, excludedCount: 0 });
        await ctx.db.insert("classResultPublicationStudents", { schoolId: f.ids.schoolId, publicationId, studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId, releasedAt: i + 2, issuedReportCardId: copyId });
      }
    });
    const selected = await f.workspace(f.ids.oldTermId, 4);
    expect(selected.selectedResultState).toBe("released");
    expect(selected.selectedTermId).toBe(f.ids.oldTermId);
    expect(selected.selectedReportCard?.termName).toBe("First");
    expect(selected.history).toHaveLength(4);
    expect(selected.history.every(row => row.termId !== f.ids.oldTermId)).toBe(true);
  });

  it("fails closed for two frozen classes in one term", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    await f.t.run(async ctx => {
      const original = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q => q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.oldTermId)).unique();
      const secondId = await ctx.db.insert("issuedReportCards", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, issuedAt: original!.issuedAt, issuedBy: f.ids.adminId, report: { ...original!.report, classId: f.ids.nextClassId } });
      const publicationId = await ctx.db.insert("classResultPublications", { schoolId: f.ids.schoolId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, releasedAt: 2, releasedBy: f.ids.adminId, reviewKey: "second", eligibleCount: 1, certifiedCount: 1, excludedCount: 0 });
      await ctx.db.insert("classResultPublicationStudents", { schoolId: f.ids.schoolId, publicationId, studentId: f.ids.studentId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, releasedAt: 2, issuedReportCardId: secondId });
    });
    expect(await f.workspace()).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
  });

  it("keeps an older pinned card after hundreds of newer withheld terms", async () => {
    const f = await fixture();
    await f.certify();
    await f.release();
    await f.t.run(async ctx => {
      for (let i = 0; i < 260; i++) await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: f.ids.sessionId, name: `Term ${i}`, startDate: 10 + i, endDate: 100 + i, isActive: false, createdAt: 1, updatedAt: 1 });
    });
    const selected = await f.workspace();
    expect(selected.selectedResultState).toBe("released");
    expect(selected.history.map(row => row.termId)).toContain(f.ids.oldTermId);
  });
});
