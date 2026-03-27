import { mutation, query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
  teacherHasClassAccess,
} from "./auth";
import {
  formatClassDisplayName,
  normalizeHumanName,
  normalizePersonName,
} from "@school/shared/name-format";

const DEFAULT_CA_MAX = 20;
const DEFAULT_EXAM_MAX = 40;
const MAX_COMMENT_LENGTH = 1000;

function buildClassName(classDoc: {
  gradeName?: string | null;
  classLabel?: string | null;
  name: string;
}) {
  return formatClassDisplayName({
    gradeName: classDoc.gradeName,
    classLabel: classDoc.classLabel,
    name: classDoc.name,
  });
}

function normalizeOptionalComment(value: string | null | undefined) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new ConvexError(
      `Comments cannot be longer than ${MAX_COMMENT_LENGTH} characters`
    );
  }
  return trimmed;
}

const reportCardBatchStudentValidator = v.object({
  studentId: v.id("students"),
  studentName: v.string(),
  admissionNumber: v.string(),
});

const reportCardResultValidator = v.object({
  schoolName: v.string(),
  schoolLogoUrl: v.union(v.string(), v.null()),
  sessionName: v.string(),
  termName: v.string(),
  classId: v.id("classes"),
  className: v.string(),
  generatedAt: v.number(),
  assessmentConfig: v.object({
    ca1Max: v.number(),
    ca2Max: v.number(),
    ca3Max: v.number(),
    examMax: v.number(),
  }),
  student: v.object({
    _id: v.id("students"),
    name: v.string(),
    admissionNumber: v.string(),
    gender: v.union(v.string(), v.null()),
    dateOfBirth: v.union(v.number(), v.null()),
    guardianName: v.union(v.string(), v.null()),
    guardianPhone: v.union(v.string(), v.null()),
    address: v.union(v.string(), v.null()),
    houseName: v.union(v.string(), v.null()),
    nextTermBegins: v.union(v.number(), v.null()),
    photoUrl: v.union(v.string(), v.null()),
  }),
  summary: v.object({
    totalSubjects: v.number(),
    recordedSubjects: v.number(),
    pendingSubjects: v.number(),
    averageScore: v.union(v.number(), v.null()),
    totalScore: v.number(),
  }),
  results: v.array(
    v.object({
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      subjectCode: v.string(),
      ca1: v.number(),
      ca2: v.number(),
      ca3: v.number(),
      examScore: v.number(),
      total: v.number(),
      gradeLetter: v.string(),
      remark: v.string(),
      isRecorded: v.boolean(),
    })
  ),
  classTeacherName: v.union(v.string(), v.null()),
  classTeacherComment: v.union(v.string(), v.null()),
  headTeacherComment: v.union(v.string(), v.null()),
});

async function assertClassReportCardAccess(
  ctx: any,
  args: {
    userId: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
  }
) {
  const [classDoc, session, term] = await Promise.all([
    ctx.db.get(args.classId),
    ctx.db.get(args.sessionId),
    ctx.db.get(args.termId),
  ]);

  if (!classDoc || classDoc.schoolId !== args.schoolId) {
    throw new ConvexError("Class not found");
  }
  if (!session || session.schoolId !== args.schoolId) {
    throw new ConvexError("Session not found");
  }
  if (
    !term ||
    term.schoolId !== args.schoolId ||
    term.sessionId !== args.sessionId
  ) {
    throw new ConvexError("Term not found");
  }

  if (args.role === "teacher") {
    const hasClassAccess = await teacherHasClassAccess(
      ctx,
      args.userId,
      args.schoolId,
      args.classId
    );
    if (!hasClassAccess) {
      throw new ConvexError("Not assigned to this class");
    }
    return;
  }

  await assertAdminForSchool(ctx, args.userId, args.schoolId, args.role);
}

async function getStudentsForClassReportCardBatch(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
  }
) {
  const [currentStudents, selectionDocs] = await Promise.all([
    ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("classId", args.classId)
      )
      .collect(),
    ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_class_and_session", (q: any) =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId)
      )
      .collect(),
  ]);

  const studentIds = new Set<string>();
  for (const student of currentStudents) {
    studentIds.add(String(student._id));
  }
  for (const selection of selectionDocs) {
    studentIds.add(String(selection.studentId));
  }

  const students = (
    await Promise.all(
      Array.from(studentIds).map(async (studentId) =>
        ctx.db.get(studentId as Id<"students">)
      )
    )
  ).filter(
    (
      student
    ): student is Exclude<typeof student, null> =>
      student !== null && student.schoolId === args.schoolId
  );

  const roster = await Promise.all(
    students.map(async (student) => {
      const studentUser = await ctx.db.get(student.userId);
      return {
        studentId: student._id,
        studentName: normalizePersonName(studentUser?.name ?? "Unnamed Student"),
        admissionNumber: student.admissionNumber,
      };
    })
  );

  return roster.sort((a, b) => {
    const byName = a.studentName.localeCompare(b.studentName);
    if (byName !== 0) return byName;
    return a.admissionNumber.localeCompare(b.admissionNumber);
  });
}

async function buildStudentReportCard(
  ctx: any,
  args: {
    userId: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    studentId: Id<"students">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
    preferredClassId?: Id<"classes">;
    skipRoleCheck?: boolean;
  }
) {
  const [student, session, term, school] = await Promise.all([
    ctx.db.get(args.studentId),
    ctx.db.get(args.sessionId),
    ctx.db.get(args.termId),
    ctx.db.get(args.schoolId),
  ]);

  if (!student || student.schoolId !== args.schoolId) {
    throw new ConvexError("Student not found");
  }
  if (!session || session.schoolId !== args.schoolId) {
    throw new ConvexError("Session not found");
  }
  if (!term || term.schoolId !== args.schoolId || term.sessionId !== args.sessionId) {
    throw new ConvexError("Term not found");
  }
  if (!school) {
    throw new ConvexError("School not found");
  }

  const records = await ctx.db
    .query("assessmentRecords")
    .withIndex("by_student_and_term", (q: any) =>
      q
        .eq("schoolId", args.schoolId)
        .eq("studentId", args.studentId)
        .eq("sessionId", args.sessionId)
        .eq("termId", args.termId)
    )
    .collect();

  const reportCardClassId =
    records[0]?.classId ?? args.preferredClassId ?? student.classId;

  if (!args.skipRoleCheck) {
    if (args.role === "teacher") {
      const hasClassAccess = await teacherHasClassAccess(
        ctx,
        args.userId,
        args.schoolId,
        reportCardClassId
      );
      if (!hasClassAccess) {
        throw new ConvexError("Not assigned to this class");
      }
    } else {
      await assertAdminForSchool(ctx, args.userId, args.schoolId, args.role);
    }
  }

  const [
    studentUser,
    classDoc,
    photoUrl,
    schoolLogoUrl,
    selectionDocs,
    classSubjectDocs,
    settings,
    reportCardComment,
  ] = await Promise.all([
    ctx.db.get(student.userId),
    ctx.db.get(reportCardClassId),
    student.photoStorageId ? ctx.storage.getUrl(student.photoStorageId) : null,
    school.logoStorageId ? ctx.storage.getUrl(school.logoStorageId) : null,
    ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_session", (q: any) =>
        q.eq("studentId", args.studentId).eq("sessionId", args.sessionId)
      )
      .collect(),
    ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q: any) => q.eq("classId", reportCardClassId))
      .collect(),
    ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true)
      )
      .first(),
    ctx.db
      .query("reportCardComments")
      .withIndex("by_student_session_term", (q: any) =>
        q
          .eq("studentId", args.studentId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
      )
      .unique(),
  ]);

  if (!classDoc || classDoc.schoolId !== args.schoolId) {
    throw new ConvexError("Class not found");
  }

  const classTeacher =
    classDoc.formTeacherId &&
    String(classDoc.formTeacherId) !== String(student.userId)
      ? await ctx.db.get(classDoc.formTeacherId)
      : null;

  const subjectIds = new Set(
    (
      selectionDocs.length > 0
        ? selectionDocs.map((selection: any) => selection.subjectId)
        : classSubjectDocs.map((classSubject: any) => classSubject.subjectId)
    ).concat(records.map((record: any) => record.subjectId))
  );

  if (subjectIds.size === 0) {
    throw new ConvexError(
      "No subjects are configured for this student in the selected session"
    );
  }

  const subjects = (
    await Promise.all(
      Array.from(subjectIds).map((subjectId) => ctx.db.get(subjectId))
    )
  ).filter(
    (
      subject
    ): subject is Exclude<typeof subject, null> =>
      subject !== null && subject.schoolId === args.schoolId
  );

  if (subjects.length === 0) {
    throw new ConvexError("No subjects found for this report card");
  }

  const recordsBySubjectId = new Map<Id<"subjects">, any>(
    records.map((record: any) => [record.subjectId, record] as const)
  );

  const results = subjects
    .map((subject) => {
      const record = recordsBySubjectId.get(subject._id);

      if (!record) {
        return {
          subjectId: subject._id,
          subjectName: normalizeHumanName(subject.name),
          subjectCode: subject.code,
          ca1: 0,
          ca2: 0,
          ca3: 0,
          examScore: 0,
          total: 0,
          gradeLetter: "-",
          remark: "Pending",
          isRecorded: false,
        };
      }

      return {
        subjectId: subject._id,
        subjectName: normalizeHumanName(subject.name),
        subjectCode: subject.code,
        ca1: record.ca1,
        ca2: record.ca2,
        ca3: record.ca3,
        examScore: record.examScaledScore,
        total: record.total,
        gradeLetter: record.gradeLetter,
        remark: record.remark,
        isRecorded: true,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const totalScore = results.reduce((sum, result) => sum + result.total, 0);
  const recordedSubjects = results.filter((result) => result.isRecorded).length;

  return {
    schoolName: normalizeHumanName(school.name),
    schoolLogoUrl,
    sessionName: normalizeHumanName(session.name),
    termName: normalizeHumanName(term.name),
    classId: reportCardClassId,
    className: buildClassName(classDoc),
    generatedAt: Date.now(),
    assessmentConfig: {
      ca1Max: settings?.ca1Max ?? DEFAULT_CA_MAX,
      ca2Max: settings?.ca2Max ?? DEFAULT_CA_MAX,
      ca3Max: settings?.ca3Max ?? DEFAULT_CA_MAX,
      examMax: settings?.examContributionMax ?? DEFAULT_EXAM_MAX,
    },
    student: {
      _id: student._id,
      name: normalizePersonName(studentUser?.name ?? "Unnamed Student"),
      admissionNumber: student.admissionNumber,
      gender: student.gender ?? null,
      dateOfBirth: student.dateOfBirth ?? null,
      guardianName: student.guardianName ?? null,
      guardianPhone: student.guardianPhone ?? null,
      address: student.address ?? null,
      houseName: student.houseName
        ? normalizeHumanName(student.houseName)
        : null,
      nextTermBegins: term.nextTermBegins ?? null,
      photoUrl,
    },
    summary: {
      totalSubjects: results.length,
      recordedSubjects,
      pendingSubjects: results.length - recordedSubjects,
      averageScore: results.length > 0 ? totalScore / results.length : null,
      totalScore,
    },
    results,
    classTeacherName:
      classTeacher && classTeacher.schoolId === args.schoolId
        ? normalizePersonName(classTeacher.name)
        : null,
    classTeacherComment: reportCardComment?.classTeacherComment ?? null,
    headTeacherComment: reportCardComment?.headTeacherComment ?? null,
  };
}

export const getStudentReportCard = query({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: reportCardResultValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    return await buildStudentReportCard(ctx, {
      userId,
      schoolId,
      role,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
    });
  },
});

export const getStudentsForReportCardBatch = query({
  args: {
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.array(reportCardBatchStudentValidator),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);

    await assertClassReportCardAccess(ctx, {
      userId,
      schoolId,
      role,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    return await getStudentsForClassReportCardBatch(ctx, {
      schoolId,
      classId: args.classId,
      sessionId: args.sessionId,
    });
  },
});

export const getClassReportCards = query({
  args: {
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.array(reportCardResultValidator),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);

    await assertClassReportCardAccess(ctx, {
      userId,
      schoolId,
      role,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    const roster = await getStudentsForClassReportCardBatch(ctx, {
      schoolId,
      classId: args.classId,
      sessionId: args.sessionId,
    });

    if (roster.length === 0) {
      throw new ConvexError(
        "No students found for the selected class and session"
      );
    }

    return await Promise.all(
      roster.map((student) =>
        buildStudentReportCard(ctx, {
          userId,
          schoolId,
          role,
          studentId: student.studentId,
          sessionId: args.sessionId,
          termId: args.termId,
          preferredClassId: args.classId,
          skipRoleCheck: true,
        })
      )
    );
  },
});

export const saveStudentReportCardComments = mutation({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classTeacherComment: v.union(v.string(), v.null()),
    headTeacherComment: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const [student, session, term, existingComment] = await Promise.all([
      ctx.db.get(args.studentId),
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
      ctx.db
        .query("reportCardComments")
        .withIndex("by_student_session_term", (q) =>
          q
            .eq("studentId", args.studentId)
            .eq("sessionId", args.sessionId)
            .eq("termId", args.termId)
        )
        .unique(),
    ]);

    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Student not found");
    }
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== schoolId || term.sessionId !== args.sessionId) {
      throw new ConvexError("Term not found");
    }

    const classTeacherComment = normalizeOptionalComment(args.classTeacherComment);
    const headTeacherComment = normalizeOptionalComment(args.headTeacherComment);
    const now = Date.now();

    if (existingComment) {
      await ctx.db.replace(existingComment._id, {
        schoolId,
        studentId: args.studentId,
        sessionId: args.sessionId,
        termId: args.termId,
        classTeacherComment,
        headTeacherComment,
        createdAt: existingComment.createdAt,
        updatedAt: now,
        updatedBy: userId,
      });
      return null;
    }

    await ctx.db.insert("reportCardComments", {
      schoolId,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
      classTeacherComment,
      headTeacherComment,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    return null;
  },
});

export const saveTermNextTermBegins = mutation({
  args: {
    termId: v.id("academicTerms"),
    nextTermBegins: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const term = await ctx.db.get(args.termId);
    if (!term || term.schoolId !== schoolId) {
      throw new ConvexError("Term not found");
    }

    if (
      args.nextTermBegins !== null &&
      args.nextTermBegins <= term.endDate
    ) {
      throw new ConvexError("Next term start date must be after this term ends");
    }

    const replacement: {
      schoolId: typeof term.schoolId;
      sessionId: typeof term.sessionId;
      name: string;
      startDate: number;
      endDate: number;
      nextTermBegins?: number;
      isActive: boolean;
      createdAt: number;
      updatedAt: number;
    } = {
      schoolId: term.schoolId,
      sessionId: term.sessionId,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      isActive: term.isActive,
      createdAt: term.createdAt,
      updatedAt: Date.now(),
    };

    if (args.nextTermBegins !== null) {
      replacement.nextTermBegins = args.nextTermBegins;
    }

    await ctx.db.replace(args.termId, replacement);
    return null;
  },
});
