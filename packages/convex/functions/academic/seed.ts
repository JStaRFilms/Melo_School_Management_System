import { internalMutation } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { deriveAssessmentFields } from "@school/shared";

const DEFAULT_ADMIN = {
  name: "Admin User",
  email: "admin@demo-academy.school",
} as const;

const DEFAULT_TEACHER = {
  name: "Teacher User",
  email: "teacher@demo-academy.school",
} as const;

const STUDENTS = [
  {
    name: "Alice Johnson",
    email: "alice@demo-academy.school",
    admNo: "ADM/2025/001",
  },
  {
    name: "Bob Smith",
    email: "bob@demo-academy.school",
    admNo: "ADM/2025/002",
  },
  {
    name: "Carol Davis",
    email: "carol@demo-academy.school",
    admNo: "ADM/2025/003",
  },
] as const;

const SUBJECTS = [
  { name: "Mathematics", code: "MATH" },
  { name: "English Language", code: "ENG" },
  { name: "Basic Science", code: "SCI" },
] as const;

const BAND_DEFINITIONS = [
  { minScore: 0, maxScore: 39, gradeLetter: "F", remark: "Fail" },
  { minScore: 40, maxScore: 44, gradeLetter: "E", remark: "Pass" },
  { minScore: 45, maxScore: 49, gradeLetter: "D", remark: "Pass" },
  { minScore: 50, maxScore: 59, gradeLetter: "C", remark: "Credit" },
  { minScore: 60, maxScore: 69, gradeLetter: "B", remark: "Very Good" },
  { minScore: 70, maxScore: 100, gradeLetter: "A", remark: "Excellent" },
] as const;

const SEED_SCORES = [
  { studentIdx: 0, ca1: 18, ca2: 17, ca3: 19, examRawScore: 35 },
  { studentIdx: 1, ca1: 12, ca2: 14, ca3: 10, examRawScore: 22 },
  { studentIdx: 2, ca1: 8, ca2: 6, ca3: 9, examRawScore: 15 },
] as const;

export const seedExamRecordingDataInternal = internalMutation({
  args: {
    adminAuthId: v.string(),
    teacherAuthId: v.string(),
  },
  returns: v.object({
    schoolId: v.id("schools"),
    adminUserId: v.id("users"),
    teacherUserId: v.id("users"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectIds: v.array(v.id("subjects")),
    studentIds: v.array(v.id("students")),
    settingsId: v.id("schoolAssessmentSettings"),
    gradingBandIds: v.array(v.id("gradingBands")),
    assessmentRecordIds: v.array(v.id("assessmentRecords")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingSchool = await ctx.db
      .query("schools")
      .filter((q: any) => q.eq(q.field("slug"), "demo-school"))
      .unique();

    if (existingSchool) {
      const schoolId = existingSchool._id;
      const adminUser = await ctx.db
        .query("users")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .filter((q: any) => q.eq(q.field("role"), "admin"))
        .first();
      const teacherUser = await ctx.db
        .query("users")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .filter((q: any) => q.eq(q.field("role"), "teacher"))
        .first();
      const session = await ctx.db
        .query("academicSessions")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .first();
      const term = session
        ? await ctx.db
            .query("academicTerms")
            .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
            .first()
        : null;
      const classDoc = await ctx.db
        .query("classes")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .first();
      const subjects = await ctx.db
        .query("subjects")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();
      const students = await ctx.db
        .query("students")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();
      const settings = await ctx.db
        .query("schoolAssessmentSettings")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .first();
      const gradingBands = await ctx.db
        .query("gradingBands")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();
      const assessmentRecords = await ctx.db
        .query("assessmentRecords")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();

      if (
        !adminUser ||
        !teacherUser ||
        !session ||
        !term ||
        !classDoc ||
        !settings ||
        subjects.length === 0 ||
        students.length === 0
      ) {
        throw new ConvexError(
          "Existing demo-school seed is incomplete. Clear the partial seed before rerunning."
        );
      }

      return {
        schoolId,
        adminUserId: adminUser._id,
        teacherUserId: teacherUser._id,
        sessionId: session._id,
        termId: term._id,
        classId: classDoc._id,
        subjectIds: subjects.map((subject: any) => subject._id),
        studentIds: students.map((student: any) => student._id),
        settingsId: settings._id,
        gradingBandIds: gradingBands.map((band: any) => band._id),
        assessmentRecordIds: assessmentRecords.map((record: any) => record._id),
      };
    }

    const schoolId = await ctx.db.insert("schools", {
      name: "Demo Academy",
      slug: "demo-school",
      createdAt: now,
      updatedAt: now,
    });

    const adminUserId = await ctx.db.insert("users", {
      schoolId,
      authId: args.adminAuthId,
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    const teacherUserId = await ctx.db.insert("users", {
      schoolId,
      authId: args.teacherAuthId,
      name: DEFAULT_TEACHER.name,
      email: DEFAULT_TEACHER.email,
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });

    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2025/2026",
      startDate: new Date("2025-09-01").getTime(),
      endDate: new Date("2026-07-31").getTime(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First Term",
      startDate: new Date("2025-09-01").getTime(),
      endDate: new Date("2025-12-20").getTime(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "JSS 1A",
      level: "Junior Secondary",
      createdAt: now,
      updatedAt: now,
    });

    const subjectIds: Id<"subjects">[] = [];
    for (const subject of SUBJECTS) {
      const subjectId = await ctx.db.insert("subjects", {
        schoolId,
        name: subject.name,
        code: subject.code,
        createdAt: now,
        updatedAt: now,
      });
      subjectIds.push(subjectId);
    }

    await ctx.db.insert("teacherAssignments", {
      schoolId,
      teacherId: teacherUserId,
      classId,
      subjectId: subjectIds[0],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("teacherAssignments", {
      schoolId,
      teacherId: teacherUserId,
      classId,
      subjectId: subjectIds[1],
      createdAt: now,
      updatedAt: now,
    });

    const studentIds: Id<"students">[] = [];
    for (const student of STUDENTS) {
      const userId = await ctx.db.insert("users", {
        schoolId,
        authId: `seed-student-${student.admNo}`,
        name: student.name,
        email: student.email,
        role: "student",
        createdAt: now,
        updatedAt: now,
      });

      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId,
        userId,
        admissionNumber: student.admNo,
        createdAt: now,
        updatedAt: now,
      });

      studentIds.push(studentId);
    }

    const settingsId = await ctx.db.insert("schoolAssessmentSettings", {
      schoolId,
      examInputMode: "raw40",
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examContributionMax: 40,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: adminUserId,
    });

    const gradingBandIds: Id<"gradingBands">[] = [];
    for (const band of BAND_DEFINITIONS) {
      const gradingBandId = await ctx.db.insert("gradingBands", {
        schoolId,
        minScore: band.minScore,
        maxScore: band.maxScore,
        gradeLetter: band.gradeLetter,
        remark: band.remark,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminUserId,
      });
      gradingBandIds.push(gradingBandId);
    }

    const assessmentRecordIds: Id<"assessmentRecords">[] = [];
    for (const score of SEED_SCORES) {
      const activeBands = BAND_DEFINITIONS.map((band) => ({
        schoolId: schoolId as string,
        minScore: band.minScore,
        maxScore: band.maxScore,
        gradeLetter: band.gradeLetter,
        remark: band.remark,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminUserId as string,
      }));
      const derived = deriveAssessmentFields(
        score.ca1,
        score.ca2,
        score.ca3,
        score.examRawScore,
        "raw40",
        activeBands
      );

      const assessmentRecordId = await ctx.db.insert("assessmentRecords", {
        schoolId,
        sessionId,
        termId,
        classId,
        subjectId: subjectIds[0],
        studentId: studentIds[score.studentIdx],
        ca1: score.ca1,
        ca2: score.ca2,
        ca3: score.ca3,
        examRawScore: score.examRawScore,
        examScaledScore: derived.examScaledScore,
        total: derived.total,
        gradeLetter: derived.gradeLetter,
        remark: derived.remark,
        examInputModeSnapshot: "raw40",
        examRawMaxSnapshot: 40,
        status: "draft",
        enteredBy: teacherUserId,
        updatedBy: teacherUserId,
        createdAt: now,
        updatedAt: now,
      });

      assessmentRecordIds.push(assessmentRecordId);
    }

    return {
      schoolId,
      adminUserId,
      teacherUserId,
      sessionId,
      termId,
      classId,
      subjectIds,
      studentIds,
      settingsId,
      gradingBandIds,
      assessmentRecordIds,
    };
  },
});
