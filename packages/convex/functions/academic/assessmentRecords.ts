import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  getAuthenticatedSchoolMembership,
} from "./auth";
import { assertTeacherAssignment } from "./teacherAccess";
import {
  deriveForSessionPolicy,
  validateScoresForPolicy,
  sessionScoringSnapshotMode,
} from "@school/shared/exam-recording";
import type { GradingBand } from "@school/shared/exam-recording";
import {
  normalizeHumanName,
  normalizePersonName,
} from "@school/shared/name-format";
import { getActiveAggregationByUmbrellaSubject } from "./subjectAggregationHelpers";
import { resolveEffectiveGradingBands } from "./gradingBands";
import {
  assessmentEditingStateReturnValidator,
  getAssessmentEditingPolicy,
  getAssessmentEditingState,
} from "./assessmentEditingPolicyHelpers";
import { resolveSessionScoringPolicy } from "./sessionScoring";
import { isStudentEnrolledInClassForSession } from "./studentClassMembership";
import { pickMostRecentDoc } from "./docSelection";
import { matchesScoreRowBaseline, scoreRowBaseline } from "@school/shared/drafts/scoreRowBaseline";
import { assertBranchDoc } from "../foundation/tenantScope";

function entrySheetRecord(record: Doc<"assessmentRecords">) {
  const { assessmentPolicySnapshot, gradingPolicySnapshot: _gradingPolicySnapshot, ...result } = record;
  // The entry UI needs historical CA and exam weights, not import governance or grading evidence.
  return {
    ...result,
    ...(assessmentPolicySnapshot ? { assessmentPolicySnapshot: {
      ca1Max: assessmentPolicySnapshot.ca1Max,
      ca2Max: assessmentPolicySnapshot.ca2Max,
      ca3Max: assessmentPolicySnapshot.ca3Max,
      examContributionMax: assessmentPolicySnapshot.examContributionMax,
      examRawMax: assessmentPolicySnapshot.examRawMax,
    } } : {}),
  };
}

/**
 * Get exam entry sheet with roster, existing scores, settings, and bands
 * 
 * Authorization:
 * - Teacher: must have assignment for (classId, subjectId) in their school
 * - Admin: must belong to the school that owns classId
 */
export const getExamEntrySheet = query({
  args: {
    schoolId: v.optional(v.id("schools")),
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
            sessionScoringPolicyVersion: v.optional(v.number()),
            assessmentPolicySnapshot: v.optional(v.object({
              ca1Max: v.number(),
              ca2Max: v.number(),
              ca3Max: v.number(),
              examContributionMax: v.number(),
              examRawMax: v.number(),
            })),
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
    settings: v.object({
      examInputMode: v.union(
        v.literal("raw40"),
        v.literal("raw60_scaled_to_40"),
      ),
      ca1Max: v.number(),
      ca2Max: v.number(),
      ca3Max: v.number(),
      examContributionMax: v.number(),
      examRawMax: v.number(),
      sessionPolicyVersion: v.number(),
    }),
    gradingBands: v.array(v.object({
      _id: v.id("gradingBands"),
      _creationTime: v.number(),
      schoolId: v.id("schools"),
      minScore: v.number(),
      maxScore: v.number(),
      gradeLetter: v.string(),
      remark: v.string(),
      gradePoints: v.optional(v.number()),
      colorHex: v.optional(v.string()),
      color: v.optional(v.string()),
      luminanceContrast: v.optional(v.number()),
      isActive: v.boolean(),
      version: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })),
    editingState: assessmentEditingStateReturnValidator,
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: "academic.assessments.enter" });

    // Verify class belongs to user's school
    const classDoc = await ctx.db.get(args.classId);
    assertBranchDoc(classDoc, schoolId, { excludeArchived: true });

    // Verify subject belongs to user's school
    const subjectDoc = await ctx.db.get(args.subjectId);
    assertBranchDoc(subjectDoc, schoolId, { excludeArchived: true });

    // Verify session belongs to user's school
    const sessionDoc = await ctx.db.get(args.sessionId);
    assertBranchDoc(sessionDoc, schoolId, { excludeArchived: true });

    // Verify term belongs to user's school
    const termDoc = await ctx.db.get(args.termId);
    assertBranchDoc(termDoc, schoolId);

    // Authorization check
    if (role === "teacher" && !isSchoolAdmin) {
      await assertTeacherAssignment(ctx, userId, args.classId, args.subjectId);
    } else if (!isSchoolAdmin && role !== "admin") {
      throw new ConvexError("Unauthorized");
    }

    const aggregation = await getActiveAggregationByUmbrellaSubject(ctx, {
      schoolId,
      classId: args.classId,
      umbrellaSubjectId: args.subjectId,
    });
    if (aggregation) {
      throw new ConvexError(
        "This subject is derived from component subjects and cannot be entered directly."
      );
    }

    const [effectiveSettings, editingPolicy] = await Promise.all([
      resolveSessionScoringPolicy(ctx, schoolId, args.sessionId),
      getAssessmentEditingPolicy(ctx, {
        schoolId,
        sessionId: args.sessionId,
        termId: args.termId,
      }),
    ]);
    const editingState = getAssessmentEditingState(editingPolicy, Date.now());

    // Use the same effective local/inherited policy as previews and issued reports.
    const gradingBandsResult = await resolveEffectiveGradingBands(ctx, schoolId);

    // Sort grading bands by minScore
    const sortedBands = [...gradingBandsResult].sort((a, b) => a.minScore - b.minScore);

    // Query students in the class for this session (roster)
    const studentIdSet = new Set<string>();

    if (sessionDoc?.isActive) {
      const baselineStudents = await ctx.db
        .query("students")
        .withIndex("by_school_and_class", (q) =>
          q.eq("schoolId", schoolId).eq("classId", args.classId)
        )
        .collect();
      for (const student of baselineStudents) {
        if (
          await isStudentEnrolledInClassForSession(ctx, {
            student,
            schoolId,
            classId: args.classId,
            sessionId: args.sessionId,
          })
        ) {
          studentIdSet.add(String(student._id));
        }
      }
    }

    const promotedIntoClass = await ctx.db
      .query("studentPromotions")
      .withIndex("by_to_class_and_to_session", (q) =>
        q.eq("toClassId", args.classId).eq("toSessionId", args.sessionId)
      )
      .collect();
    for (const promo of promotedIntoClass) {
      const student = await ctx.db.get(promo.studentId);
      if (
        student &&
        (await isStudentEnrolledInClassForSession(ctx, {
          student,
          schoolId,
          classId: args.classId,
          sessionId: args.sessionId,
        }))
      ) {
        studentIdSet.add(String(promo.studentId));
      }
    }

    const classSelections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_class_and_session", (q) =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId)
      )
      .collect();
    for (const sel of classSelections) {
      if (!sessionDoc.isActive || studentIdSet.has(String(sel.studentId))) {
        studentIdSet.add(String(sel.studentId));
      }
    }

    // Bulk-fetch existing assessment records for this sheet
    const existingRecords = await ctx.db
      .query("assessmentRecords")
      .withIndex("by_sheet", (q) =>
        q
          .eq("schoolId", schoolId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
          .eq("classId", args.classId)
          .eq("subjectId", args.subjectId)
      )
      .collect();

    for (const record of existingRecords) {
      if (!sessionDoc.isActive || studentIdSet.has(String(record.studentId))) {
        studentIdSet.add(String(record.studentId));
      }
    }

    const studentDocs = (
      await Promise.all(
        Array.from(studentIdSet).map((id) => ctx.db.get(id as Id<"students">))
      )
    ).filter(
      (student): student is NonNullable<typeof student> =>
        Boolean(student && student.schoolId === schoolId && !student.isArchived)
    );

    // Create a map of studentId -> assessmentRecord for efficient lookup
    const recordMap = new Map<string, (typeof existingRecords)[0]>(
      existingRecords.map((record) => [String(record.studentId), record])
    );

    // Left-join roster with existing records
    const roster = await Promise.all(
      studentDocs
        .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
        .map(async (student) => {
          // Get user details for student name
          const user = await ctx.db.get(student.userId);
          const studentName = normalizePersonName(user?.name ?? "Unknown");

          const storedRecord = recordMap.get(String(student._id));
          const assessmentRecord = storedRecord
            ? entrySheetRecord(storedRecord)
            : null;
          return {
            studentId: student._id,
            studentName,
            assessmentRecord,
          };
        })
    );

    return {
      roster,
      settings: {
        examInputMode: effectiveSettings.policy.examRawMax === 60 ? "raw60_scaled_to_40" as const : "raw40" as const,
        ca1Max: effectiveSettings.policy.ca1Max,
        ca2Max: effectiveSettings.policy.ca2Max,
        ca3Max: effectiveSettings.policy.ca3Max,
        examContributionMax: effectiveSettings.policy.examContributionMax,
        examRawMax: effectiveSettings.policy.examRawMax,
        sessionPolicyVersion: effectiveSettings.version,
      },
      gradingBands: sortedBands,
      editingState,
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
    schoolId: v.optional(v.id("schools")),
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
        // Optional to keep existing bulk-import callers compatible. Score-sheet drafts always supply it.
        expectedRow: v.optional(v.union(v.null(), v.object({
          id: v.string(), updatedAt: v.number(), ca1: v.number(), ca2: v.number(),
          ca3: v.number(), examRawScore: v.number(),
        }))),
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
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: "academic.assessments.enter" });

    // Verify class belongs to user's school
    const classDoc = await ctx.db.get(args.classId);
    assertBranchDoc(classDoc, schoolId, { excludeArchived: true });

    // Verify subject belongs to user's school
    const subjectDoc = await ctx.db.get(args.subjectId);
    assertBranchDoc(subjectDoc, schoolId, { excludeArchived: true });

    // Verify session belongs to user's school
    const sessionDoc = await ctx.db.get(args.sessionId);
    assertBranchDoc(sessionDoc, schoolId, { excludeArchived: true });

    // Verify term belongs to user's school
    const termDoc = await ctx.db.get(args.termId);
    assertBranchDoc(termDoc, schoolId);

    // Authorization check
    if (role === "teacher" && !isSchoolAdmin) {
      await assertTeacherAssignment(ctx, userId, args.classId, args.subjectId);
    } else if (!isSchoolAdmin && role !== "admin") {
      throw new ConvexError("Unauthorized");
    }

    const aggregation = await getActiveAggregationByUmbrellaSubject(ctx, {
      schoolId,
      classId: args.classId,
      umbrellaSubjectId: args.subjectId,
    });
    if (aggregation) {
      throw new ConvexError(
        "This subject is derived from component subjects and cannot be entered directly."
      );
    }

    const editingPolicy = await getAssessmentEditingPolicy(ctx, {
      schoolId,
      sessionId: args.sessionId,
      termId: args.termId,
    });
    const editingState = getAssessmentEditingState(editingPolicy, Date.now());
    if (!editingState.canEdit) {
      throw new ConvexError(editingState.message);
    }

    const settings = await resolveSessionScoringPolicy(ctx, schoolId, args.sessionId);

    // Use the same effective local/inherited policy as previews and issued reports.
    const gradingBandsResult = await resolveEffectiveGradingBands(ctx, schoolId);

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

    const examRawMaxSnapshot = settings.policy.examRawMax;
    const recordedMode = sessionScoringSnapshotMode(settings.policy);

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
        !(await isStudentEnrolledInClassForSession(ctx, {
          student: studentDoc,
          schoolId,
          classId: args.classId,
          sessionId: args.sessionId,
        }))
      ) {
        errors.push({
          studentId: record.studentId,
          field: "record",
          message: "Student does not belong to the selected class in this school",
        });
        continue;
      }

      // Look up the row before validation: a legacy session may contain both
      // raw40 and raw60 records. Editing one must use its own recorded maximum.
      const existingRecord = await ctx.db
        .query("assessmentRecords")
        .withIndex("by_student_sheet", (q: any) =>
          q.eq("schoolId", schoolId).eq("sessionId", args.sessionId)
            .eq("termId", args.termId).eq("classId", args.classId)
            .eq("subjectId", args.subjectId).eq("studentId", record.studentId)
        )
        .collect()
        .then((docs: any[]) => pickMostRecentDoc(docs));
      if (record.expectedRow !== undefined &&
        !matchesScoreRowBaseline(scoreRowBaseline(existingRecord), record.expectedRow)) {
        errors.push({ studentId: record.studentId, field: "record",
          message: "This row changed since you started editing. Discard the draft and review the latest scores before entering them again." });
        continue;
      }
      const rowPolicy = settings.source === "legacy" && existingRecord
        ? { ca1Max: existingRecord.assessmentPolicySnapshot?.ca1Max ?? 20,
            ca2Max: existingRecord.assessmentPolicySnapshot?.ca2Max ?? 20,
            ca3Max: existingRecord.assessmentPolicySnapshot?.ca3Max ?? 20,
            examRawMax: existingRecord.examRawMaxSnapshot,
            examContributionMax: existingRecord.assessmentPolicySnapshot?.examContributionMax ?? 40 }
        : settings.policy;
      const validationErrors = validateScoresForPolicy(record, rowPolicy);

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
      const derived = deriveForSessionPolicy(record, rowPolicy, sortedBands);
      const rowRecordedMode = sessionScoringSnapshotMode(rowPolicy);
      const rowRawMax = rowPolicy.examRawMax;

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
          examInputModeSnapshot: rowRecordedMode,
          examRawMaxSnapshot: rowRawMax,
          sessionScoringPolicyVersion: settings.source === "session" ? settings.version : undefined,
          // Drop reviewed-import provenance, but retain the row's effective
          // maxima so the next legacy edit and session resolver use the same policy.
          assessmentPolicySnapshot: settings.source === "legacy" ? rowPolicy : undefined,
          gradingPolicySnapshot: undefined,
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
          examInputModeSnapshot: recordedMode,
          examRawMaxSnapshot,
          sessionScoringPolicyVersion: settings.source === "session" ? settings.version : undefined,
          assessmentPolicySnapshot: settings.source === "legacy" ? rowPolicy : undefined,
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
