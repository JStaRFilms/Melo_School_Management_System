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
const adminIdentity = {
  subject: "academic-regression-admin",
  tokenIdentifier: "https://auth.school.test|academic-regression-admin",
};

async function archiveFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Selected branch", slug: "selected-archive", status: "active", createdAt: 1, updatedAt: 1 });
    const defaultSchoolId = await ctx.db.insert("schools", { name: "Default branch", slug: "default-archive", status: "active", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { name: "Branch admin", email: "branch-admin@test.invalid", authTokenIdentifier: adminIdentity.tokenIdentifier,
      status: "active", primarySchoolId: defaultSchoolId, createdAt: 1, updatedAt: 1 });
    const adminId = await ctx.db.insert("users", { schoolId, authId: "branch-admin", name: "Branch admin", email: "branch-admin@test.invalid",
      role: "admin", personId, createdAt: 1, updatedAt: 1 });
    const defaultUserId = await ctx.db.insert("users", { schoolId: defaultSchoolId, authId: adminIdentity.subject,
      authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Default admin", email: "default-admin@test.invalid", role: "admin",
      personId, createdAt: 1, updatedAt: 1 });
    for (const [branch, userId, isDefaultBranch] of [[schoolId, adminId, false], [defaultSchoolId, defaultUserId, true]] as const)
      await ctx.db.insert("branchMemberships", { personId, schoolId: branch, legacyUserId: userId, status: "active", isDefaultBranch, joinedAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "Primary", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId, authId: "archive-pupil", name: "Archive pupil", email: "archive-pupil@test.invalid",
      role: "student", createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId, admissionNumber: "ARCHIVE-1", createdAt: 1, updatedAt: 1 });
    return { schoolId, defaultSchoolId, adminId, classId, userId, studentId };
  });
  const admin = t.withIdentity(adminIdentity);
  const args = { schoolId: ids.schoolId, studentId: ids.studentId };
  const addCalendar = () => t.run(async ctx => {
    const sessionId = await ctx.db.insert("academicSessions", { schoolId: ids.schoolId, name: "2026/27", startDate: 1, endDate: Date.now() + 100000,
      isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId: ids.schoolId, sessionId, name: "First", startDate: 2, endDate: Date.now() + 100000,
      isActive: true, createdAt: 1, updatedAt: 1 });
    return { sessionId, termId, classId: ids.classId };
  });
  return { t, ids, admin, args, addCalendar };
}

describe("student archive entry path", () => {
  it("reads the selected non-default profile and commits its combined action only with that branch's admin authority", async () => {
    const f = await archiveFixture(); const tuple = await f.addCalendar();
    expect(await f.admin.query(api.functions.academic.studentEnrollment.getStudentProfile, f.args))
      .toMatchObject({ _id: f.ids.studentId, classId: f.ids.classId, name: "Archive Pupil" });
    const context = await f.admin.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args);
    expect(context).toMatchObject({ schoolId: f.ids.schoolId, schoolName: "Selected branch", canArchiveAndExclude: true,
      offer: { ...tuple, termName: "First", sessionName: "2026/27" } });
    const outsiderIdentity = { subject: "default-only", tokenIdentifier: "https://auth.school.test|default-only" };
    await f.t.run(ctx => ctx.db.insert("users", { schoolId: f.ids.defaultSchoolId, authId: outsiderIdentity.subject,
      authTokenIdentifier: outsiderIdentity.tokenIdentifier, name: "Default only", email: "default-only@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 }));
    const outsider = f.t.withIdentity(outsiderIdentity);
    await expect(outsider.query(api.functions.academic.studentEnrollment.getStudentProfile, f.args)).rejects.toThrow();
    await expect(outsider.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args)).rejects.toThrow();
    await expect(outsider.mutation(api.functions.academic.studentEnrollment.archiveStudent, f.args)).rejects.toThrow();
    await f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, { ...f.args,
      resultExclusion: { ...tuple, reviewedKey: context.offer!.reviewedKey!, reason: "Reviewed current term school departure" } });
    const exclusion = await f.t.run(ctx => ctx.db.query("classResultExclusions").unique());
    expect(exclusion).toMatchObject({ schoolId: f.ids.schoolId, studentId: f.ids.studentId, approvedBy: f.ids.adminId });
    expect(await f.t.run(ctx => ctx.db.query("schoolEnrollmentCounts").collect())).toEqual([]);
  });

  it.each(["missing", "ambiguous", "archived"])("keeps archive-only independent of a %s calendar and context reads write nothing", async calendar => {
    const f = await archiveFixture();
    if (calendar !== "missing") {
      const tuple = await f.addCalendar();
      await f.t.run(async ctx => {
        if (calendar === "archived") await ctx.db.patch(tuple.termId, { isArchived: true });
        else await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: tuple.sessionId,
          name: "Duplicate active", startDate: 2, endDate: 100, isActive: true, createdAt: 1, updatedAt: 1 });
      });
    }
    const context = await f.admin.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args);
    expect(context).toMatchObject({ canArchiveAndExclude: false, offer: null });
    expect(context.unavailableReason).toBeTruthy();
    expect(await f.t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual([]);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.studentId)))?.isArchived).not.toBe(true);
    await f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, f.args);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.studentId)))?.isArchived).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("classResultExclusions").collect())).toEqual([]);
  });

  it.each(["missing calendar", "ambiguous calendar", "archived class"] as const)("returns a recognizable unavailable-offer error for a valid review invalidated by %s", async invalidation => {
    const f = await archiveFixture(); const tuple = await f.addCalendar();
    const reviewed = await f.admin.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args);
    await f.t.run(async ctx => {
      if (invalidation === "missing calendar") await ctx.db.patch(tuple.sessionId, { isActive: false });
      if (invalidation === "ambiguous calendar") await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId,
        sessionId: tuple.sessionId, name: "Second active term", startDate: 3, endDate: Date.now() + 100000,
        isActive: true, createdAt: 1, updatedAt: 1 });
      if (invalidation === "archived class") await ctx.db.patch(f.ids.classId, { isArchived: true });
    });
    const reason = invalidation === "archived class" ? "Current class needs review" : "A unique active academic session and term are required";
    await expect(f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, { ...f.args,
      resultExclusion: { ...tuple, reviewedKey: reviewed.offer!.reviewedKey!, reason: "Reviewed withdrawal this term" },
    })).rejects.toThrow(`Archive offer unavailable: ${reason}`);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.studentId)))?.isArchived).not.toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("classResultExclusions").collect())).toEqual([]);
  });

  it.each(["withdrawn", "graduated"] as const)("does not decrement initialized count for %s archive", async enrollmentStatus => {
    const f = await archiveFixture(); const tuple = await f.addCalendar();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.studentId, { enrollmentStatus });
      await ctx.db.insert("schoolEnrollmentCounts", { schoolId: f.ids.schoolId, currentStudentCount: 0, updatedAt: 1 });
    });
    const context = await f.admin.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args);
    await f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, { ...f.args,
      resultExclusion: { ...tuple, reviewedKey: context.offer!.reviewedKey!, reason: "Reviewed noncurrent student archive" } });
    expect((await f.t.run(ctx => ctx.db.query("schoolEnrollmentCounts").unique()))?.currentStudentCount).toBe(0);
  });

  it.each(["foreign account", "wrong role", "archived account", "promotion disagreement"])("refuses combined %s", async conflict => {
    const f = await archiveFixture(); const tuple = await f.addCalendar();
    await f.t.run(async ctx => {
      if (conflict === "foreign account") await ctx.db.patch(f.ids.userId, { schoolId: f.ids.defaultSchoolId });
      if (conflict === "wrong role") await ctx.db.patch(f.ids.userId, { role: "parent" });
      if (conflict === "archived account") await ctx.db.patch(f.ids.userId, { isArchived: true });
      if (conflict === "promotion disagreement") {
        const otherClass = await ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "Other class", level: "Primary", createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("studentPromotions", { schoolId: f.ids.schoolId, studentId: f.ids.studentId,
          fromClassId: otherClass, toClassId: otherClass, fromSessionId: tuple.sessionId, toSessionId: tuple.sessionId,
          subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "disagreement", createdAt: 1, createdBy: f.ids.adminId });
      }
    });
    if (conflict === "promotion disagreement") {
      expect(await f.admin.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args)).toMatchObject({ canArchiveAndExclude: false });
      await expect(f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, { ...f.args,
        resultExclusion: { ...tuple, reviewedKey: "invalid", reason: "Class disagreement requires review" } })).rejects.toThrow();
      await f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, f.args);
    } else {
      await expect(f.admin.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, f.args)).rejects.toThrow("Student account not found");
      await expect(f.admin.mutation(api.functions.academic.studentEnrollment.archiveStudent, f.args)).rejects.toThrow("Student account not found");
    }
    expect(await f.t.run(ctx => ctx.db.query("classResultExclusions").collect())).toEqual([]);
  });
});

describe("student enrollment registered functions", () => {
  it("keeps a promotion visible in its source/current roster, absent from target/current, and present in target/future", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", {
        name: "Alpha School",
        slug: "alpha-promotion-roster",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const adminId = await ctx.db.insert("users", {
        schoolId,
        authId: adminIdentity.subject,
        authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Admin User",
        email: "admin@alpha.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const studentUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "student-roster-auth",
        authTokenIdentifier: "https://auth.school.test|student-roster-auth",
        name: "Promoted Student",
        email: "student@alpha.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const sourceClassId = await ctx.db.insert("classes", {
        schoolId,
        name: "Primary 5",
        gradeName: "Primary 5",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const targetClassId = await ctx.db.insert("classes", {
        schoolId,
        name: "Primary 6",
        gradeName: "Primary 6",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const currentSessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2025/2026",
        startDate: 100,
        endDate: 200,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const futureSessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2026/2027",
        startDate: 300,
        endDate: 400,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      const futureTermId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: futureSessionId,
        name: "First Term",
        startDate: 300,
        endDate: 330,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      const subjectId = await ctx.db.insert("subjects", {
        schoolId,
        name: "Mathematics",
        code: "MTH",
        createdAt: now,
        updatedAt: now,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId: sourceClassId,
        userId: studentUserId,
        admissionNumber: "ALPHA-001",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      return {
        adminId,
        sourceClassId,
        targetClassId,
        currentSessionId,
        futureSessionId,
        futureTermId,
        subjectId,
        studentId,
      };
    });

    await t.withIdentity(adminIdentity).mutation(api.functions.academic.studentEnrollment.promoteStudents, {
      studentIds: [ids.studentId],
      fromClassId: ids.sourceClassId,
      fromSessionId: ids.currentSessionId,
      toClassId: ids.targetClassId,
      toSessionId: ids.futureSessionId,
      subjectEnrollmentMode: "none",
    });

    const [sourceCurrent, targetCurrent, targetFuture] = await Promise.all([
      t.withIdentity(adminIdentity).query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
        classId: ids.sourceClassId,
        sessionId: ids.currentSessionId,
      }),
      t.withIdentity(adminIdentity).query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
        classId: ids.targetClassId,
        sessionId: ids.currentSessionId,
      }),
      t.withIdentity(adminIdentity).query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
        classId: ids.targetClassId,
        sessionId: ids.futureSessionId,
      }),
    ]);

    expect(sourceCurrent.students).toContainEqual(expect.objectContaining({
      _id: ids.studentId,
      promotionStatus: expect.objectContaining({ isPromoted: true }),
    }));
    expect(targetCurrent.students.map((student) => student._id)).not.toContain(ids.studentId);
    expect(targetFuture.students).toContainEqual(expect.objectContaining({
      _id: ids.studentId,
      promotionStatus: expect.objectContaining({ isPromoted: false }),
    }));

    await t.run(async (ctx) => {
      await ctx.db.patch(ids.currentSessionId, { isActive: false });
      await ctx.db.patch(ids.futureSessionId, { isActive: true });
    });

    const admin = t.withIdentity(adminIdentity);
    const [sourceExamSheet, targetExamSheet, sourceReportRoster, targetReportRoster] =
      await Promise.all([
        admin.query(api.functions.academic.assessmentRecords.getExamEntrySheet, {
          sessionId: ids.futureSessionId,
          termId: ids.futureTermId,
          classId: ids.sourceClassId,
          subjectId: ids.subjectId,
        }),
        admin.query(api.functions.academic.assessmentRecords.getExamEntrySheet, {
          sessionId: ids.futureSessionId,
          termId: ids.futureTermId,
          classId: ids.targetClassId,
          subjectId: ids.subjectId,
        }),
        admin.query(api.functions.academic.reportCards.getStudentsForReportCardBatch, {
          classId: ids.sourceClassId,
          sessionId: ids.futureSessionId,
          termId: ids.futureTermId,
        }),
        admin.query(api.functions.academic.reportCards.getStudentsForReportCardBatch, {
          classId: ids.targetClassId,
          sessionId: ids.futureSessionId,
          termId: ids.futureTermId,
        }),
      ]);

    expect(sourceExamSheet.roster.map((student) => student.studentId)).not.toContain(ids.studentId);
    expect(targetExamSheet.roster.map((student) => student.studentId)).toContain(ids.studentId);
    expect(sourceReportRoster.map((student) => student.studentId)).not.toContain(ids.studentId);
    expect(targetReportRoster.map((student) => student.studentId)).toContain(ids.studentId);

    await admin.mutation(api.functions.academic.studentEnrollment.updateStudent, {
      studentId: ids.studentId,
      classId: ids.sourceClassId,
      confirmClassAssignment: true,
      expectedClassId: ids.targetClassId,
      expectedSessionId: ids.futureSessionId,
    });
    const [targetAfterRestoration, sourceAfterRestoration] = await Promise.all([
      admin.query(api.functions.academic.assessmentRecords.getExamEntrySheet, {
        sessionId: ids.futureSessionId,
        termId: ids.futureTermId,
        classId: ids.targetClassId,
        subjectId: ids.subjectId,
      }),
      admin.query(api.functions.academic.assessmentRecords.getExamEntrySheet, {
        sessionId: ids.futureSessionId,
        termId: ids.futureTermId,
        classId: ids.sourceClassId,
        subjectId: ids.subjectId,
      }),
    ]);
    expect(targetAfterRestoration.roster.map((student) => student.studentId)).not.toContain(ids.studentId);
    expect(sourceAfterRestoration.roster.map((student) => student.studentId)).toContain(ids.studentId);
  });

  it("rejects same-session, backwards, and equal-start-date promotion targets", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Beta School", slug: "beta-promotion-guard", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@beta.test", role: "admin", createdAt: now, updatedAt: now });
      const studentUserId = await ctx.db.insert("users", { schoolId, authId: "student-guard-auth", authTokenIdentifier: "https://auth.school.test|student-guard-auth", name: "Guard Student", email: "student@beta.test", role: "student", createdAt: now, updatedAt: now });
      const sourceClassId = await ctx.db.insert("classes", { schoolId, name: "JSS 1", gradeName: "JSS 1", level: "Secondary", createdAt: now, updatedAt: now });
      const targetClassId = await ctx.db.insert("classes", { schoolId, name: "JSS 2", gradeName: "JSS 2", level: "Secondary", createdAt: now, updatedAt: now });
      const sourceSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Source", startDate: 100, endDate: 200, isActive: true, createdAt: now, updatedAt: now });
      const equalStartSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Equal", startDate: 100, endDate: 250, isActive: false, createdAt: now, updatedAt: now });
      const priorSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Prior", startDate: 50, endDate: 99, isActive: false, createdAt: now, updatedAt: now });
      const studentId = await ctx.db.insert("students", { schoolId, classId: sourceClassId, userId: studentUserId, admissionNumber: "BETA-001", createdAt: now, updatedAt: now });
      return { sourceClassId, targetClassId, sourceSessionId, equalStartSessionId, priorSessionId, studentId };
    });

    const promote = (toSessionId: typeof ids.equalStartSessionId) =>
      t.withIdentity(adminIdentity).mutation(api.functions.academic.studentEnrollment.promoteStudents, {
        studentIds: [ids.studentId],
        fromClassId: ids.sourceClassId,
        fromSessionId: ids.sourceSessionId,
        toClassId: ids.targetClassId,
        toSessionId,
        subjectEnrollmentMode: "none",
      });

    await expect(promote(ids.sourceSessionId)).rejects.toThrow(/upcoming academic session/);
    await expect(promote(ids.equalStartSessionId)).rejects.toThrow(/Cannot promote students backwards/);
    await expect(promote(ids.priorSessionId)).rejects.toThrow(/Cannot promote students backwards/);
  });

  it("graduates through the mutation and removes its staged future promotion", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Gamma School", slug: "gamma-graduation", status: "active", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@gamma.test", role: "admin", createdAt: now, updatedAt: now });
      const studentUserId = await ctx.db.insert("users", { schoolId, authId: "student-graduate-auth", authTokenIdentifier: "https://auth.school.test|student-graduate-auth", name: "Graduate Student", email: "student@gamma.test", role: "student", createdAt: now, updatedAt: now });
      const classId = await ctx.db.insert("classes", { schoolId, name: "SSS 3", gradeName: "SSS 3", level: "Secondary", createdAt: now, updatedAt: now });
      const targetClassId = await ctx.db.insert("classes", { schoolId, name: "Alumni", gradeName: "Alumni", level: "Secondary", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025/2026", startDate: 100, endDate: 200, isActive: true, createdAt: now, updatedAt: now });
      const futureSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/2027", startDate: 300, endDate: 400, isActive: false, createdAt: now, updatedAt: now });
      const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, admissionNumber: "GAMMA-001", createdAt: now, updatedAt: now });
      await ctx.db.insert("schoolEnrollmentCounts", { schoolId, currentStudentCount: 1, updatedAt: now });
      await ctx.db.insert("studentPromotions", { schoolId, studentId, fromClassId: classId, toClassId: targetClassId, fromSessionId: sessionId, toSessionId: futureSessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "staged", createdAt: now, createdBy: adminId });
      return { schoolId, classId, sessionId, studentId };
    });

    const result = await t.withIdentity(adminIdentity).mutation(api.functions.academic.studentEnrollment.graduateStudents, {
      studentIds: [ids.studentId],
      classId: ids.classId,
      sessionId: ids.sessionId,
      graduationDate: 199,
      certificateNumber: " CERT-1 ",
    });
    expect(result).toEqual({ graduatedCount: 1 });

    const state = await t.run(async (ctx) => ({
      student: await ctx.db.get(ids.studentId),
      graduations: await ctx.db.query("studentGraduations").withIndex("by_student_and_session", (q) => q.eq("studentId", ids.studentId).eq("sessionId", ids.sessionId)).collect(),
      promotions: await ctx.db.query("studentPromotions").withIndex("by_student", (q) => q.eq("studentId", ids.studentId)).collect(),
      enrollmentCount: await ctx.db.query("schoolEnrollmentCounts").withIndex("by_school", (q) => q.eq("schoolId", ids.schoolId)).unique(),
    }));
    expect(state.student).toMatchObject({ enrollmentStatus: "graduated", graduatedAt: 199, graduatingSessionId: ids.sessionId });
    expect(state.graduations).toHaveLength(1);
    expect(state.graduations[0]).toMatchObject({ certificateNumber: "CERT-1" });
    expect(state.promotions).toEqual([]);
    expect(state.enrollmentCount?.currentStudentCount).toBe(0);
  });

  it("moves active-session subject selections atomically when an administrator changes a student's class", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", {
        name: "Class Move School",
        slug: "class-move-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("users", {
        schoolId,
        authId: adminIdentity.subject,
        authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Admin User",
        email: "admin@class-move.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const studentUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "class-move-student",
        name: "David Sterling",
        email: "david@class-move.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const sourceClassId = await ctx.db.insert("classes", {
        schoolId,
        name: "Secondary 2",
        gradeName: "Secondary 2",
        level: "Secondary",
        createdAt: now,
        updatedAt: now,
      });
      const targetClassId = await ctx.db.insert("classes", {
        schoolId,
        name: "Secondary 3",
        gradeName: "Secondary 3",
        level: "Secondary",
        createdAt: now,
        updatedAt: now,
      });
      const activeSessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2026/2027",
        startDate: 200,
        endDate: 300,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const historicalSessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2025/2026",
        startDate: 100,
        endDate: 199,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      const commonSubjectId = await ctx.db.insert("subjects", {
        schoolId,
        name: "English",
        code: "ENG",
        createdAt: now,
        updatedAt: now,
      });
      const sourceOnlySubjectId = await ctx.db.insert("subjects", {
        schoolId,
        name: "Basic Science",
        code: "BSC",
        createdAt: now,
        updatedAt: now,
      });
      for (const [classId, subjectId] of [
        [sourceClassId, commonSubjectId],
        [sourceClassId, sourceOnlySubjectId],
        [targetClassId, commonSubjectId],
      ] as const) {
        await ctx.db.insert("classSubjects", {
          schoolId,
          classId,
          subjectId,
          createdAt: now,
          updatedAt: now,
        });
      }
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId: sourceClassId,
        userId: studentUserId,
        admissionNumber: "MOVE-001",
        createdAt: now,
        updatedAt: now,
      });
      for (const subjectId of [commonSubjectId, sourceOnlySubjectId]) {
        await ctx.db.insert("studentSubjectSelections", {
          schoolId,
          studentId,
          classId: sourceClassId,
          subjectId,
          sessionId: activeSessionId,
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.insert("studentSubjectSelections", {
        schoolId,
        studentId,
        classId: sourceClassId,
        subjectId: sourceOnlySubjectId,
        sessionId: historicalSessionId,
        createdAt: now,
        updatedAt: now,
      });
      return {
        studentId,
        sourceClassId,
        targetClassId,
        activeSessionId,
        historicalSessionId,
        commonSubjectId,
        sourceOnlySubjectId,
      };
    });

    const viewer = t.withIdentity(adminIdentity);
    await viewer.mutation(api.functions.academic.studentEnrollment.updateStudent, {
      studentId: ids.studentId,
      classId: ids.targetClassId,
      confirmClassAssignment: true,
      expectedClassId: ids.sourceClassId,
      expectedSessionId: ids.activeSessionId,
    });
    await viewer.mutation(api.functions.academic.studentEnrollment.updateStudent, {
      studentId: ids.studentId,
      classId: ids.targetClassId,
    });

    const [sourceActive, targetActive, sourceHistorical, state] = await Promise.all([
      viewer.query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
        classId: ids.sourceClassId,
        sessionId: ids.activeSessionId,
      }),
      viewer.query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
        classId: ids.targetClassId,
        sessionId: ids.activeSessionId,
      }),
      viewer.query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
        classId: ids.sourceClassId,
        sessionId: ids.historicalSessionId,
      }),
      t.run(async (ctx) => ({
        student: await ctx.db.get(ids.studentId),
        activeSelections: await ctx.db
          .query("studentSubjectSelections")
          .withIndex("by_student_and_session", (q) =>
            q.eq("studentId", ids.studentId).eq("sessionId", ids.activeSessionId),
          )
          .collect(),
        historicalSelections: await ctx.db
          .query("studentSubjectSelections")
          .withIndex("by_student_and_session", (q) =>
            q.eq("studentId", ids.studentId).eq("sessionId", ids.historicalSessionId),
          )
          .collect(),
      })),
    ]);

    expect(sourceActive.students.map((student) => student._id)).not.toContain(ids.studentId);
    expect(targetActive.students.map((student) => student._id)).toEqual([ids.studentId]);
    expect(sourceHistorical.students.map((student) => student._id)).toEqual([ids.studentId]);
    expect(state.student).toMatchObject({ classId: ids.targetClassId });
    expect(state.activeSelections).toEqual([
      expect.objectContaining({
        classId: ids.targetClassId,
        subjectId: ids.commonSubjectId,
      }),
    ]);
    expect(state.historicalSelections).toEqual([
      expect.objectContaining({
        classId: ids.sourceClassId,
        subjectId: ids.sourceOnlySubjectId,
      }),
    ]);
  });

  it("suppresses archived student accounts from the roster and reconciles their active student records", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Roster School", slug: "archived-roster", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@roster.test", role: "admin", createdAt: now, updatedAt: now });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "Primary", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/2027", startDate: 100, endDate: 200, isActive: true, createdAt: now, updatedAt: now });
      const activeUserId = await ctx.db.insert("users", { schoolId, authId: "active-roster-student", authTokenIdentifier: "https://auth.school.test|active-roster-student", name: "Active Student", email: "active@roster.test", role: "student", createdAt: now, updatedAt: now });
      const archivedUserId = await ctx.db.insert("users", { schoolId, authId: "archived-roster-student", authTokenIdentifier: "https://auth.school.test|archived-roster-student", name: "Archived Student", email: "archived@roster.test", role: "student", isArchived: true, archivedAt: now, createdAt: now, updatedAt: now });
      const reverseDesyncedUserId = await ctx.db.insert("users", { schoolId, authId: "reverse-desynced-student", authTokenIdentifier: "https://auth.school.test|reverse-desynced-student", name: "Reverse Desynced Student", email: "reverse@roster.test", role: "student", createdAt: now, updatedAt: now });
      const activeStudentId = await ctx.db.insert("students", { schoolId, classId, userId: activeUserId, admissionNumber: "ROSTER-001", createdAt: now, updatedAt: now });
      const desyncedStudentId = await ctx.db.insert("students", { schoolId, classId, userId: archivedUserId, admissionNumber: "ROSTER-002", createdAt: now, updatedAt: now });
      const reverseDesyncedStudentId = await ctx.db.insert("students", { schoolId, classId, userId: reverseDesyncedUserId, admissionNumber: "ROSTER-003", isArchived: true, archivedAt: now, createdAt: now, updatedAt: now });
      return { classId, sessionId, activeStudentId, desyncedStudentId, reverseDesyncedStudentId, reverseDesyncedUserId };
    });

    const roster = await t.withIdentity(adminIdentity).query(api.functions.academic.studentEnrollment.getClassStudentSubjectMatrix, {
      classId: ids.classId,
      sessionId: ids.sessionId,
    });
    expect(roster.students.map((student) => student._id)).toEqual([ids.activeStudentId]);

    const reconciliation = await t.withIdentity(adminIdentity).mutation(api.functions.academic.studentEnrollment.reconcileArchivedStudents, {});
    expect(reconciliation.reconciledStudents).toEqual(expect.arrayContaining([
      expect.objectContaining({ studentId: ids.desyncedStudentId }),
      expect.objectContaining({ studentId: ids.reverseDesyncedStudentId }),
    ]));
    const reconciled = await t.run(async (ctx) => ({
      student: await ctx.db.get(ids.desyncedStudentId),
      user: await ctx.db.get(ids.reverseDesyncedUserId),
    }));
    expect(reconciled.student).toMatchObject({ isArchived: true });
    expect(reconciled.user).toMatchObject({ isArchived: true });
  });

  it("reviews normalized parent email only within the authenticated tenant", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Delta School", slug: "delta-parent-review", status: "active", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@delta.test", role: "admin", createdAt: now, updatedAt: now });
      const parentId = await ctx.db.insert("users", { schoolId, authId: "parent-auth", authTokenIdentifier: "https://auth.school.test|parent-auth", name: "Parent User", email: "parent+family@sub.delta.test", role: "parent", createdAt: now, updatedAt: now });
      const familyId = await ctx.db.insert("families", { schoolId, name: "Delta Family", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const otherSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "other-parent-review", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId: otherSchoolId, authId: "other-parent-auth", authTokenIdentifier: "https://auth.school.test|other-parent-auth", name: "Other Parent", email: "parent+family@sub.delta.test", role: "parent", createdAt: now, updatedAt: now });
      return { parentId, familyId };
    });

    const review = await t.withIdentity(adminIdentity).query(api.functions.academic.studentEnrollment.getParentEmailReview, { email: " Parent+Family@sub.delta.test " });
    expect(review).toMatchObject({ email: "parent+family@sub.delta.test" });
    expect(review.matches).toEqual([expect.objectContaining({ userId: ids.parentId, families: [expect.objectContaining({ _id: ids.familyId })] })]);

    await expect(t.withIdentity(adminIdentity).query(api.functions.academic.studentEnrollment.getParentEmailReview, { email: "not-an-email" })).resolves.toEqual({ email: "not-an-email", matches: [] });
  });

  it("preserves existing member relationship when linking student without a specified relationship", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Echo School", slug: "echo-family-link", status: "active", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@echo.test", role: "admin", createdAt: now, updatedAt: now });
      const parentId = await ctx.db.insert("users", { schoolId, authId: "parent-echo-auth", authTokenIdentifier: "https://auth.school.test|parent-echo-auth", name: "Grace Adeyemi", email: "parent@echo.test", role: "parent", createdAt: now, updatedAt: now });
      const familyId = await ctx.db.insert("families", { schoolId, name: "Adeyemi Family", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const existingMemberId = await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, relationship: "Mother", isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "Primary", createdAt: now, updatedAt: now });
      const studentUserId = await ctx.db.insert("users", { schoolId, authId: "student-echo-auth", authTokenIdentifier: "https://auth.school.test|student-echo-auth", name: "Synthetic Pupil", email: "pupil@echo.test", role: "student", createdAt: now, updatedAt: now });
      const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, admissionNumber: "QA-ECHO-001", familyId, createdAt: now, updatedAt: now });
      return { parentId, familyId, existingMemberId, studentId };
    });

    const result = await t.withIdentity(adminIdentity).mutation(api.functions.academic.studentEnrollment.upsertStudentFamilyLink, {
      studentId: ids.studentId,
      email: "parent@echo.test",
      firstName: "Grace",
      lastName: "Adeyemi",
      confirmDuplicateLink: true,
    });

    expect(result.familyMemberId).toBe(ids.existingMemberId);
    const member = await t.run(async (ctx) => ctx.db.get(ids.existingMemberId));
    expect(member?.relationship).toBe("Mother");
  });
});
