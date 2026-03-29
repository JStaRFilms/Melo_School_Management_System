import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Platform super admin accounts (not school-scoped)
  platformAdmins: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth", ["authId"])
    .index("by_email", ["email"]),

  // Stub tables for prerequisite data (from prior FRs)
  schools: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("active"))),
    logoStorageId: v.optional(v.id("_storage")),
    logoFileName: v.optional(v.string()),
    logoContentType: v.optional(v.string()),
    logoUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  users: defineTable({
    schoolId: v.id("schools"),
    authId: v.string(),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    role: v.union(
      v.literal("student"),
      v.literal("parent"),
      v.literal("teacher"),
      v.literal("admin")
    ),
    isSchoolAdmin: v.optional(v.boolean()),
    managerUserId: v.optional(v.union(v.id("users"), v.null())),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_auth", ["authId"]),

  schoolAdminLeadership: defineTable({
    schoolId: v.id("schools"),
    leadAdminUserId: v.id("users"),
    previousLeadAdminUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_lead_admin", ["leadAdminUserId"]),

  students: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    userId: v.id("users"),
    admissionNumber: v.string(),
    houseName: v.optional(v.string()),
    gender: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    guardianName: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    photoFileName: v.optional(v.string()),
    photoContentType: v.optional(v.string()),
    photoUpdatedAt: v.optional(v.number()),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
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
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"]),

  subjects: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    code: v.string(),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"]),

  schoolEvents: defineTable({
    schoolId: v.id("schools"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    isAllDay: v.boolean(),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_school_and_start", ["schoolId", "startDate"]),

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

  classSubjectAggregations: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    umbrellaSubjectId: v.id("subjects"),
    strategy: v.union(
      v.literal("fixed_contribution"),
      v.literal("raw_combined_normalized")
    ),
    reportDisplayMode: v.union(
      v.literal("umbrella_only"),
      v.literal("umbrella_with_breakdown")
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_class_and_umbrella", ["classId", "umbrellaSubjectId"])
    .index("by_school_active", ["schoolId", "isActive"]),

  classSubjectAggregationComponents: defineTable({
    schoolId: v.id("schools"),
    aggregationId: v.id("classSubjectAggregations"),
    componentSubjectId: v.id("subjects"),
    order: v.number(),
    contributionMax: v.optional(v.number()),
    rawMaxOverride: v.optional(v.number()),
    includeCA: v.boolean(),
    includeExam: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_aggregation", ["aggregationId"])
    .index("by_component_subject", ["componentSubjectId"]),

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

  studentSubjectAggregationOptOuts: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    aggregationId: v.id("classSubjectAggregations"),
    umbrellaSubjectId: v.id("subjects"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student", ["studentId"])
    .index("by_student_class_session", ["studentId", "classId", "sessionId"])
    .index("by_class_and_session", ["classId", "sessionId"])
    .index("by_aggregation", ["aggregationId"]),

  academicSessions: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
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
    nextTermBegins: v.optional(v.number()),
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
    ])
    .index("by_student_and_term", [
      "schoolId",
      "studentId",
      "sessionId",
      "termId",
    ]),

  reportCardComments: defineTable({
    schoolId: v.id("schools"),
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classTeacherComment: v.optional(v.string()),
    headTeacherComment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_session_term", ["studentId", "sessionId", "termId"])
    .index("by_school_and_term", ["schoolId", "termId"]),

  reportCardExtraScaleTemplates: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    description: v.optional(v.string()),
    options: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        shortLabel: v.optional(v.string()),
        order: v.number(),
      })
    ),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_school", ["schoolId"]),

  reportCardExtraBundles: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    description: v.optional(v.string()),
    sections: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        order: v.number(),
        fields: v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            type: v.union(
              v.literal("text"),
              v.literal("number"),
              v.literal("boolean"),
              v.literal("scale")
            ),
            scaleTemplateId: v.optional(v.id("reportCardExtraScaleTemplates")),
            printable: v.boolean(),
            source: v.optional(
              v.union(
                v.literal("teacher_manual"),
                v.literal("admin_manual"),
                v.literal("system_term"),
                v.literal("system_attendance")
              )
            ),
            systemKey: v.optional(
              v.union(
                v.literal("next_term_begins"),
                v.literal("attendance_code"),
                v.literal("times_school_opened"),
                v.literal("times_present"),
                v.literal("times_absent")
              )
            ),
            order: v.number(),
          })
        ),
      })
    ),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_school", ["schoolId"]),

  reportCardExtraClassAssignments: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    bundleId: v.id("reportCardExtraBundles"),
    order: v.number(),
    createdAt: v.number(),
    assignedBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class", ["classId"])
    .index("by_bundle", ["bundleId"])
    .index("by_class_and_bundle", ["classId", "bundleId"]),

  reportCardExtraStudentValues: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    bundleId: v.id("reportCardExtraBundles"),
    values: v.array(
      v.object({
        fieldId: v.string(),
        textValue: v.optional(v.string()),
        numberValue: v.optional(v.number()),
        booleanValue: v.optional(v.boolean()),
        scaleOptionId: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_session_term", ["studentId", "sessionId", "termId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"]),

  reportCardAttendanceClassValues: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    timesSchoolOpened: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"])
    .index("by_school_and_term", ["schoolId", "termId"]),

  reportCardAttendanceStudentValues: defineTable({
    schoolId: v.id("schools"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    timesPresent: v.optional(v.number()),
    attendanceCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_school", ["schoolId"])
    .index("by_student_session_term", ["studentId", "sessionId", "termId"])
    .index("by_class_session_term", ["classId", "sessionId", "termId"]),
});
