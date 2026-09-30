import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob("../../../**/*.ts"))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const identity = (name: string) => ({ subject: name, tokenIdentifier: `https://auth.school.test|${name}` });
const fn = api.functions.academic.narrativeReports;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "School A", slug: "nar-a", status: "active", createdAt: 1, updatedAt: 1 });
    const foreignSchoolId = await ctx.db.insert("schools", { name: "School B", slug: "nar-b", status: "active", createdAt: 1, updatedAt: 1 });
    const user = (schoolId: typeof foreignSchoolId, name: string, role: "admin" | "teacher" | "student" | "parent") =>
      ctx.db.insert("users", { schoolId, authId: name, authTokenIdentifier: identity(name).tokenIdentifier,
        name, email: `${name}@test.local`, role, createdAt: 1, updatedAt: 1 });
    const adminId = await user(schoolId, "nar-admin", "admin");
    const teacherId = await user(schoolId, "nar-teacher", "teacher");
    const otherTeacherId = await user(schoolId, "nar-other-teacher", "teacher");
    const parentId = await user(schoolId, "nar-parent", "parent");
    const studentUserId = await user(schoolId, "nar-student", "student");
    const classId = await ctx.db.insert("classes", { schoolId, name: "Nursery", level: "Foundation", createdAt: 1, updatedAt: 1 });
    const otherClassId = await ctx.db.insert("classes", { schoolId, name: "Second", level: "Primary", createdAt: 1, updatedAt: 1 });
    const foreignClassId = await ctx.db.insert("classes", { schoolId: foreignSchoolId, name: "Foreign", level: "Primary", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025-26", startDate: 1, endDate: 100, isActive: true, createdAt: 1, updatedAt: 1 });
    const nextSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026-27", startDate: 101, endDate: 200, isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term 1", startDate: 1, endDate: 30, isActive: true, createdAt: 1, updatedAt: 1 });
    const secondTermId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term 2", startDate: 31, endDate: 60, isActive: true, createdAt: 1, updatedAt: 1 });
    const familyId = await ctx.db.insert("families", { schoolId, name: "Family", createdAt: 1, updatedAt: 1, createdBy: adminId, updatedBy: adminId });
    await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, isPrimaryContact: true,
      createdAt: 1, updatedAt: 1, createdBy: adminId, updatedBy: adminId });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, familyId, admissionNumber: "NAR-001", createdAt: 1, updatedAt: 1 });
    const secondStudentUserId = await user(schoolId, "nar-second-student", "student");
    const secondStudentId = await ctx.db.insert("students", { schoolId, classId, userId: secondStudentUserId, admissionNumber: "NAR-002", createdAt: 1, updatedAt: 1 });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Art", code: "ART", createdAt: 1, updatedAt: 1 });
    const secondSubjectId = await ctx.db.insert("subjects", { schoolId, name: "Music", code: "MUS", createdAt: 1, updatedAt: 1 });
    const foreignSubjectId = await ctx.db.insert("subjects", { schoolId: foreignSchoolId, name: "Foreign", code: "FOR", createdAt: 1, updatedAt: 1 });
    for (const id of [subjectId, secondSubjectId]) await ctx.db.insert("classSubjects", { schoolId, classId, subjectId: id, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("teacherAssignments", { schoolId, teacherId, classId, subjectId, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("teacherAssignments", { schoolId, teacherId: otherTeacherId, classId, subjectId: secondSubjectId, createdAt: 1, updatedAt: 1 });
    return { schoolId, foreignSchoolId, adminId, classId, otherClassId, foreignClassId, sessionId, nextSessionId, termId, secondTermId, studentId, secondStudentId, subjectId, secondSubjectId, foreignSubjectId };
  });
  const as = (name: string) => t.withIdentity(identity(`nar-${name}`));
  const selection = { studentId: ids.studentId, classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId };
  const enable = () => as("admin").mutation(fn.setClassModes, { sessionId: ids.sessionId, classIds: [ids.classId], mode: "narrative" });
  return { t, ids, as, selection, enable };
}

describe("issued class narrative batch", () => {
  it("returns only issued snapshots, counts skipped pupils and refuses other schools and non-admins", async () => {
    const { ids, as, selection, enable } = await fixture();
    await enable();
    const batch = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("admin").query(fn.getIssuedClassBatch, batch)).toMatchObject({ reports: [], skipped: 2 });
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Private draft" });
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Music" });
    expect(JSON.stringify(await as("admin").query(fn.getIssuedClassBatch, batch))).not.toContain("Private draft");
    const preview = await as("admin").query(fn.getStaffPreview, selection);
    await as("admin").mutation(fn.publish, { ...selection, reviewedKey: preview.reviewedKey! });
    expect(await as("admin").query(fn.getIssuedClassBatch, batch)).toMatchObject({ skipped: 1, reports: [{ snapshot: { studentName: "Nar-Student" } }] });
    await expect(as("teacher").query(fn.getIssuedClassBatch, batch)).rejects.toThrow();
    await expect(as("parent").query(fn.getIssuedClassBatch, batch)).rejects.toThrow();
    await expect(as("admin").query(fn.getIssuedClassBatch, { ...batch, classId: ids.foreignClassId })).rejects.toThrow();
    await expect(as("admin").query(fn.getIssuedClassBatch, { ...batch, termId: ids.nextSessionId as unknown as typeof ids.termId })).rejects.toThrow();
  });
  it("refuses the whole batch when individually valid issued snapshots exceed 512 KiB together", async () => {
    const { t, ids, as, enable } = await fixture();
    await enable();
    await t.run(async ctx => {
      const subjects = await Promise.all(Array.from({ length: 22 }, (_, i) =>
        ctx.db.insert("subjects", { schoolId: ids.schoolId, name: `Subject ${i}`, code: `S${i}`, createdAt: 1, updatedAt: 1 })));
      const snapshot = {
        schoolName: "School A", studentName: "Student", admissionNumber: "TEST",
        className: "Nursery", sessionName: "2025-26", termName: "Term 1",
        subjects: subjects.map((subjectId, order) => ({ subjectId, name: `Subject ${order}`, order, comment: "a".repeat(10_000) })),
      };
      expect(new TextEncoder().encode(JSON.stringify(snapshot)).length).toBeLessThan(256 * 1024);
      const thirdStudentId = await ctx.db.insert("students", { schoolId: ids.schoolId, classId: ids.classId,
        userId: ids.adminId, admissionNumber: "NAR-003", createdAt: 1, updatedAt: 1 });
      for (const studentId of [ids.studentId, ids.secondStudentId, thirdStudentId]) {
        await ctx.db.insert("issuedNarrativeReports", { schoolId: ids.schoolId, classId: ids.classId,
          sessionId: ids.sessionId, termId: ids.termId, studentId, issuedAt: 1, issuedBy: ids.adminId, snapshot });
      }
    });
    await expect(as("admin").query(fn.getIssuedClassBatch, {
      classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId,
    })).rejects.toThrow(/Print smaller batches\/individually/);
  });
  it("counts graduated pupils in an inactive session even after they leave the class", async () => {
    const { t, ids, as, enable } = await fixture();
    await enable();
    await t.run(async ctx => {
      await ctx.db.patch(ids.sessionId, { isActive: false });
      for (const studentId of [ids.studentId, ids.secondStudentId]) {
        await ctx.db.patch(studentId, { classId: ids.otherClassId, graduatingClassId: ids.classId,
          graduatingSessionId: ids.sessionId, enrollmentStatus: "graduated" });
        await ctx.db.insert("studentGraduations", { schoolId: ids.schoolId, studentId,
          classId: ids.classId, sessionId: ids.sessionId, graduationDate: 90,
          createdAt: 1, createdBy: ids.adminId });
      }
      await ctx.db.insert("issuedNarrativeReports", { schoolId: ids.schoolId, classId: ids.classId,
        sessionId: ids.sessionId, termId: ids.termId, studentId: ids.studentId, issuedAt: 1,
        issuedBy: ids.adminId, snapshot: { schoolName: "School A", studentName: "Student",
          admissionNumber: "NAR-001", className: "Nursery", sessionName: "2025-26",
          termName: "Term 1", subjects: [{ subjectId: ids.subjectId, name: "Art", order: 0, comment: "Issued" }] } });
    });
    expect(await as("admin").query(fn.getIssuedClassBatch, {
      classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId,
    })).toMatchObject({ skipped: 1, reports: [{ snapshot: { studentName: "Student" } }] });
  });
  it("ignores a large present-day class when printing a small inactive historical roster", async () => {
    const { t, ids, as, enable } = await fixture();
    await enable();
    await t.run(async ctx => {
      await ctx.db.patch(ids.sessionId, { isActive: false });
      await ctx.db.insert("studentGraduations", { schoolId: ids.schoolId, studentId: ids.secondStudentId,
        classId: ids.classId, sessionId: ids.sessionId, graduationDate: 90,
        createdAt: 1, createdBy: ids.adminId });
      await ctx.db.insert("issuedNarrativeReports", { schoolId: ids.schoolId, classId: ids.classId,
        sessionId: ids.sessionId, termId: ids.termId, studentId: ids.studentId, issuedAt: 1,
        issuedBy: ids.adminId, snapshot: { schoolName: "School A", studentName: "Historical pupil",
          admissionNumber: "NAR-001", className: "Nursery", sessionName: "2025-26",
          termName: "Term 1", subjects: [{ subjectId: ids.subjectId, name: "Art", order: 0, comment: "Issued" }] } });
      for (let i = 0; i < 41; i++) await ctx.db.insert("students", { schoolId: ids.schoolId,
        classId: ids.classId, userId: ids.adminId, admissionNumber: `NOW-${i}`, createdAt: 1, updatedAt: 1 });
    });
    expect(await as("admin").query(fn.getIssuedClassBatch, {
      classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId,
    })).toMatchObject({ skipped: 1, reports: [{ snapshot: { studentName: "Historical pupil" } }] });
  });
  it("fails closed instead of returning a partial batch above 40 reports", async () => {
    const { t, ids, as, enable } = await fixture();
    await enable();
    await t.run(async ctx => {
      for (let i = 0; i < 40; i++) await ctx.db.insert("students", { schoolId: ids.schoolId, classId: ids.classId,
        userId: ids.adminId, admissionNumber: `B-${i}`, createdAt: 1, updatedAt: 1 });
    });
    await expect(as("admin").query(fn.getIssuedClassBatch, { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId })).rejects.toThrow(/40 students/);
  });
});

describe("legacy links and historical period resolution", () => {
  it("restores verified graded staff deep links without classId and rejects unrelated staff", async () => {
    const { t, ids, as, selection } = await fixture();
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("admin").query(fn.getStaffPeriodReportMode, period)).toEqual({ classId: ids.classId, mode: "graded" });
    expect(await as("teacher").query(fn.getStaffPeriodReportMode, period)).toEqual({ classId: ids.classId, mode: "graded" });
    await expect(as("parent").query(fn.getStaffPeriodReportMode, period)).rejects.toThrow();
    await expect(as("admin").query(fn.getStaffPeriodReportMode, { ...period, studentId: ids.foreignClassId as unknown as typeof ids.studentId })).rejects.toThrow();
    await t.run(ctx => ctx.db.patch(ids.secondStudentId, { classId: ids.otherClassId }));
    await expect(as("teacher").query(fn.getStaffPeriodReportMode, { ...period, studentId: ids.secondStudentId })).rejects.toThrow("Not assigned");
    expect(await as("admin").query(api.functions.academic.reportCards.getStudentReportCard, selection)).toMatchObject({ classId: ids.classId });
  });
  it("routes an unpublished narrative class without classId to narrative mode, never a graded draft", async () => {
    const { ids, as, selection, enable } = await fixture();
    await enable();
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Private note" });
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("admin").query(fn.getStaffPeriodReportMode, period)).toEqual({ classId: ids.classId, mode: "narrative" });
    expect(JSON.stringify(await as("teacher").query(fn.getStaffPeriodReportMode, period))).not.toContain("Private note");
    const workspace = await as("parent").query(api.functions.portal.getWorkspaceData, period);
    expect(workspace.selectedReportMode).toBe("narrative");
    expect(workspace.selectedReportCard).toBeNull();
    expect(workspace.selectedNarrativeReport).toBeNull();
  });
  it("uses period subject selections when there are no marks and refuses conflicting class evidence", async () => {
    const { t, ids, as } = await fixture();
    await t.run(async ctx => {
      await ctx.db.patch(ids.sessionId, { isActive: false });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
      await ctx.db.insert("studentSubjectSelections", { schoolId: ids.schoolId, studentId: ids.studentId,
        classId: ids.classId, sessionId: ids.sessionId, subjectId: ids.subjectId, createdAt: 1, updatedAt: 1 });
    });
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("admin").query(fn.getStaffPeriodReportMode, period)).toEqual({ classId: ids.classId, mode: "graded" });
    expect((await as("parent").query(fn.getPortalReportSelection, period)).classId).toBe(ids.classId);
    await t.run(ctx => ctx.db.insert("studentSubjectSelections", { schoolId: ids.schoolId, studentId: ids.studentId,
      classId: ids.otherClassId, sessionId: ids.sessionId, subjectId: ids.secondSubjectId, createdAt: 1, updatedAt: 1 }));
    await expect(as("admin").query(fn.getStaffPeriodReportMode, period)).rejects.toThrow("Enrollment history requires review");
    await expect(as("parent").query(fn.getPortalReportSelection, period)).rejects.toThrow("Enrollment history requires review");
  });
  it("marks ambiguous unissued history for review without exposing draft comments, marks, or a guessed class", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Private narrative draft" });
    await t.run(async ctx => {
      await ctx.db.patch(ids.sessionId, { isActive: false });
      for (const classId of [ids.classId, ids.otherClassId]) await ctx.db.insert("studentSubjectSelections", {
        schoolId: ids.schoolId, studentId: ids.studentId, classId, sessionId: ids.sessionId,
        subjectId: ids.subjectId, createdAt: 1, updatedAt: 1,
      });
    });
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    await expect(as("parent").query(fn.getPortalReportSelection, period)).rejects.toThrow("Enrollment history requires review");
    const workspace = await as("parent").query(api.functions.portal.getWorkspaceData, period);
    expect(workspace.selectedReportNeedsReview).toBe(true);
    expect(workspace.selectedReportMode).toBeNull();
    expect(workspace.selectedReportCard).toBeNull();
    expect(workspace.selectedNarrativeReport).toBeNull();
    const history = workspace.history.find(row => row.termId === ids.termId);
    expect(history).toMatchObject({ mode: "needs_review", issued: false, note: "Historical report needs school review." });
    expect(history).not.toHaveProperty("classId");
    expect(history).not.toHaveProperty("className");
    expect(history).not.toHaveProperty("averageScore");
    expect(JSON.stringify(workspace)).not.toContain("Private narrative draft");
  });
  it("keeps an issued graded report when other period evidence is ambiguous", async () => {
    const { t, ids, as, selection } = await fixture();
    const report = await as("admin").query(api.functions.academic.reportCards.getStudentReportCard, selection);
    await t.run(async ctx => {
      await ctx.db.insert("issuedReportCards", { schoolId: ids.schoolId, classId: ids.classId,
        studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId,
        issuedAt: 1, issuedBy: ids.adminId, report });
      await ctx.db.patch(ids.sessionId, { isActive: false });
      for (const classId of [ids.classId, ids.otherClassId]) await ctx.db.insert("studentSubjectSelections", {
        schoolId: ids.schoolId, studentId: ids.studentId, classId, sessionId: ids.sessionId,
        subjectId: ids.subjectId, createdAt: 1, updatedAt: 1,
      });
    });
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("parent").query(fn.getPortalReportSelection, period)).toMatchObject({ classId: ids.classId, mode: "graded" });
    const workspace = await as("parent").query(api.functions.portal.getWorkspaceData, period);
    expect(workspace.selectedReportNeedsReview).toBe(false);
    expect(workspace.selectedReportMode).toBe("graded");
    expect(workspace.history.find(row => row.termId === ids.termId)?.mode).toBe("graded");
  });
  it("restores inactive legacy graded history using same-school period records, but not draft narrative fallback", async () => {
    const { t, ids, as, enable } = await fixture();
    await t.run(async ctx => {
      await ctx.db.patch(ids.sessionId, { isActive: false });
      await ctx.db.insert("assessmentRecords", { schoolId: ids.schoolId, classId: ids.classId,
        sessionId: ids.sessionId, termId: ids.termId, subjectId: ids.subjectId,
        studentId: ids.studentId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 50,
        examScaledScore: 50, total: 80, gradeLetter: "A", remark: "Legacy work",
        examInputModeSnapshot: "raw", examRawMaxSnapshot: 100, status: "draft",
        enteredBy: ids.adminId, updatedBy: ids.adminId, createdAt: 1, updatedAt: 1 });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
    });
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("admin").query(fn.getStaffPeriodReportMode, period)).toEqual({ classId: ids.classId, mode: "graded" });
    const graded = await as("parent").query(api.functions.portal.getWorkspaceData, period);
    expect(graded.selectedReportMode).toBe("graded");
    expect(graded.history.find(item => item.termId === ids.termId)?.mode).toBe("graded");
    await enable();
    const narrative = await as("parent").query(api.functions.portal.getWorkspaceData, period);
    expect(narrative.selectedReportMode).toBe("narrative");
    expect(narrative.selectedReportCard).toBeNull();
    expect(narrative.selectedNarrativeReport).toBeNull();
    expect(narrative.history.find(item => item.termId === ids.termId)).toMatchObject({ mode: "narrative", issued: false });
    expect(JSON.stringify(narrative)).not.toContain("Legacy work");
  });
});

describe("portal narrative access", () => {
  it("keeps default graded selections on the existing graded path", async () => {
    const { ids, as } = await fixture();
    const workspace = await as("parent").query(api.functions.portal.getWorkspaceData, {
      studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId,
    });
    expect(workspace.selectedReportMode).toBe("graded");
    expect(workspace.selectedNarrativeReport).toBeNull();
    expect(workspace.history.find(item => item.termId === ids.termId)?.mode).toBe("graded");
  });
  it("gates every workspace read before publication, then returns only the issued copy", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    // Simulate pre-existing numeric work from before the class switched modes.
    await t.run(ctx => ctx.db.insert("assessmentRecords", {
      schoolId: ids.schoolId, classId: ids.classId, sessionId: ids.sessionId,
      termId: ids.termId, subjectId: ids.subjectId, studentId: ids.studentId,
      ca1: 10, ca2: 10, ca3: 10, examRawScore: 50, examScaledScore: 50,
      total: 80, gradeLetter: "A", remark: "Old graded draft", examInputModeSnapshot: "raw",
      examRawMaxSnapshot: 100, status: "draft", enteredBy: ids.adminId, updatedBy: ids.adminId,
      createdAt: 1, updatedAt: 1,
    }));
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Private paint note" });
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Private music note" });
    const portal = api.functions.portal.getWorkspaceData;
    const args = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    const draft = await as("parent").query(portal, args);
    expect(draft.selectedReportMode).toBe("narrative");
    expect(draft.selectedReportCard).toBeNull();
    expect(draft.selectedNarrativeReport).toBeNull();
    const draftTerm = draft.history.find(item => item.termId === ids.termId);
    expect(draftTerm).toMatchObject({ mode: "narrative", issued: false });
    expect(draftTerm).not.toHaveProperty("averageScore");
    expect(draftTerm).not.toHaveProperty("pendingSubjects");
    expect(draft.history.find(item => item.termId === ids.secondTermId)).toMatchObject({ mode: "narrative", issued: false });
    expect(draft.notifications.every(item => !/pending|comment|score|mark/i.test(item.title + item.body))).toBe(true);
    expect(JSON.stringify(draft)).not.toMatch(/Private paint note|Private music note|Old graded draft|still need marks/);
    const ready = await as("admin").query(fn.getStaffPreview, selection);
    await as("admin").mutation(fn.publish, { ...selection, reviewedKey: ready.reviewedKey! });
    await t.run(async ctx => {
      await ctx.db.patch(ids.subjectId, { name: "Renamed art" });
      await ctx.db.insert("studentPromotions", { schoolId: ids.schoolId, studentId: ids.studentId,
        fromClassId: ids.classId, toClassId: ids.otherClassId, fromSessionId: ids.sessionId,
        toSessionId: ids.nextSessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0,
        batchKey: "portal-history", createdAt: 2, createdBy: ids.adminId });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
    });
    const issued = await as("parent").query(portal, args);
    expect(issued.selectedReportCard).toBeNull();
    const directIssued = await as("parent").query(fn.getIssuedForPortal, args);
    expect(directIssued).not.toHaveProperty("issuedBy");
    expect((await as("parent").query(fn.getPortalReportSelection, args)).issued).not.toHaveProperty("issuedBy");
    expect(issued.selectedNarrativeReport?.snapshot.subjects).toMatchObject([
      { name: "Art", comment: "Private paint note" }, { name: "Music", comment: "Private music note" },
    ]);
    expect(issued.history.find(item => item.termId === ids.termId)).toMatchObject({ mode: "narrative", issued: true, className: "Nursery" });
    expect(issued.history.find(item => item.termId === ids.termId)).not.toHaveProperty("totalScore");
    expect(JSON.stringify(issued)).not.toMatch(/Renamed art|still need marks/);
    await expect(as("second-student").query(portal, args)).rejects.toThrow();
    await expect(as("teacher").query(portal, args)).rejects.toThrow();
    await t.run(async ctx => {
      for (const [schoolId, name] of [[ids.foreignSchoolId, "foreign-portal-parent"], [ids.schoolId, "unlinked-portal-parent"]] as const) {
        await ctx.db.insert("users", { schoolId, authId: name,
          authTokenIdentifier: identity(name).tokenIdentifier,
          name, email: `${name}@test.local`, role: "parent", createdAt: 1, updatedAt: 1 });
      }
    });
    await expect(t.withIdentity(identity("foreign-portal-parent")).query(portal, args)).rejects.toThrow();
    await expect(t.withIdentity(identity("unlinked-portal-parent")).query(portal, args)).rejects.toThrow();
    await expect(as("parent").query(portal, { ...args, termId: ids.nextSessionId as unknown as typeof ids.termId })).rejects.toThrow();
  });
});

describe("narrative subject reports", () => {
  it("returns only authorized subject roster rows with independent drafts and issued state", async () => {
    const { ids, as, selection, enable } = await fixture();
    const sheet = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId, subjectId: ids.subjectId };
    const getSheet = api.functions.academic.narrativeEntrySheet.getSheet;
    await expect(as("teacher").query(getSheet, sheet)).rejects.toThrow("graded");
    await enable();
    expect(new Set((await as("teacher").query(getSheet, sheet)).map(row => row.studentId))).toEqual(new Set([ids.studentId, ids.secondStudentId]));
    await expect(as("other-teacher").query(getSheet, sheet)).rejects.toThrow("Not assigned");
    await expect(as("parent").query(getSheet, sheet)).rejects.toThrow();
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "First pupil" });
    await as("teacher").mutation(fn.saveDraft, { ...selection, studentId: ids.secondStudentId, subjectId: ids.subjectId, comment: "Second pupil" });
    expect(Object.fromEntries((await as("teacher").query(getSheet, sheet)).map(row => [row.studentId, row.comment]))).toMatchObject({ [ids.studentId]: "First pupil", [ids.secondStudentId]: "Second pupil" });
    const review = await as("admin").query(fn.getStaffPreview, selection);
    expect(review.snapshot.subjects).toHaveLength(2);
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Other subject" });
    const ready = await as("admin").query(fn.getStaffPreview, selection);
    await as("admin").mutation(fn.publish, { ...selection, reviewedKey: ready.reviewedKey! });
    expect(Object.fromEntries((await as("teacher").query(getSheet, sheet)).map(row => [row.studentId, row.issued]))).toMatchObject({ [ids.studentId]: true, [ids.secondStudentId]: false });
  });
  it("keeps promoted pupils on the previous session sheet and checks their draft writes", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await t.run(async ctx => {
      await ctx.db.insert("studentPromotions", { schoolId: ids.schoolId, studentId: ids.studentId,
        fromClassId: ids.classId, toClassId: ids.otherClassId, fromSessionId: ids.sessionId,
        toSessionId: ids.nextSessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0,
        batchKey: "sheet-promotion", createdAt: 2, createdBy: ids.adminId });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
      await ctx.db.patch(ids.sessionId, { isActive: false });
    });
    const sheet = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId, subjectId: ids.subjectId };
    expect((await as("teacher").query(api.functions.academic.narrativeEntrySheet.getSheet, sheet)).map(row => row.studentId)).toContain(ids.studentId);
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Previous class" });
    expect((await as("teacher").query(api.functions.academic.narrativeEntrySheet.getSheet, sheet)).find(row => row.studentId === ids.studentId)?.comment).toBe("Previous class");
  });

  it("reads selections per pupil and issued reports for the requested term only", async () => {
    const { t, ids, as, enable } = await fixture();
    await enable();
    const subjects = await t.run(async ctx => {
      const extra = [];
      for (let i = 0; i < 3; i++) {
        const id = await ctx.db.insert("subjects", { schoolId: ids.schoolId, name: `Extra ${i}`, code: `EX${i}`, createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("classSubjects", { schoolId: ids.schoolId, classId: ids.classId, subjectId: id, createdAt: 1, updatedAt: 1 });
        extra.push(id);
      }
      return [ids.subjectId, ids.secondSubjectId, ...extra];
    });
    // 101 pupils selecting five subjects exceed the old class-wide 200-row cap.
    for (let batch = 0; batch < 3; batch++) await t.run(async ctx => {
      for (let i = batch * 40; i < Math.min((batch + 1) * 40, 101); i++) {
        const userId = await ctx.db.insert("users", { schoolId: ids.schoolId, authId: `bulk-${i}`,
          authTokenIdentifier: identity(`bulk-${i}`).tokenIdentifier, name: `Pupil ${i}`, email: `bulk-${i}@test.local`, role: "student", createdAt: 1, updatedAt: 1 });
        const studentId = await ctx.db.insert("students", { schoolId: ids.schoolId, classId: ids.classId, userId, admissionNumber: `B-${i}`, createdAt: 1, updatedAt: 1 });
        for (const subjectId of subjects) await ctx.db.insert("studentSubjectSelections", { schoolId: ids.schoolId,
          studentId, classId: ids.classId, sessionId: ids.sessionId, subjectId, createdAt: 1, updatedAt: 1 });
      }
    });
    const sheet = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId, subjectId: ids.subjectId };
    expect(await as("admin").query(api.functions.academic.narrativeEntrySheet.getSheet, sheet)).toHaveLength(103);
    const snapshot = { schoolName: "School A", studentName: "Other", admissionNumber: "X", className: "Nursery",
      sessionName: "2025-26", termName: "Term 2", subjects: [] };
    for (let batch = 0; batch < 3; batch++) await t.run(async ctx => {
      for (let i = batch * 80; i < Math.min((batch + 1) * 80, 201); i++)
        await ctx.db.insert("issuedNarrativeReports", { schoolId: ids.schoolId, classId: ids.classId,
          studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.secondTermId,
          issuedAt: i, issuedBy: ids.adminId, snapshot });
    });
    expect(await as("admin").query(api.functions.academic.narrativeEntrySheet.getSheet, sheet)).toHaveLength(103);
  });

  it("offers stale explicit selections to admin and only assigned teachers after an offering is removed", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await t.run(async ctx => {
      await ctx.db.insert("studentSubjectSelections", { schoolId: ids.schoolId, studentId: ids.studentId,
        classId: ids.classId, sessionId: ids.sessionId, subjectId: ids.subjectId, createdAt: 1, updatedAt: 1 });
      const offering = await ctx.db.query("classSubjects").withIndex("by_class_and_subject", q =>
        q.eq("classId", ids.classId).eq("subjectId", ids.subjectId)).unique();
      await ctx.db.delete(offering!._id);
    });
    const period = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId };
    const options = api.functions.academic.narrativeEntrySheet.getSubjectOptions;
    expect((await as("admin").query(options, period)).map(option => option.id)).toContain(ids.subjectId);
    expect((await as("teacher").query(options, period)).map(option => option.id)).toContain(ids.subjectId);
    expect((await as("other-teacher").query(options, period)).map(option => option.id)).not.toContain(ids.subjectId);
    expect((await as("teacher").query(api.functions.academic.narrativeEntrySheet.getSheet, { ...period, subjectId: ids.subjectId })).map(row => row.studentId)).toEqual([ids.studentId]);
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Still selected" });
    expect((await as("admin").query(fn.getStaffPreview, selection)).snapshot.subjects).toMatchObject([{ subjectId: ids.subjectId, comment: "Still selected" }]);
    await t.run(async ctx => {
      const assignment = await ctx.db.query("teacherAssignments").withIndex("by_class", q =>
        q.eq("classId", ids.classId)).filter(q => q.eq(q.field("subjectId"), ids.subjectId)).first();
      if (assignment) await ctx.db.delete(assignment._id);
    });
    expect((await as("teacher").query(options, period)).map(option => option.id)).not.toContain(ids.subjectId);
    expect((await as("admin").query(options, period)).map(option => option.id)).toContain(ids.subjectId);
    await expect(as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Forbidden" })).rejects.toThrow("Not assigned");
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Admin can finish" });
    const review = await as("admin").query(fn.getStaffPreview, selection);
    expect(review.snapshot.subjects).toMatchObject([{ subjectId: ids.subjectId, comment: "Admin can finish" }]);
    expect((await as("admin").mutation(fn.publish, { ...selection, reviewedKey: review.reviewedKey! })).snapshot.subjects)
      .toMatchObject([{ subjectId: ids.subjectId, comment: "Admin can finish" }]);
  });

  it("excludes archived class subjects from entry and publish without rewriting issued history", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Art draft" });
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Music draft" });
    const before = await as("admin").query(fn.getStaffPreview, selection);
    await t.run(ctx => ctx.db.patch(ids.secondSubjectId, { isArchived: true }));
    const period = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId };
    const options = await as("admin").query(api.functions.academic.narrativeEntrySheet.getSubjectOptions, period);
    expect(options.map(option => option.id)).toEqual([ids.subjectId]);
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Hidden" }))
      .rejects.toThrow("not selected");
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: before.reviewedKey! })).rejects.toThrow("changed");
    const current = await as("admin").query(fn.getStaffPreview, selection);
    expect(current.snapshot.subjects).toMatchObject([{ subjectId: ids.subjectId, comment: "Art draft" }]);
    const issued = await as("admin").mutation(fn.publish, { ...selection, reviewedKey: current.reviewedKey! });
    await t.run(async ctx => {
      await ctx.db.patch(ids.subjectId, { name: "Renamed", isArchived: true });
      await ctx.db.insert("studentSubjectSelections", {
        schoolId: ids.schoolId, classId: ids.classId, studentId: ids.secondStudentId,
        sessionId: ids.sessionId, subjectId: ids.secondSubjectId, createdAt: 1, updatedAt: 1,
      });
    });
    expect((await as("admin").query(fn.getStaffPreview, selection)).snapshot.subjects).toEqual(issued.snapshot.subjects);
    expect((await as("parent").query(fn.getIssuedForPortal, { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId }))?.snapshot.subjects)
      .toEqual(issued.snapshot.subjects);
    const second = { ...selection, studentId: ids.secondStudentId };
    expect((await as("admin").query(fn.getStaffPreview, second)).snapshot.subjects).toEqual([]);
    const review = await as("admin").query(fn.getStaffPreview, second);
    await expect(as("admin").mutation(fn.publish, { ...second, reviewedKey: review.reviewedKey! })).rejects.toThrow("Assign subjects");
  });

  it("defaults to graded, bounds modes by tenant and session, and blocks empty subject publish", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    expect(await as("admin").query(fn.getClassMode, { classId: ids.classId, sessionId: ids.sessionId })).toBe("graded");
    await expect(as("admin").mutation(fn.setClassModes, { sessionId: ids.sessionId, classIds: [ids.classId, ids.foreignClassId], mode: "narrative" })).rejects.toThrow();
    await expect(as("teacher").mutation(fn.setClassModes, { sessionId: ids.sessionId, classIds: [ids.classId], mode: "narrative" })).rejects.toThrow();
    await enable();
    expect(await as("admin").query(fn.getClassMode, { classId: ids.classId, sessionId: ids.nextSessionId })).toBe("graded");
    await t.run(async ctx => {
      const rows = await ctx.db.query("classSubjects").withIndex("by_class", q => q.eq("classId", ids.classId)).collect();
      for (const row of rows) await ctx.db.delete(row._id);
    });
    const review = await as("admin").query(fn.getStaffPreview, selection);
    expect(review.snapshot.subjects).toEqual([]);
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: review.reviewedKey! })).rejects.toThrow("Assign subjects");
  });

  it("allows mode selection past 200 graded cards, and fails closed on incomplete history", async () => {
    const { t, ids, as, selection } = await fixture();
    const report = await as("admin").query(api.functions.academic.reportCards.getStudentReportCard, selection);
    for (let batch = 0; batch < 5; batch++) await t.run(async ctx => {
      for (let index = 0; index < 50; index++)
        await ctx.db.insert("issuedReportCards", { schoolId: ids.schoolId, classId: ids.otherClassId,
          studentId: ids.secondStudentId, sessionId: ids.sessionId, termId: ids.termId,
          issuedAt: batch * 50 + index, issuedBy: ids.adminId, report });
    });
    expect((await as("admin").query(fn.listClassModes, { sessionId: ids.sessionId })).find(c => c.classId === ids.classId)?.locked).toBe(false);
    await as("admin").mutation(fn.setClassModes, { sessionId: ids.sessionId, classIds: [ids.classId], mode: "narrative" });
    await t.run(ctx => ctx.db.insert("issuedReportCards", { schoolId: ids.schoolId, classId: ids.classId,
      studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId, issuedAt: 300, issuedBy: ids.adminId, report }));
    expect((await as("admin").query(fn.listClassModes, { sessionId: ids.sessionId })).find(c => c.classId === ids.classId)?.locked).toBe(true);
    for (let batch = 0; batch < 15; batch++) await t.run(async ctx => {
      for (let index = 0; index < 50; index++)
        await ctx.db.insert("issuedReportCards", { schoolId: ids.schoolId, classId: ids.otherClassId,
          studentId: ids.secondStudentId, sessionId: ids.sessionId, termId: ids.termId,
          issuedAt: 301 + batch * 50 + index, issuedBy: ids.adminId, report });
    });
    await expect(as("admin").mutation(fn.setClassModes, { sessionId: ids.nextSessionId, classIds: [ids.classId], mode: "narrative" }))
      .rejects.toThrow("scan limit");
    await expect(as("admin").query(fn.listClassModes, { sessionId: ids.sessionId })).rejects.toThrow("scan limit");
  });

  it("rejects a report whose combined comments exceed the safe snapshot byte budget", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    const moreSubjects = await t.run(async ctx => {
      const idsAdded = [];
      for (let i = 0; i < 27; i++) {
        const subjectId = await ctx.db.insert("subjects", { schoolId: ids.schoolId, name: `Extra ${i.toString().padStart(2, "0")}`, code: `EX${i}`, createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("classSubjects", { schoolId: ids.schoolId, classId: ids.classId, subjectId, createdAt: 1, updatedAt: 1 });
        idsAdded.push(subjectId);
      }
      return idsAdded;
    });
    await enable();
    for (const subjectId of moreSubjects) await as("admin").mutation(fn.saveDraft, { ...selection, subjectId, comment: "x".repeat(10000) });
    await expect(as("admin").query(fn.getStaffPreview, selection)).rejects.toThrow("256 KB report limit");
    expect(await t.run(ctx => ctx.db.query("issuedNarrativeReports").withIndex("by_school", q => q.eq("schoolId", ids.schoolId)).take(1))).toEqual([]);
    for (const subjectId of moreSubjects) await as("admin").mutation(fn.saveDraft, { ...selection, subjectId, comment: "Short" });
    for (const subjectId of [ids.subjectId, ids.secondSubjectId]) await as("admin").mutation(fn.saveDraft, { ...selection, subjectId, comment: "Short" });
    const ready = await as("admin").query(fn.getStaffPreview, selection);
    expect((await as("admin").mutation(fn.publish, { ...selection, reviewedKey: ready.reviewedKey! })).snapshot.subjects).toHaveLength(29);
  });

  it("enforces subject-level access, tenant, enrollment and guards numeric entry", async () => {
    const { ids, as, selection, enable } = await fixture();
    await enable();
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Paints carefully." });
    await expect(as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Wrong teacher" })).rejects.toThrow("Not assigned");
    await expect(as("other-teacher").query(fn.getDraft, { ...selection, subjectId: ids.subjectId })).rejects.toThrow("Not assigned");
    await expect(as("teacher").query(fn.getStaffPreview, selection)).rejects.toThrow("Admin access");
    await expect(as("parent").query(fn.getDraft, { ...selection, subjectId: ids.subjectId })).rejects.toThrow();
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.foreignSubjectId, comment: "Wrong school" })).rejects.toThrow();
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, classId: ids.otherClassId, subjectId: ids.subjectId, comment: "Wrong class" })).rejects.toThrow();
    const sheet = { sessionId: ids.sessionId, termId: ids.termId, classId: ids.classId, subjectId: ids.subjectId };
    await expect(as("admin").query(api.functions.academic.assessmentRecords.getExamEntrySheet, sheet)).rejects.toThrow("narrative");
    await expect(as("admin").mutation(api.functions.academic.assessmentRecords.upsertAssessmentRecordsBulk, {
      ...sheet, records: [{ studentId: ids.studentId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 20 }],
    })).rejects.toThrow("narrative");
  });

  it("requires all applicable comments, stale review rejects, issued names/order remain fixed", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    const empty = await as("admin").query(fn.getStaffPreview, selection);
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Art comment" });
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: empty.reviewedKey! })).rejects.toThrow("changed");
    const partial = await as("admin").query(fn.getStaffPreview, selection);
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: partial.reviewedKey! })).rejects.toThrow("every subject");
    expect(await as("parent").query(fn.getIssuedForPortal, { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId })).toBeNull();
    await as("other-teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Music comment" });
    const ready = await as("admin").query(fn.getStaffPreview, selection);
    const issued = await as("admin").mutation(fn.publish, { ...selection, reviewedKey: ready.reviewedKey! });
    expect(issued.snapshot.subjects).toMatchObject([{ name: "Art", order: 0, comment: "Art comment" }, { name: "Music", order: 1, comment: "Music comment" }]);
    await expect(as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Rewrite" })).rejects.toThrow("Published");
    await expect(as("admin").mutation(fn.setClassModes, { sessionId: ids.sessionId, classIds: [ids.classId], mode: "graded" })).rejects.toThrow("locked");
    expect((await as("admin").mutation(fn.publish, { ...selection, reviewedKey: "obsolete" }))._id).toBe(issued._id);
    await t.run(async ctx => {
      await ctx.db.patch(ids.subjectId, { name: "Renamed art" });
      const assignments = await ctx.db.query("classSubjects").withIndex("by_class", q => q.eq("classId", ids.classId)).collect();
      for (const row of assignments) await ctx.db.delete(row._id);
      await ctx.db.insert("studentPromotions", { schoolId: ids.schoolId, studentId: ids.studentId,
        fromClassId: ids.classId, toClassId: ids.otherClassId, fromSessionId: ids.sessionId,
        toSessionId: ids.nextSessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0,
        batchKey: "narrative-history", createdAt: 2, createdBy: ids.adminId });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
    });
    const portal = await as("parent").query(fn.getIssuedForPortal, { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId });
    expect(portal?.snapshot.subjects).toEqual(issued.snapshot.subjects);
    expect((await as("admin").query(fn.getStaffPreview, selection)).snapshot.subjects).toEqual(issued.snapshot.subjects);
    await expect(as("parent").query(fn.getIssuedForPortal, { studentId: ids.secondStudentId, sessionId: ids.sessionId, termId: ids.termId })).rejects.toThrow();
  });

  it("reads only an exact issued snapshot after class change without promotion history", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Old Art" });
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Old Music" });
    const ready = await as("admin").query(fn.getStaffPreview, selection);
    const issued = await as("admin").mutation(fn.publish, { ...selection, reviewedKey: ready.reviewedKey! });
    await t.run(async ctx => {
      await ctx.db.patch(ids.sessionId, { isActive: false });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
      await ctx.db.patch(ids.subjectId, { name: "Renamed Art" });
      await ctx.db.insert("classSessionReportModes", { schoolId: ids.schoolId, classId: ids.otherClassId,
        sessionId: ids.sessionId, mode: "narrative", updatedAt: 1, updatedBy: ids.adminId });
      await ctx.db.insert("users", { schoolId: ids.foreignSchoolId, authId: "nar-foreign-admin",
        authTokenIdentifier: identity("nar-foreign-admin").tokenIdentifier, name: "Foreign admin",
        email: "nar-foreign-admin@test.local", role: "admin", createdAt: 1, updatedAt: 1 });
    });
    const deepLink = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("admin").query(fn.getStaffPeriodReportMode, deepLink))
      .toEqual({ classId: ids.classId, mode: "narrative" });
    expect(await as("teacher").query(fn.getStaffPeriodReportMode, deepLink))
      .toEqual({ classId: ids.classId, mode: "narrative" });
    expect(await as("admin").query(fn.getStaffPreview, selection))
      .toMatchObject({ status: "issued", snapshot: issued.snapshot, issuedAt: issued.issuedAt, reviewedKey: null });
    expect((await as("admin").query(fn.getStaffPreview, selection)).snapshot.subjects)
      .toEqual(issued.snapshot.subjects);
    expect(await as("teacher").query(fn.getStaffPreview, selection))
      .toMatchObject({ status: "issued", snapshot: issued.snapshot });
    await expect(as("teacher").query(fn.getStaffPreview, { ...selection, termId: ids.secondTermId }))
      .rejects.toThrow("not enrolled");
    await expect(as("admin").query(fn.getStaffPreview, { ...selection, classId: ids.otherClassId }))
      .rejects.toThrow("Invalid issued report selection");
    await expect(as("admin").query(fn.getStaffPreview, { ...selection, termId: ids.secondTermId }))
      .rejects.toThrow("not enrolled");
    await expect(as("foreign-admin").query(fn.getStaffPreview, selection)).rejects.toThrow();
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Rewritten" }))
      .rejects.toThrow("not enrolled");
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, termId: ids.secondTermId,
      subjectId: ids.subjectId, comment: "Unissued" })).rejects.toThrow("not enrolled");
  });

  it("keeps mid-term transfer drafts independent by class and issues only one class snapshot", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await as("admin").mutation(fn.setClassModes, { sessionId: ids.sessionId,
      classIds: [ids.otherClassId], mode: "narrative" });
    await t.run(async ctx => {
      await ctx.db.insert("classSubjects", { schoolId: ids.schoolId, classId: ids.otherClassId,
        subjectId: ids.subjectId, createdAt: 1, updatedAt: 1 });
      const destinationTeacher = await ctx.db.query("teacherAssignments").withIndex("by_class", q =>
        q.eq("classId", ids.classId)).filter(q => q.eq(q.field("subjectId"), ids.secondSubjectId)).first();
      await ctx.db.insert("teacherAssignments", { schoolId: ids.schoolId, classId: ids.otherClassId,
        subjectId: ids.subjectId, teacherId: destinationTeacher!.teacherId, createdAt: 1, updatedAt: 1 });
    });
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Source art" });
    await t.run(async ctx => {
      await ctx.db.insert("studentPromotions", { schoolId: ids.schoolId, studentId: ids.studentId,
        fromClassId: ids.classId, toClassId: ids.otherClassId,
        fromSessionId: ids.sessionId, toSessionId: ids.sessionId,
        subjectEnrollmentMode: "all_target_class_subjects", subjectEnrollmentCount: 1,
        batchKey: "mid-term-narrative", createdAt: 2, createdBy: ids.adminId });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
    });
    const destination = { ...selection, classId: ids.otherClassId };
    await as("other-teacher").mutation(fn.saveDraft, { ...destination,
      subjectId: ids.subjectId, comment: "Destination art" });
    expect(await as("teacher").query(fn.getDraft, { ...selection, subjectId: ids.subjectId }))
      .toEqual({ comment: "Source art", issued: false });
    expect(await as("other-teacher").query(fn.getDraft, { ...destination, subjectId: ids.subjectId }))
      .toEqual({ comment: "Destination art", issued: false });
    await expect(as("teacher").query(fn.getDraft, { ...destination, subjectId: ids.subjectId }))
      .rejects.toThrow("Not assigned");
    await expect(as("other-teacher").query(fn.getDraft, { ...selection, subjectId: ids.subjectId }))
      .rejects.toThrow("Not assigned");
    await expect(as("parent").query(fn.getDraft, { ...destination, subjectId: ids.subjectId })).rejects.toThrow();
    const before = await t.run(ctx => ctx.db.query("narrativeReportDrafts")
      .withIndex("by_studentId_and_sessionId_and_termId_and_classId_and_subjectId", q =>
        q.eq("studentId", ids.studentId).eq("sessionId", ids.sessionId).eq("termId", ids.termId)).take(10));
    expect(before.map(row => [row.classId, row.comment])).toEqual([
      [ids.classId, "Source art"], [ids.otherClassId, "Destination art"],
    ]);
    const reviewed = await as("admin").query(fn.getStaffPreview, destination);
    const issued = await as("admin").mutation(fn.publish, { ...destination, reviewedKey: reviewed.reviewedKey! });
    expect(issued).toMatchObject({ classId: ids.otherClassId, snapshot: { subjects: [{ comment: "Destination art" }] } });
    await expect(as("admin").mutation(fn.saveDraft, { ...destination, subjectId: ids.subjectId,
      comment: "Edited issued" })).rejects.toThrow("Published");
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: "old" })).rejects.toThrow("Invalid issued report selection");
    expect((await as("admin").mutation(fn.publish, { ...destination, reviewedKey: "old" }))._id).toBe(issued._id);
    await t.run(ctx => ctx.db.patch(ids.subjectId, { name: "Renamed after issue" }));
    expect((await as("admin").query(fn.getStaffPreview, destination)).snapshot).toEqual(issued.snapshot);
    expect((await t.run(ctx => ctx.db.query("narrativeReportDrafts")
      .withIndex("by_studentId_and_sessionId_and_termId_and_classId_and_subjectId", q =>
        q.eq("studentId", ids.studentId).eq("sessionId", ids.sessionId).eq("termId", ids.termId)).take(10)))
      .map(row => [row.classId, row.comment])).toEqual(before.map(row => [row.classId, row.comment]));
    expect(await t.run(ctx => ctx.db.query("issuedNarrativeReports").withIndex("by_studentId_and_sessionId_and_termId", q =>
      q.eq("studentId", ids.studentId).eq("sessionId", ids.sessionId).eq("termId", ids.termId)).take(10))).toHaveLength(1);
  });

  it("explicit student selections replace class subjects and keep other students separate", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await t.run(ctx => ctx.db.insert("studentSubjectSelections", { schoolId: ids.schoolId, classId: ids.classId,
      studentId: ids.studentId, sessionId: ids.sessionId, subjectId: ids.secondSubjectId, createdAt: 1, updatedAt: 1 }));
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Not selected" })).rejects.toThrow("not selected");
    await as("other-teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Selected" });
    const review = await as("admin").query(fn.getStaffPreview, selection);
    expect(review.snapshot.subjects).toHaveLength(1);
    await as("admin").mutation(fn.publish, { ...selection, reviewedKey: review.reviewedKey! });
    const second = { ...selection, studentId: ids.secondStudentId };
    expect((await as("admin").query(fn.getStaffPreview, second)).snapshot.subjects).toHaveLength(2);
    await as("admin").mutation(fn.saveDraft, { ...second, subjectId: ids.subjectId, comment: "Second pupil" });
    await as("admin").mutation(fn.saveDraft, { ...second, subjectId: ids.secondSubjectId, comment: "Also second" });
    const secondReview = await as("admin").query(fn.getStaffPreview, second);
    expect((await as("admin").mutation(fn.publish, { ...second, reviewedKey: secondReview.reviewedKey! })).snapshot.subjects).toHaveLength(2);
  });

  it("rejects subject-list changes after review and graded issuance in the same period", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    await enable();
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Art" });
    await as("admin").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Music" });
    const reviewed = await as("admin").query(fn.getStaffPreview, selection);
    await t.run(async ctx => {
      const assignment = await ctx.db.query("classSubjects").withIndex("by_class_and_subject", q =>
        q.eq("classId", ids.classId).eq("subjectId", ids.secondSubjectId)).unique();
      await ctx.db.delete(assignment!._id);
    });
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: reviewed.reviewedKey! })).rejects.toThrow("changed");
    const current = await as("admin").query(fn.getStaffPreview, selection);
    const graded = await as("admin").query(api.functions.academic.reportCards.getStudentReportCard, selection);
    await t.run(ctx => ctx.db.insert("issuedReportCards", { schoolId: ids.schoolId, studentId: ids.studentId,
      classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId, issuedAt: 1, issuedBy: ids.adminId, report: graded }));
    await expect(as("admin").mutation(fn.publish, { ...selection, reviewedKey: current.reviewedKey! })).rejects.toThrow("graded report");
  });

  it("uses selectable aggregation components, never a computed umbrella comment", async () => {
    const { t, ids, as, selection, enable } = await fixture();
    const umbrellaId = await t.run(async ctx => {
      const umbrellaId = await ctx.db.insert("subjects", { schoolId: ids.schoolId, name: "Creative arts", code: "CRE", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("classSubjects", { schoolId: ids.schoolId, classId: ids.classId, subjectId: umbrellaId, createdAt: 1, updatedAt: 1 });
      const aggregationId = await ctx.db.insert("classSubjectAggregations", { schoolId: ids.schoolId, classId: ids.classId,
        umbrellaSubjectId: umbrellaId, strategy: "raw_combined_normalized", reportDisplayMode: "umbrella_only", isActive: true,
        createdAt: 1, updatedAt: 1, updatedBy: ids.adminId });
      for (const [index, subjectId] of [ids.subjectId, ids.secondSubjectId].entries())
        await ctx.db.insert("classSubjectAggregationComponents", { schoolId: ids.schoolId, aggregationId, componentSubjectId: subjectId,
          order: index, includeCA: true, includeExam: true, createdAt: 1, updatedAt: 1 });
      return umbrellaId;
    });
    await enable();
    const sheet = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId };
    expect((await as("teacher").query(api.functions.academic.narrativeEntrySheet.getSheet, { ...sheet, subjectId: ids.subjectId })).map(row => row.studentId)).toContain(ids.studentId);
    expect(await as("admin").query(api.functions.academic.narrativeEntrySheet.getSheet, { ...sheet, subjectId: umbrellaId })).toEqual([]);
    await expect(as("admin").mutation(fn.saveDraft, { ...selection, subjectId: umbrellaId, comment: "Computed" })).rejects.toThrow("not selected");
    await as("teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.subjectId, comment: "Art" });
    await as("other-teacher").mutation(fn.saveDraft, { ...selection, subjectId: ids.secondSubjectId, comment: "Music" });
    const reviewed = await as("admin").query(fn.getStaffPreview, selection);
    expect(reviewed.snapshot.subjects.map(s => s.subjectId)).toEqual([ids.subjectId, ids.secondSubjectId]);
    expect((await as("admin").mutation(fn.publish, { ...selection, reviewedKey: reviewed.reviewedKey! })).snapshot.subjects).toHaveLength(2);
  });

  it("recovers legacy issued graded history for an inactive session without promotions", async () => {
    const { t, ids, as, selection } = await fixture();
    const report = await as("admin").query(api.functions.academic.reportCards.getStudentReportCard, selection);
    await t.run(async ctx => {
      await ctx.db.insert("issuedReportCards", { schoolId: ids.schoolId, studentId: ids.studentId, classId: ids.classId,
        sessionId: ids.sessionId, termId: ids.termId, issuedAt: 2, issuedBy: ids.adminId, report });
      await ctx.db.patch(ids.sessionId, { isActive: false });
      await ctx.db.patch(ids.studentId, { classId: ids.otherClassId });
    });
    const period = { studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId };
    expect(await as("parent").query(fn.getPortalReportSelection, period)).toMatchObject({ classId: ids.classId, mode: "graded", issued: null });
    const portal = await as("parent").query(api.functions.portal.getWorkspaceData, period);
    expect(portal.selectedReportMode).toBe("graded");
    expect(portal.history.find(item => item.termId === ids.termId)).toMatchObject({ classId: ids.classId, mode: "graded", issued: true });
    await expect(as("second-student").query(fn.getPortalReportSelection, period)).rejects.toThrow();
  });

  it("keeps graded report certification and score entry available in default mode", async () => {
    const { ids, as, selection, enable } = await fixture();
    const graded = await as("admin").query(api.functions.academic.reportCards.getStudentReportCard, selection);
    expect(graded).toBeTruthy();
    await enable();
    await expect(as("admin").mutation(api.functions.academic.reportCards.certifyStudentReportCard, {
      ...selection, confirmation: "NAR-001", reviewedKey: "irrelevant",
    })).rejects.toThrow("narrative");
  });
});
