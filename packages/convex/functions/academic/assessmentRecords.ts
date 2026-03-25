import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "../../_generated/dataModel";
import {
  getAuthenticatedSchoolMembership,
  assertTeacherAssignment,
} from "./auth";
import {
  validateScoreRanges,
  deriveAssessmentFields,
} from "@school/shared/exam-recording";
import type { ExamInputMode, GradingBand } from "@school/shared/exam-recording";
import {
  normalizeHumanName,
  normalizePersonName,
} from "@school/shared/name-format";

/**
 * Get exam entry sheet with roster, existing scores, settings, and bands
 * 
 * Authorization:
 * - Teacher: must have assignment for (classId, subjectId) in their school
 * - Admin: must belong to the school that owns classId
 */
export const getExamEntrySheet = query({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  returns: v.object({
    roster: v.array(
      v.object({
        studentId: v.id("students"),
        studentName: v.string(),
        assessmentRecord: v.union(
          v.object({
            _id: v.id("assessmentRecords"),
            _creationTime: v.number(),
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
          }),
          v.null()
        ),
      })
    ),
    settings: v.union(
      v.object({
        _id: v.id("schoolAssessmentSettings"),
        _creationTime: v.number(),
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
      }),
      v.null()
    ),
    gradingBands: v.array(
      v.object({
        _id: v.id("gradingBands"),
        _creationTime: v.number(),
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
    ),
  }),
  handler: async (ctx: any, args: { sessionId: any; termId: any; classId: any; subjectId: any }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );

    // Verify class belongs to user's school
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify subject belongs to user's school
    const subjectDoc = await ctx.db.get(args.subjectId);
    if (!subjectDoc || subjectDoc.schoolId !== schoolId || subjectDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify session belongs to user's school
    const sessionDoc = await ctx.db.get(args.sessionId);
    if (!sessionDoc || sessionDoc.schoolId !== schoolId || sessionDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify term belongs to user's school
    const termDoc = await ctx.db.get(args.termId);
    if (!termDoc || termDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Authorization check
    if (role === "teacher") {
      await assertTeacherAssignment(ctx, userId, args.classId, args.subjectId);
    } else if (role !== "admin") {
      throw new ConvexError("Unauthorized");
    }

    // Fetch school assessment settings
    const settings = await ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .unique();

    // Fetch active grading bands
    const gradingBandsResult = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .collect();

    // Sort grading bands by minScore
    const sortedBands = [...gradingBandsResult].sort((a: any, b: any) => a.minScore - b.minScore);

    // Query students in the class (roster)
    const students = await ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q: any) =>
        q.eq("schoolId", schoolId).eq("classId", args.classId)
      )
      .collect();

    // Bulk-fetch existing assessment records for this sheet
    const existingRecords = await ctx.db
      .query("assessmentRecords")
      .withIndex("by_sheet", (q: any) =>
        q
          .eq("schoolId", schoolId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
      )
      .collect();

    // Create a map of studentId -> assessmentRecord for efficient lookup
    const recordMap = new Map(
      existingRecords.map((record: any) => [record.studentId, record])
    );

    // Left-join roster with existing records
    const roster = await Promise.all(
      students.map(async (student: any) => {
        // Get user details for student name
        const user = await ctx.db.get(student.userId);
        const studentName = normalizePersonName(user?.name ?? "Unknown");

        return {
          studentId: student._id,
          studentName,
          assessmentRecord: recordMap.get(student._id) ?? null,
        };
      })
    );

    return {
      roster,
      settings,
      gradingBands: sortedBands,
    };
  },
});

/**
 * Upsert assessment records in bulk
 * 
 * Validates each row, computes derived fields, saves valid rows, skips invalid rows,
 * and reports per-row errors.
 * 
 * Authorization:
 * - Teacher: must have assignment for (classId, subjectId)
 * - Admin: must belong to the school
 */
export const upsertAssessmentRecordsBulk = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    records: v.array(
      v.object({
        studentId: v.id("students"),
        ca1: v.number(),
        ca2: v.number(),
        ca3: v.number(),
        examRawScore: v.number(),
      })
    ),
  },
  returns: v.object({
    updated: v.number(),
    created: v.number(),
    errors: v.array(
      v.object({
        studentId: v.id("students"),
        field: v.union(
          v.literal("ca1"),
          v.literal("ca2"),
          v.literal("ca3"),
          v.literal("examRawScore"),
          v.literal("record")
        ),
        message: v.string(),
      })
    ),
  }),
  handler: async (ctx: any, args: { sessionId: any; termId: any; classId: any; subjectId: any; records: any[] }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );

    // Verify class belongs to user's school
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify subject belongs to user's school
    const subjectDoc = await ctx.db.get(args.subjectId);
    if (!subjectDoc || subjectDoc.schoolId !== schoolId || subjectDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify session belongs to user's school
    const sessionDoc = await ctx.db.get(args.sessionId);
    if (!sessionDoc || sessionDoc.schoolId !== schoolId || sessionDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify term belongs to user's school
    const termDoc = await ctx.db.get(args.termId);
    if (!termDoc || termDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Authorization check
    if (role === "teacher") {
      await assertTeacherAssignment(ctx, userId, args.classId, args.subjectId);
    } else if (role !== "admin") {
      throw new ConvexError("Unauthorized");
    }

    // Fetch school assessment settings
    const settings = await ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .unique();

    if (!settings) {
      throw new ConvexError("School assessment settings not configured");
    }

    // Fetch active grading bands
    const gradingBandsResult = await ctx.db
      .query("gradingBands")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .collect();

    if (gradingBandsResult.length === 0) {
      throw new ConvexError("Grading bands not configured");
    }

    // Sort grading bands by minScore and cast to proper type
    const sortedBands: GradingBand[] = [...gradingBandsResult]
      .sort((a: any, b: any) => a.minScore - b.minScore)
      .map((band: any) => ({
        schoolId: band.schoolId,
        minScore: band.minScore,
        maxScore: band.maxScore,
        gradeLetter: band.gradeLetter,
        remark: band.remark,
        isActive: band.isActive,
        createdAt: band.createdAt,
        updatedAt: band.updatedAt,
        updatedBy: band.updatedBy,
      }));

    const examInputMode = settings.examInputMode as ExamInputMode;
    const examRawMaxSnapshot =
      examInputMode === "raw40" ? 40 : 60;

    let updated = 0;
    let created = 0;
    const errors: Array<{
      studentId: Id<"students">;
      field: "ca1" | "ca2" | "ca3" | "examRawScore" | "record";
      message: string;
    }> = [];

    // Process each record
    for (const record of args.records) {
      const studentDoc = await ctx.db.get(record.studentId);
      if (
        !studentDoc ||
        studentDoc.schoolId !== schoolId ||
        studentDoc.classId !== args.classId
      ) {
        errors.push({
          studentId: record.studentId,
          field: "record",
          message: "Student does not belong to the selected class in this school",
        });
        continue;
      }

      // Validate score ranges
      const validationErrors = validateScoreRanges(
        record.ca1,
        record.ca2,
        record.ca3,
        record.examRawScore,
        examInputMode
      );

      if (validationErrors.length > 0) {
        // Add all validation errors for this record
        for (const error of validationErrors) {
          errors.push({
            studentId: record.studentId,
            field: error.field,
            message: error.message,
          });
        }
        continue; // Skip persistence for this row
      }

      // Compute derived fields
      const derived = deriveAssessmentFields(
        record.ca1,
        record.ca2,
        record.ca3,
        record.examRawScore,
        examInputMode,
        sortedBands
      );

      // Look up existing record
      const existingRecord = await ctx.db
        .query("assessmentRecords")
        .withIndex("by_student_sheet", (q: any) =>
          q
            .eq("schoolId", schoolId)
            .eq("sessionId", args.sessionId)
            .eq("termId", args.termId)
            .eq("classId", args.classId)
            .eq("subjectId", args.subjectId)
            .eq("studentId", record.studentId)
        )
        .unique();

      const now = Date.now();

      if (existingRecord) {
        // Update existing record (preserve enteredBy and createdAt)
        await ctx.db.patch(existingRecord._id, {
          ca1: record.ca1,
          ca2: record.ca2,
          ca3: record.ca3,
          examRawScore: record.examRawScore,
          examScaledScore: derived.examScaledScore,
          total: derived.total,
          gradeLetter: derived.gradeLetter,
          remark: derived.remark,
          updatedBy: userId,
          updatedAt: now,
        });
        updated++;
      } else {
        // Insert new record
        await ctx.db.insert("assessmentRecords", {
          schoolId,
          sessionId: args.sessionId,
          termId: args.termId,
          classId: args.classId,
          subjectId: args.subjectId,
          studentId: record.studentId,
          ca1: record.ca1,
          ca2: record.ca2,
          ca3: record.ca3,
          examRawScore: record.examRawScore,
          examScaledScore: derived.examScaledScore,
          total: derived.total,
          gradeLetter: derived.gradeLetter,
          remark: derived.remark,
          examInputModeSnapshot: examInputMode,
          examRawMaxSnapshot,
          status: "draft",
          enteredBy: userId,
          updatedBy: userId,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      }
    }

    return {
      updated,
      created,
      errors,
    };
  },
});
