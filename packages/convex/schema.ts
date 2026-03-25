import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Stub tables for prerequisite data (from prior FRs)
  schools: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  users: defineTable({
    schoolId: v.id("schools"),
    authId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("parent"),
      v.literal("teacher"),
      v.literal("admin")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_auth", ["authId"]),

  students: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    userId: v.id("users"),
    admissionNumber: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_school_and_class", ["schoolId", "classId"]),

  classes: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    level: v.string(),
    gradeName: v.optional(v.string()),
    classLabel: v.optional(v.string()),
    formTeacherId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"]),

  subjects: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    code: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"]),

  teacherAssignments: defineTable({
    schoolId: v.id("schools"),
    teacherId: v.id("users"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_teacher", ["teacherId"])
    .index("by_class", ["classId"])
    .index("by_teacher_and_class", ["teacherId", "classId"])
    .index("by_teacher_and_class_and_subject", ["teacherId", "classId", "subjectId"]),

  classSubjects: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_class_and_subject", ["classId", "subjectId"]),

  studentSubjectSelections: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    sessionId: v.id("academicSessions"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_session", ["sessionId"])
    .index("by_student_and_session", ["studentId", "sessionId"])
    .index("by_class_and_session", ["classId", "sessionId"])
    .index("by_student_and_class_and_session", ["studentId", "classId", "sessionId"]),

  academicSessions: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  academicTerms: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_session", ["sessionId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  // Exam Recording tables
  schoolAssessmentSettings: defineTable({
    schoolId: v.id("schools"),
    examInputMode: v.union(
      v.literal("raw40"),
      v.literal("raw60_scaled_to_40")
    ),
    ca1Max: v.number(),
    ca2Max: v.number(),
    ca3Max: v.number(),
    examContributionMax: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  gradingBands: defineTable({
    schoolId: v.id("schools"),
    minScore: v.number(),
    maxScore: v.number(),
    gradeLetter: v.string(),
    remark: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  assessmentRecords: defineTable({
    schoolId: v.id("schools"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    studentId: v.id("students"),
    ca1: v.number(),
    ca2: v.number(),
    ca3: v.number(),
    examRawScore: v.number(),
    examScaledScore: v.number(),
    total: v.number(),
    gradeLetter: v.string(),
    remark: v.string(),
    examInputModeSnapshot: v.string(),
    examRawMaxSnapshot: v.number(),
    status: v.literal("draft"),
    enteredBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_sheet", [
      "schoolId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
    ])
    .index("by_student_sheet", [
      "schoolId",
      "sessionId",
      "termId",
      "classId",
      "subjectId",
      "studentId",
    ]),
});
