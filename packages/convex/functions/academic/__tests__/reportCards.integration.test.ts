import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import { reportCardReviewKey } from "@school/shared/exam-recording";
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
  it("uses the session form teacher and omits unsafe report images", async () => {
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
        role: "teacher",
        isSchoolAdmin: true,
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
        endDate: Date.now() + 60_000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: historicalSessionId,
        name: "Third Term",
        startDate: 150,
        endDate: Date.now() + 60_000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const otherSessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2025/2026",
        startDate: 100,
        endDate: Date.now() + 60_000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const otherTermId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId: otherSessionId,
        name: "First Term",
        startDate: 150,
        endDate: Date.now() + 60_000,
        isActive: true,
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
      const conflictingImageStorageId = await ctx.storage.store(
        new Blob(["legacy-shared-image"], { type: "image/png" }),
      );
      await ctx.db.patch(schoolId, { logoStorageId: conflictingImageStorageId });
      await ctx.db.patch(studentId, { photoStorageId: conflictingImageStorageId });
      await ctx.db.insert("studentSubjectSelections", {
        schoolId,
        studentId,
        classId,
        subjectId,
        sessionId: historicalSessionId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("gradingBands", {
        schoolId,
        minScore: 0,
        maxScore: 100,
        gradeLetter: "A",
        remark: "Pass",
        isActive: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });
      await ctx.db.insert("assessmentRecords", {
        schoolId,
        sessionId: historicalSessionId,
        termId,
        classId,
        subjectId,
        studentId,
        ca1: 10,
        ca2: 10,
        ca3: 10,
        examRawScore: 45,
        examScaledScore: 45,
        total: 75,
        gradeLetter: "A",
        remark: "Pass",
        examInputModeSnapshot: "raw_70",
        examRawMaxSnapshot: 70,
        status: "draft",
        enteredBy: adminId,
        updatedBy: adminId,
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
      return { adminId, schoolId, studentId, classId, historicalSessionId, termId, otherSessionId, otherTermId };
    });

    const reportCard = await t.withIdentity(adminIdentity).query(api.functions.academic.reportCards.getStudentReportCard, {
      studentId: ids.studentId,
      classId: ids.classId,
      sessionId: ids.historicalSessionId,
      termId: ids.termId,
    });

    expect(reportCard.classTeacherName).toBe("Historical Teacher");
    expect(reportCard.schoolLogoUrl).toBeNull();
    expect(reportCard.student.photoUrl).toBeNull();

    const admin = t.withIdentity(adminIdentity);
    const roster = await admin.query(
      api.functions.academic.reportCards.getStudentsForReportCardBatch,
      {
        classId: ids.classId,
        sessionId: ids.historicalSessionId,
        termId: ids.termId,
      },
    );
    expect(roster).toHaveLength(1);
    expect(roster[0]?.passportUrl).toBeNull();

    const classReports = await admin.query(
      api.functions.academic.reportCards.getClassReportCards,
      {
        classId: ids.classId,
        sessionId: ids.historicalSessionId,
        termId: ids.termId,
      },
    );
    expect(classReports).toHaveLength(1);
    expect(classReports[0]?.student.photoUrl).toBeNull();

    await admin.mutation(
      api.functions.academic.reportCards.certifyStudentReportCard,
      {
        studentId: ids.studentId,
        classId: ids.classId,
        sessionId: ids.historicalSessionId,
        termId: ids.termId,
        confirmation: "REPORT-001",
        reviewedKey: reportCardReviewKey(reportCard),
      },
    );
    await t.run(async (ctx) => {
      const certified = await ctx.db
        .query("issuedReportCards")
        .withIndex("by_student_session_term_class", (q) =>
          q
            .eq("studentId", ids.studentId)
            .eq("sessionId", ids.historicalSessionId)
            .eq("termId", ids.termId)
            .eq("classId", ids.classId),
        )
        .unique();
      expect(certified?.schoolLogoStorageId).toBeUndefined();
      expect(certified?.studentPhotoStorageId).toBeUndefined();
      if (certified) await ctx.db.delete(certified._id);
    });

    const gradingPolicy = reportCard.gradingPolicy;
    if (!gradingPolicy) throw new Error("Expected grading policy");
    const issuedReportId = await t.run(async (ctx) => {
      return await ctx.db.insert("issuedReportCards", {
        schoolId: ids.schoolId,
        studentId: ids.studentId,
        sessionId: ids.historicalSessionId,
        termId: ids.termId,
        classId: ids.classId,
        issuedAt: 2,
        issuedBy: ids.adminId,
        report: {
          ...reportCard,
          certifiedAt: 2,
          schoolLogoUrl: "https://legacy.invalid/logo.png",
          student: {
            ...reportCard.student,
            photoUrl: "https://legacy.invalid/student.png",
          },
          gradingPolicy: {
            ...gradingPolicy,
            source: "snapshot",
          },
        },
      });
    });

    const issuedReport = await admin.query(
      api.functions.academic.reportCards.getStudentReportCard,
      {
        studentId: ids.studentId,
        classId: ids.classId,
        sessionId: ids.historicalSessionId,
        termId: ids.termId,
      },
    );
    expect(issuedReport.schoolLogoUrl).toBeNull();
    expect(issuedReport.student.photoUrl).toBeNull();
    await t.run(ctx => ctx.db.insert("sessionScoringPolicies", {
      schoolId: ids.schoolId, sessionId: ids.historicalSessionId, version: 1,
      ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 50,
      examContributionMax: 50, updatedAt: 3, updatedBy: ids.adminId,
    }));
    const stale = await admin.query(api.functions.academic.reportCards.getStudentReportCard, {
      studentId: ids.studentId, classId: ids.classId,
      sessionId: ids.historicalSessionId, termId: ids.termId,
    });
    expect(stale.scoringPolicyWarning).toMatch(/Replacement certification.*not available/);
    // The fixture deliberately gives the school and student the same unsafe
    // storage object. Portal identity listing rejects that conflict before
    // reaching the report, so detach it after the image-safety assertions.
    await t.run(async ctx => {
      await ctx.db.patch(ids.schoolId, { logoStorageId: undefined });
      await ctx.db.patch(ids.studentId, { photoStorageId: undefined });
    });
    const portal = await t.withIdentity({ subject: "report-student-auth",
      tokenIdentifier: "https://auth.school.test|report-student-auth" })
      .query(api.functions.portal.getWorkspaceData, { studentId: ids.studentId,
        sessionId: ids.historicalSessionId, termId: ids.termId });
    expect(portal.selectedReportCard?.scoringPolicyWarning).toMatch(/issued report is unchanged/);
    expect(portal.selectedReportCard?.results).toEqual(issuedReport.results);
    const printWarning = await admin.query(api.functions.academic.reportCards.getIssuedReportScoringWarning, {
      studentId: ids.studentId, classId: ids.classId,
      sessionId: ids.historicalSessionId, termId: ids.termId,
    });
    expect(printWarning).toMatchObject({ stale: true, message: expect.stringMatching(/Replacement certification.*not available/) });
    const lockedJobId = await t.run(ctx => ctx.db.insert("sessionScoringRegradeJobs", {
      schoolId: ids.schoolId, sessionId: ids.historicalSessionId, phase: "scanning",
      policy: { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 50, examContributionMax: 50 },
      before: { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 },
      expectedVersion: 1, scanned: 1, batchSize: 40, invalidCount: 1, invalidExamples: [],
      updated: 0, startedAt: 3, updatedAt: 3, updatedBy: ids.adminId,
    }));
    const issuedArgs = {
      studentId: ids.studentId, classId: ids.classId,
      sessionId: ids.historicalSessionId, termId: ids.termId,
    };
    const otherArgs = {
      studentId: ids.studentId, classId: ids.classId,
      sessionId: ids.otherSessionId, termId: ids.otherTermId,
    };
    for (const phase of ["scanning", "regrading"] as const) {
      await t.run(ctx => ctx.db.patch(lockedJobId, { phase }));
      await expect(admin.query(api.functions.academic.reportCards.getStudentReportCard, issuedArgs))
        .rejects.toThrow(/Session scoring regrade/);
      await expect(admin.query(api.functions.academic.reportCards.getIssuedReportScoringWarning, issuedArgs))
        .rejects.toThrow(/Session scoring regrade/);
      await expect(admin.query(api.functions.academic.reportCards.getClassReportCards, {
        classId: ids.classId, sessionId: ids.historicalSessionId, termId: ids.termId,
      })).rejects.toThrow(/Session scoring regrade/);
      const lockedPortal = await t.withIdentity({ subject: "report-student-auth",
        tokenIdentifier: "https://auth.school.test|report-student-auth" })
        .query(api.functions.portal.getWorkspaceData, { studentId: ids.studentId,
          sessionId: ids.historicalSessionId, termId: ids.termId });
      expect(lockedPortal.selectedReportCard).toBeNull();
      expect((await admin.query(api.functions.academic.reportCards.getStudentReportCard, otherArgs)).certifiedAt)
        .toBeUndefined();
    }
    await t.run(ctx => ctx.db.patch(lockedJobId, { phase: "complete" }));
    const afterRegrade = await admin.query(api.functions.academic.reportCards.getStudentReportCard, issuedArgs);
    expect(afterRegrade.results).toEqual(issuedReport.results);
    expect(afterRegrade.certifiedAt).toBe(issuedReport.certifiedAt);
    expect(afterRegrade.scoringPolicyWarning).toMatch(/issued report is unchanged/);
    expect(await admin.query(api.functions.academic.reportCards.getIssuedReportScoringWarning, issuedArgs))
      .toMatchObject({ stale: true, message: expect.stringMatching(/issued copy is unchanged/) });
    expect((await t.run(ctx => ctx.db.get(issuedReportId)))?.report.scoringPolicyWarning).toBeUndefined();
    await expect(admin.mutation(api.functions.academic.reportCards.certifyStudentReportCard, {
      studentId: ids.studentId, classId: ids.classId, sessionId: ids.historicalSessionId,
      termId: ids.termId, confirmation: "REPORT-001", reviewedKey: reportCardReviewKey(reportCard),
    })).rejects.toThrow(/Replacement certification.*not available/);

    await t.run(async (ctx) => {
      const assetBoundStorageId = await ctx.storage.store(
        new Blob(["asset-bound-image"], { type: "image/png" }),
      );
      await ctx.db.insert("assetUploadIntents", {
        schoolId: ids.schoolId,
        requestedByUserId: ids.adminId,
        storageId: assetBoundStorageId,
        status: "finalized",
        createdAt: 3,
        updatedAt: 3,
      });
      await ctx.db.patch(issuedReportId, {
        schoolLogoStorageId: assetBoundStorageId,
      });
    });

    const assetBoundIssuedReport = await admin.query(
      api.functions.academic.reportCards.getStudentReportCard,
      {
        studentId: ids.studentId,
        classId: ids.classId,
        sessionId: ids.historicalSessionId,
        termId: ids.termId,
      },
    );
    expect(assetBoundIssuedReport.schoolLogoUrl).toBeNull();
  });
});
