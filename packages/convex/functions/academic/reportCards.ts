import { query } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
  teacherHasClassAccess,
} from "./auth";
import { normalizeHumanName, normalizePersonName } from "@school/shared/name-format";

export const getStudentReportCard = query({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.object({
    schoolName: v.string(),
    sessionName: v.string(),
    termName: v.string(),
    className: v.string(),
    generatedAt: v.number(),
    student: v.object({
      _id: v.id("students"),
      name: v.string(),
      admissionNumber: v.string(),
      gender: v.union(v.string(), v.null()),
      dateOfBirth: v.union(v.number(), v.null()),
      guardianName: v.union(v.string(), v.null()),
      guardianPhone: v.union(v.string(), v.null()),
      address: v.union(v.string(), v.null()),
      photoUrl: v.union(v.string(), v.null()),
    }),
    summary: v.object({
      totalSubjects: v.number(),
      averageScore: v.union(v.number(), v.null()),
    }),
    results: v.array(
      v.object({
        subjectId: v.id("subjects"),
        subjectName: v.string(),
        subjectCode: v.string(),
        ca1: v.number(),
        ca2: v.number(),
        ca3: v.number(),
        examRawScore: v.number(),
        examScaledScore: v.number(),
        total: v.number(),
        gradeLetter: v.string(),
        remark: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);

    const [student, session, term, school] = await Promise.all([
      ctx.db.get(args.studentId),
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
      ctx.db.get(schoolId),
    ]);

    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Student not found");
    }
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== schoolId) {
      throw new ConvexError("Term not found");
    }
    if (!school) {
      throw new ConvexError("School not found");
    }

    const records = await ctx.db
      .query("assessmentRecords")
      .withIndex("by_student_and_term", (q) =>
        q
          .eq("schoolId", schoolId)
          .eq("studentId", args.studentId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
      )
      .collect();

    if (records.length === 0) {
      throw new ConvexError(
        "No report card data is available for this student in the selected term"
      );
    }

    const reportCardClassId = records[0]?.classId ?? student.classId;

    if (role === "teacher") {
      const hasClassAccess = await teacherHasClassAccess(
        ctx,
        userId,
        schoolId,
        reportCardClassId
      );
      if (!hasClassAccess) {
        throw new ConvexError("Not assigned to this class");
      }
    } else {
      await assertAdminForSchool(ctx, userId, schoolId, role);
    }

    const [studentUser, classDoc, photoUrl] = await Promise.all([
      ctx.db.get(student.userId),
      ctx.db.get(reportCardClassId),
      student.photoStorageId ? ctx.storage.getUrl(student.photoStorageId) : null,
    ]);

    const results = (
      await Promise.all(
        records.map(async (record) => {
          const subject = await ctx.db.get(record.subjectId);
          return {
            subjectId: record.subjectId,
            subjectName: normalizeHumanName(subject?.name ?? "Unknown Subject"),
            subjectCode: subject?.code ?? "---",
            ca1: record.ca1,
            ca2: record.ca2,
            ca3: record.ca3,
            examRawScore: record.examRawScore,
            examScaledScore: record.examScaledScore,
            total: record.total,
            gradeLetter: record.gradeLetter,
            remark: record.remark,
          };
        })
      )
    ).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const totalScore = results.reduce((sum, result) => sum + result.total, 0);

    return {
      schoolName: normalizeHumanName(school.name),
      sessionName: normalizeHumanName(session.name),
      termName: normalizeHumanName(term.name),
      className: normalizeHumanName(classDoc?.name ?? "Unknown Class"),
      generatedAt: Date.now(),
      student: {
        _id: student._id,
        name: normalizePersonName(studentUser?.name ?? "Unnamed Student"),
        admissionNumber: student.admissionNumber,
        gender: student.gender ?? null,
        dateOfBirth: student.dateOfBirth ?? null,
        guardianName: student.guardianName ?? null,
        guardianPhone: student.guardianPhone ?? null,
        address: student.address ?? null,
        photoUrl,
      },
      summary: {
        totalSubjects: results.length,
        averageScore: results.length > 0 ? totalScore / results.length : null,
      },
      results,
    };
  },
});
