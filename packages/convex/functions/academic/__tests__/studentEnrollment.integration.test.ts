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
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId: sourceClassId,
        userId: studentUserId,
        admissionNumber: "ALPHA-001",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      return { adminId, sourceClassId, targetClassId, currentSessionId, futureSessionId, studentId };
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
      await ctx.db.insert("studentPromotions", { schoolId, studentId, fromClassId: classId, toClassId: targetClassId, fromSessionId: sessionId, toSessionId: futureSessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "staged", createdAt: now, createdBy: adminId });
      return { classId, sessionId, studentId };
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
    }));
    expect(state.student).toMatchObject({ enrollmentStatus: "graduated", graduatedAt: 199, graduatingSessionId: ids.sessionId });
    expect(state.graduations).toHaveLength(1);
    expect(state.graduations[0]).toMatchObject({ certificateNumber: "CERT-1" });
    expect(state.promotions).toEqual([]);
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
});
