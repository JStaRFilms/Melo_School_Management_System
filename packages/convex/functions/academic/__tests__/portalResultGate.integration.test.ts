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
  const workspace = (termId = ids.oldTermId, historyLimit = 4) => parent.query(api.functions.portal.getWorkspaceData, { studentId: ids.studentId, sessionId: ids.sessionId, termId, historyLimit });
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
  it("hides partial drafts and certified but unreleased cards for parent and student", async () => {
    const f = await fixture();
    for (const viewer of [f.parent, f.student]) {
      const result = await viewer.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId, termId: f.ids.oldTermId });
      expect(result).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
      expect(JSON.stringify(result.notifications)).not.toMatch(/pending|marks|comment|score|grade|\/report-cards/i);
    }
    await f.certify();
    for (const viewer of [f.parent, f.student]) {
      const result = await viewer.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId, termId: f.ids.oldTermId });
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
    const studentView = await f.student.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId, termId: f.ids.oldTermId });
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
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId, sessionId: secondSessionId, termId: f.ids.oldTermId })).rejects.toThrow();
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId, sessionId: f.ids.otherSchoolId as never, termId: f.ids.oldTermId })).rejects.toThrow();
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId, termId: f.ids.otherSchoolId as never })).rejects.toThrow();
    await expect(f.t.withIdentity({ subject: "stranger", tokenIdentifier: "https://school.test|stranger" }).query(api.functions.portal.getWorkspaceData, { studentId: f.ids.studentId })).rejects.toThrow();
    const otherStudentId = await f.t.run(async ctx => {
      const userId = await ctx.db.insert("users", { schoolId: f.ids.otherSchoolId, authId: "other-student", name: "Other student", email: "other@student.test", role: "student", createdAt: 1, updatedAt: 1 });
      return ctx.db.insert("students", { schoolId: f.ids.otherSchoolId, classId: f.ids.nextClassId, userId, admissionNumber: "OTHER", createdAt: 1, updatedAt: 1 });
    });
    await expect(f.parent.query(api.functions.portal.getWorkspaceData, { studentId: otherStudentId })).rejects.toThrow();
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
    expect(await f.parent.query(api.functions.portal.getWorkspaceData, { studentId: late, termId: f.ids.oldTermId })).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
    await f.t.run(async ctx => {
      const rows = await ctx.db.query("classResultPublicationStudents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect();
      await ctx.db.delete(rows[0]._id);
      await ctx.db.insert("classResultExclusions", { schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, termId: f.ids.oldTermId, reason: "Reviewed exclusion", approvedBy: f.ids.adminId, approvedAt: 2 });
    });
    expect(await f.workspace()).toMatchObject({ selectedResultState: "withheld", selectedReportCard: null, history: [] });
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
