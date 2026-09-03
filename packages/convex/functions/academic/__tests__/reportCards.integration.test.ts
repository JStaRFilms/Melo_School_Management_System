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
  subject: "report-card-regression-admin",
  tokenIdentifier: "https://auth.school.test|report-card-regression-admin",
};

describe("report card registered functions", () => {
  it("uses the form teacher assigned to the requested historical session", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", {
        name: "Report School",
        slug: "historical-report-teacher",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const adminId = await ctx.db.insert("users", {
        schoolId,
        authId: adminIdentity.subject,
        authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Admin User",
        email: "admin@reports.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const currentTeacherId = await ctx.db.insert("users", {
        schoolId,
        authId: "current-report-teacher-auth",
        authTokenIdentifier: "https://auth.school.test|current-report-teacher-auth",
        name: "Current Teacher",
        email: "current@reports.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      const historicalTeacherId = await ctx.db.insert("users", {
        schoolId,
        authId: "historical-report-teacher-auth",
        authTokenIdentifier: "https://auth.school.test|historical-report-teacher-auth",
        name: "Historical Teacher",
        email: "historical@reports.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      const studentUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "report-student-auth",
        authTokenIdentifier: "https://auth.school.test|report-student-auth",
        name: "Report Student",
        email: "student@reports.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId,
        name: "JSS 2",
        gradeName: "JSS 2",
        level: "Secondary",
        formTeacherId: currentTeacherId,
        createdAt: now,
        updatedAt: now,
      });
      const historicalSessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2024/2025",
        startDate: 100,
        endDate: 200,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: historicalSessionId,
        name: "Third Term",
        startDate: 150,
        endDate: 200,
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
      await ctx.db.insert("classSubjects", {
        schoolId,
        classId,
        subjectId,
        createdAt: now,
        updatedAt: now,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId,
        userId: studentUserId,
        admissionNumber: "REPORT-001",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("studentSubjectSelections", {
        schoolId,
        studentId,
        classId,
        subjectId,
        sessionId: historicalSessionId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("classSessionFormTeachers", {
        schoolId,
        classId,
        sessionId: historicalSessionId,
        formTeacherId: historicalTeacherId,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });
      return { studentId, classId, historicalSessionId, termId };
    });

    const reportCard = await t.withIdentity(adminIdentity).query(api.functions.academic.reportCards.getStudentReportCard, {
      studentId: ids.studentId,
      classId: ids.classId,
      sessionId: ids.historicalSessionId,
      termId: ids.termId,
    });

    expect(reportCard.classTeacherName).toBe("Historical Teacher");
  });
});
