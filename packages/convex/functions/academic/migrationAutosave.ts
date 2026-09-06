import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { generateFamilyClusterKey, normalizePhoneNumber } from "@school/shared";
import { getPrivateMigrationWorkspace } from "./migrationWorkspace";
import {
  proposeAdmissionNumberHelper,
  validateSequence,
} from "./admissionNumbers";
import { requireCapability } from "./rbac";
import { resolveEffectiveAcademicPolicy } from "./settings";
import { resolveEffectiveGradingBands } from "./gradingBands";
import { getActiveAggregationByUmbrellaSubject } from "./subjectAggregationHelpers";
import { validateGradingBands, validateScoreRanges, type GradingBand } from "@school/shared/exam-recording";

const editableStatuses = new Set([
  "draft",
  "reviewing",
  "analyzing",
  "ready",
  "failed",
]);

async function invalidateWorkspaceReview(
  ctx: MutationCtx,
  workspace: Doc<"importWorkspaces">,
) {
  await ctx.db.patch(workspace._id, {
    status: "reviewing",
    reviewPlanVersion: (workspace.reviewPlanVersion ?? 0) + 1,
    planningCursor: undefined,
    planningProcessedRecords: undefined,
    planningBaseSequence: undefined,
    planningNextSequence: undefined,
    planningPolicyVersion: undefined,
    planningFormatVersion: undefined,
    planningCounterKey: undefined,
    planningCounterVersion: undefined,
    planningCounters: undefined,
    reviewedAt: undefined,
    reviewedBy: undefined,
    reviewApprovalReceiptId: undefined,
    commitCursor: undefined,
    processedRecords: 0,
    updatedAt: Date.now(),
  });
}

function assertEditable(workspace: Doc<"importWorkspaces">) {
  if (!editableStatuses.has(workspace.status)) {
    throw new ConvexError(
      `Cannot modify records in a ${workspace.status} workspace`,
    );
  }
}

type AssessmentPolicySnapshot = NonNullable<Doc<"stagedImportRecords">["reviewedAssessmentPolicySnapshot"]>;
type GradingPolicySnapshot = NonNullable<Doc<"stagedImportRecords">["reviewedGradingPolicySnapshot"]>;
type GradeImportEvidence = {
  assessmentPolicy: AssessmentPolicySnapshot;
  gradingPolicy: GradingPolicySnapshot;
};

function canonicalSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSnapshot);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalSnapshot(item)]),
    );
  }
  return value;
}

function sameSnapshot(left: unknown, right: unknown) {
  return JSON.stringify(canonicalSnapshot(left)) === JSON.stringify(canonicalSnapshot(right));
}

async function resolveGradeImportEvidence(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  record: Doc<"stagedImportRecords">,
): Promise<GradeImportEvidence> {
  if (!record.selectedStudentId || !record.selectedClassId || !record.selectedSubjectId || !record.selectedSessionId || !record.selectedTermId) {
    throw new ConvexError(`Grade row #${record.rowNumber} requires existing student, class, subject, session, and term selections`);
  }
  const selectedStudentId = record.selectedStudentId;
  const selectedClassId = record.selectedClassId;
  const selectedSubjectId = record.selectedSubjectId;
  const selectedSessionId = record.selectedSessionId;
  const [student, session] = await Promise.all([
    ctx.db.get(selectedStudentId),
    ctx.db.get(selectedSessionId),
  ]);
  if (!student || student.schoolId !== schoolId || student.isArchived) {
    throw new ConvexError(`Grade row #${record.rowNumber} student is unavailable in this school`);
  }

  let relationshipEstablished =
    !!session?.isActive &&
    !session.isArchived &&
    student.classId === selectedClassId &&
    (!student.enrollmentStatus || student.enrollmentStatus === "active");
  if (!relationshipEstablished) {
    const [selection, fromPromotions, toPromotions, graduations] = await Promise.all([
      ctx.db.query("studentSubjectSelections").withIndex("by_student_and_class_and_session", q =>
        q.eq("studentId", student._id).eq("classId", selectedClassId).eq("sessionId", selectedSessionId),
      ).first(),
      ctx.db.query("studentPromotions").withIndex("by_student_and_from_session", q => q.eq("studentId", student._id).eq("fromSessionId", selectedSessionId)).take(101),
      ctx.db.query("studentPromotions").withIndex("by_student_and_to_session", q => q.eq("studentId", student._id).eq("toSessionId", selectedSessionId)).take(101),
      ctx.db.query("studentGraduations").withIndex("by_student_and_session", q => q.eq("studentId", student._id).eq("sessionId", selectedSessionId)).take(101),
    ]);
    if (fromPromotions.length > 100 || toPromotions.length > 100 || graduations.length > 100) {
      throw new ConvexError(`Grade row #${record.rowNumber} historical enrollment evidence exceeds the review bound`);
    }
    relationshipEstablished =
      selection?.schoolId === schoolId ||
      fromPromotions.some(promotion => promotion.schoolId === schoolId && promotion.fromClassId === selectedClassId) ||
      toPromotions.some(promotion => promotion.schoolId === schoolId && promotion.toClassId === selectedClassId) ||
      graduations.some(graduation => graduation.schoolId === schoolId && graduation.classId === selectedClassId);
  }
  if (!relationshipEstablished) {
    throw new ConvexError(`Grade row #${record.rowNumber} has no reviewed student-class relationship for the selected session`);
  }
  if (!session || session.schoolId !== schoolId || !session.isActive || session.isArchived) {
    throw new ConvexError(`Grade row #${record.rowNumber} historical scoring policy evidence is unavailable`);
  }
  if (await getActiveAggregationByUmbrellaSubject(ctx, {
    schoolId,
    classId: selectedClassId,
    umbrellaSubjectId: selectedSubjectId,
  })) {
    throw new ConvexError(`Grade row #${record.rowNumber} targets a derived aggregate subject`);
  }

  const [policy, resolvedBands] = await Promise.all([
    resolveEffectiveAcademicPolicy(ctx, schoolId),
    resolveEffectiveGradingBands(ctx, schoolId),
  ]);
  const bands: GradingBand[] = resolvedBands
    .map(band => ({
      schoolId: String(band.schoolId), minScore: band.minScore, maxScore: band.maxScore,
      gradeLetter: band.gradeLetter, remark: band.remark, isActive: band.isActive,
      createdAt: band.createdAt, updatedAt: band.updatedAt, updatedBy: String(band.updatedBy),
      version: band.version,
      ...((band.colorHex ?? band.color) ? { colorHex: band.colorHex ?? band.color } : {}),
      ...(band.gradePoints !== undefined ? { gradePoints: band.gradePoints } : {}),
    }))
    .sort((a, b) => a.minScore - b.minScore);
  if (validateGradingBands(bands).length > 0) {
    throw new ConvexError(`Grade row #${record.rowNumber} grading policy evidence is unavailable or invalid`);
  }
  const scoreErrors = validateScoreRanges(
    record.parsedData.ca1 ?? 0,
    record.parsedData.ca2 ?? 0,
    0,
    record.parsedData.exam ?? 0,
    policy.examInputMode,
  );
  if (scoreErrors.length) {
    throw new ConvexError(`Grade row #${record.rowNumber} has invalid canonical scores: ${scoreErrors.map(error => error.message).join("; ")}`);
  }
  return {
    assessmentPolicy: {
      source: policy.governance.source,
      mode: policy.governance.mode,
      groupVersion: policy.governance.groupVersion,
      revision: policy.governance.revision,
      examInputMode: policy.examInputMode,
      ca1Max: policy.ca1Max,
      ca2Max: policy.ca2Max,
      ca3Max: policy.ca3Max,
      examContributionMax: policy.examContributionMax,
      examRawMax: policy.examInputMode === "raw40" ? 40 : 60,
    },
    gradingPolicy: {
      version: Math.max(0, ...resolvedBands.map(band => band.version ?? 0)),
      bands: bands.map(band => ({
        gradeLetter: band.gradeLetter, minScore: band.minScore, maxScore: band.maxScore,
        remark: band.remark,
        ...(band.gradePoints !== undefined ? { gradePoints: band.gradePoints } : {}),
        ...(band.colorHex ? { colorHex: band.colorHex } : {}),
      })),
    },
  };
}

function baseValidationErrors(record: Doc<"stagedImportRecords">): string[] {
  const data = record.parsedData;
  const errors: string[] = [];
  if (!data.firstName.trim()) errors.push("First name is required");
  if (!data.lastName.trim()) errors.push("Last name is required");
  if (record.entityType === "grade_record") {
    if (!data.subjectName?.trim())
      errors.push("Subject name is required for grade records");
    for (const [label, score] of [
      ["CA1", data.ca1],
      ["CA2", data.ca2],
      ["Exam", data.exam],
    ] as const) {
      if (
        score !== undefined &&
        (!Number.isFinite(score) || score < 0 || score > 100)
      ) {
        errors.push(`${label} score must be between 0 and 100`);
      }
    }
  }
  return errors;
}

export async function validateReviewedRecord(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  record: Doc<"stagedImportRecords">,
  expectedPlanVersion?: number,
): Promise<void> {
  if (
    record.reviewStatus !== "approved" ||
    record.reviewedRowRevision !== (record.rowRevision ?? 1) ||
    (expectedPlanVersion !== undefined &&
      record.approvedPlanVersion !== expectedPlanVersion)
  ) {
    throw new ConvexError(
      `Row #${record.rowNumber} requires current explicit review`,
    );
  }
  if (record.validationErrors.length > 0) {
    throw new ConvexError(
      `Row #${record.rowNumber} has deterministic validation errors`,
    );
  }
  const action = record.resolutionAction;
  if (!action || action === "link_as_sibling") {
    throw new ConvexError(
      `Row #${record.rowNumber} requires create, merge, or ignore`,
    );
  }
  if (action === "ignore") return;

  if (record.entityType === "student") {
    if (action === "merge_existing") {
      if (!record.selectedStudentId)
        throw new ConvexError(
          `Row #${record.rowNumber} requires a merge target`,
        );
      const target = await ctx.db.get(record.selectedStudentId);
      if (!target || target.schoolId !== schoolId)
        throw new ConvexError(
          `Row #${record.rowNumber} merge target is outside this school`,
        );
      const duplicateTargets = await ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId_and_selectedStudentId", (q) =>
          q
            .eq("workspaceId", record.workspaceId)
            .eq("selectedStudentId", record.selectedStudentId),
        )
        .take(2);
      if (
        duplicateTargets.some(
          (candidate) =>
            candidate._id !== record._id &&
            candidate.reviewStatus === "approved" &&
            candidate.resolutionAction === "merge_existing",
        )
      ) {
        throw new ConvexError(
          `Student selected by row #${record.rowNumber} is already targeted by another reviewed row`,
        );
      }
      return;
    }

    if (!record.selectedClassId || !record.selectedUserId) {
      throw new ConvexError(
        `Row #${record.rowNumber} requires an existing class and un-enrolled student identity`,
      );
    }
    const [selectedClass, selectedUser] = await Promise.all([
      ctx.db.get(record.selectedClassId),
      ctx.db.get(record.selectedUserId),
    ]);
    if (!selectedClass || selectedClass.schoolId !== schoolId) {
      throw new ConvexError(
        `Row #${record.rowNumber} class is outside this school`,
      );
    }
    if (
      !selectedUser ||
      selectedUser.schoolId !== schoolId ||
      selectedUser.role !== "student" ||
      selectedUser.isArchived
    ) {
      throw new ConvexError(
        `Row #${record.rowNumber} identity must be an active student user in this school`,
      );
    }
    const enrollment = await ctx.db
      .query("students")
      .withIndex("by_school_and_user", (q) =>
        q.eq("schoolId", schoolId).eq("userId", selectedUser._id),
      )
      .first();
    if (enrollment)
      throw new ConvexError(
        `Row #${record.rowNumber} selected identity is already enrolled`,
      );
    const duplicateUsers = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_selectedUserId", (q) =>
        q
          .eq("workspaceId", record.workspaceId)
          .eq("selectedUserId", selectedUser._id),
      )
      .take(2);
    if (
      duplicateUsers.some(
        (candidate) =>
          candidate._id !== record._id &&
          candidate.reviewStatus === "approved" &&
          candidate.resolutionAction === "create_new",
      )
    ) {
      throw new ConvexError(
        `Identity selected by row #${record.rowNumber} is already used by another reviewed row`,
      );
    }
    if (record.selectedFamilyId) {
      const family = await ctx.db.get(record.selectedFamilyId);
      if (!family || family.schoolId !== schoolId)
        throw new ConvexError(
          `Row #${record.rowNumber} family is outside this school`,
        );
    }

    const suppliedNumber = record.parsedData.admissionNumber?.trim();
    if (suppliedNumber) {
      if (
        record.admissionNumberMode !== "supplied" ||
        !record.manualNumberConfirmed ||
        !record.manualNumberReason ||
        record.manualNumberReason.trim().length < 8 ||
        record.manualNumberReason.length > 240
      ) {
        throw new ConvexError(
          `Row #${record.rowNumber} historical admission number needs confirmation and an 8–240 character reason`,
        );
      }
      if (record.advanceCounterTo !== undefined) {
        validateSequence(record.advanceCounterTo);
        if (
          record.expectedNumberPolicyVersion === undefined ||
          !record.expectedNumberFormatVersion ||
          !record.expectedNumberCounterKey ||
          record.expectedNumberCounterVersion === undefined
        ) {
          throw new ConvexError(
            `Row #${record.rowNumber} counter advancement requires reviewed policy, format, and counter versions`,
          );
        }
      }
      const [existing, claim, duplicates] = await Promise.all([
        ctx.db
          .query("students")
          .withIndex("by_school_and_admission_number", (q) =>
            q.eq("schoolId", schoolId).eq("admissionNumber", suppliedNumber),
          )
          .first(),
        ctx.db
          .query("admissionNumberClaims")
          .withIndex("by_school_number", (q) =>
            q.eq("schoolId", schoolId).eq("number", suppliedNumber),
          )
          .unique(),
        ctx.db
          .query("stagedImportRecords")
          .withIndex("by_workspaceId_and_admissionNumber", (q) =>
            q
              .eq("workspaceId", record.workspaceId)
              .eq("normalizedAdmissionNumber", suppliedNumber),
          )
          .take(3),
      ]);
      if (existing || claim)
        throw new ConvexError(
          `Admission number on row #${record.rowNumber} is already assigned or permanently claimed`,
        );
      if (
        duplicates.some(
          (candidate) =>
            candidate._id !== record._id &&
            candidate.resolutionAction === "create_new" &&
            candidate.reviewStatus === "approved",
        )
      ) {
        throw new ConvexError(
          `Admission number on row #${record.rowNumber} is duplicated in the reviewed import`,
        );
      }
    } else {
      if (
        record.admissionNumberMode !== "official_generated" ||
        record.expectedNumberPolicyVersion === undefined ||
        !record.expectedNumberFormatVersion ||
        !record.expectedNumberCounterKey ||
        record.expectedNumberCounterVersion === undefined
      ) {
        throw new ConvexError(
          `Row #${record.rowNumber} requires a reviewed official-number proposal with policy, format, and counter versions`,
        );
      }
    }
    return;
  }

  if (action !== "create_new")
    throw new ConvexError(
      `Grade row #${record.rowNumber} supports create or ignore only`,
    );
  if (
    !record.selectedStudentId ||
    !record.selectedClassId ||
    !record.selectedSubjectId ||
    !record.selectedSessionId ||
    !record.selectedTermId
  ) {
    throw new ConvexError(
      `Grade row #${record.rowNumber} requires existing student, class, subject, session, and term selections`,
    );
  }
  const [student, selectedClass, subject, session, term] = await Promise.all([
    ctx.db.get(record.selectedStudentId),
    ctx.db.get(record.selectedClassId),
    ctx.db.get(record.selectedSubjectId),
    ctx.db.get(record.selectedSessionId),
    ctx.db.get(record.selectedTermId),
  ]);
  if (!student || student.schoolId !== schoolId)
    throw new ConvexError(
      `Grade row #${record.rowNumber} student is outside this school`,
    );
  if (!selectedClass || selectedClass.schoolId !== schoolId)
    throw new ConvexError(
      `Grade row #${record.rowNumber} class is outside this school`,
    );
  if (!subject || subject.schoolId !== schoolId)
    throw new ConvexError(
      `Grade row #${record.rowNumber} subject is outside this school`,
    );
  if (!session || session.schoolId !== schoolId)
    throw new ConvexError(
      `Grade row #${record.rowNumber} session is outside this school`,
    );
  if (!term || term.schoolId !== schoolId || term.sessionId !== session._id)
    throw new ConvexError(
      `Grade row #${record.rowNumber} term does not belong to the selected session`,
    );
  const gradeEvidence = await resolveGradeImportEvidence(ctx, schoolId, record);
  if (
    !record.reviewedAssessmentPolicySnapshot ||
    !record.reviewedGradingPolicySnapshot ||
    !sameSnapshot(record.reviewedAssessmentPolicySnapshot, gradeEvidence.assessmentPolicy) ||
    !sameSnapshot(record.reviewedGradingPolicySnapshot, gradeEvidence.gradingPolicy)
  ) {
    throw new ConvexError(`Grade row #${record.rowNumber} policy evidence changed or was not reviewed`);
  }
  if (!record.reviewUniquenessKey)
    throw new ConvexError(
      `Grade row #${record.rowNumber} has no reviewed uniqueness key`,
    );
  const duplicateReviewedRows = await ctx.db
    .query("stagedImportRecords")
    .withIndex("by_workspaceId_and_reviewUniquenessKey", (q) =>
      q
        .eq("workspaceId", record.workspaceId)
        .eq("reviewUniquenessKey", record.reviewUniquenessKey),
    )
    .take(2);
  if (
    duplicateReviewedRows.some(
      (candidate) =>
        candidate._id !== record._id &&
        candidate.reviewStatus === "approved" &&
        candidate.resolutionAction === "create_new",
    )
  ) {
    throw new ConvexError(
      `Grade row #${record.rowNumber} duplicates another reviewed assessment row`,
    );
  }
  const existingAssessment = await ctx.db
    .query("assessmentRecords")
    .withIndex("by_student_sheet", (q) =>
      q
        .eq("schoolId", schoolId)
        .eq("sessionId", session._id)
        .eq("termId", term._id)
        .eq("classId", selectedClass._id)
        .eq("subjectId", subject._id)
        .eq("studentId", student._id),
    )
    .first();
  if (existingAssessment)
    throw new ConvexError(
      `Grade row #${record.rowNumber} duplicates an existing assessment record`,
    );
}

/** Editing always invalidates prior review and immutable-plan approval. */
export const patchStagedRecord = mutation({
  args: {
    schoolId: v.id("schools"),
    recordId: v.id("stagedImportRecords"),
    parsedDataPatch: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      middleName: v.optional(v.string()),
      admissionNumber: v.optional(v.string()),
      gender: v.optional(v.string()),
      dateOfBirth: v.optional(v.number()),
      className: v.optional(v.string()),
      guardianName: v.optional(v.string()),
      guardianPhone: v.optional(v.string()),
      guardianEmail: v.optional(v.string()),
      address: v.optional(v.string()),
      subjectName: v.optional(v.string()),
      ca1: v.optional(v.number()),
      ca2: v.optional(v.number()),
      exam: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.recordId);
    if (!record || record.schoolId !== args.schoolId)
      throw new ConvexError("Staged record not found");
    const { workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      record.workspaceId,
    );
    assertEditable(workspace);
    if (record.isCommitted)
      throw new ConvexError("Committed row outcomes are immutable");
    const parsedData = { ...record.parsedData, ...args.parsedDataPatch };
    if (args.parsedDataPatch.guardianPhone !== undefined) {
      parsedData.guardianPhone =
        normalizePhoneNumber(args.parsedDataPatch.guardianPhone) ??
        args.parsedDataPatch.guardianPhone;
    }
    const validationErrors = baseValidationErrors({ ...record, parsedData });
    const validationStatus = validationErrors.length ? "error" : "warning";
    const oldStatus = record.validationStatus;
    await ctx.db.patch(record._id, {
      parsedData,
      normalizedAdmissionNumber:
        parsedData.admissionNumber?.trim() || undefined,
      familyClusterKey: generateFamilyClusterKey(parsedData.guardianPhone),
      validationErrors,
      validationStatus,
      reviewStatus: "pending",
      rowRevision: (record.rowRevision ?? 1) + 1,
      reviewedRowRevision: undefined,
      resolutionAction: undefined,
      selectedClassId: undefined,
      selectedSubjectId: undefined,
      selectedStudentId: undefined,
      selectedUserId: undefined,
      selectedFamilyId: undefined,
      selectedSessionId: undefined,
      selectedTermId: undefined,
      reviewUniquenessKey: undefined,
      admissionNumberMode: undefined,
      manualNumberConfirmed: undefined,
      manualNumberReason: undefined,
      advanceCounterTo: undefined,
      expectedNumberPolicyVersion: undefined,
      expectedNumberFormatVersion: undefined,
      expectedNumberCounterKey: undefined,
      expectedNumberCounterVersion: undefined,
      proposedAdmissionNumber: undefined,
      reviewedAssessmentPolicySnapshot: undefined,
      reviewedGradingPolicySnapshot: undefined,
      approvedPlanVersion: undefined,
      isResolved: false,
      updatedAt: Date.now(),
    });
    await updateCountersOnStatusChange(
      ctx,
      record.workspaceId,
      oldStatus,
      validationStatus,
    );
    await invalidateWorkspaceReview(ctx, workspace);
    return { success: true, validationStatus, validationErrors };
  },
});

/** Records one explicit, deterministic row decision. */
export const reviewStagedRecord = mutation({
  args: {
    schoolId: v.id("schools"),
    recordId: v.id("stagedImportRecords"),
    expectedRowRevision: v.number(),
    resolutionAction: v.union(
      v.literal("create_new"),
      v.literal("merge_existing"),
      v.literal("ignore"),
    ),
    selectedClassId: v.optional(v.id("classes")),
    selectedSubjectId: v.optional(v.id("subjects")),
    selectedStudentId: v.optional(v.id("students")),
    selectedUserId: v.optional(v.id("users")),
    selectedFamilyId: v.optional(v.id("families")),
    selectedSessionId: v.optional(v.id("academicSessions")),
    selectedTermId: v.optional(v.id("academicTerms")),
    admissionNumberMode: v.optional(
      v.union(v.literal("supplied"), v.literal("official_generated")),
    ),
    manualNumberConfirmed: v.optional(v.boolean()),
    manualNumberReason: v.optional(v.string()),
    advanceCounterTo: v.optional(v.number()),
    expectedNumberPolicyVersion: v.optional(v.number()),
    expectedNumberFormatVersion: v.optional(v.string()),
    expectedNumberCounterKey: v.optional(v.string()),
    expectedNumberCounterVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.recordId);
    if (!record || record.schoolId !== args.schoolId)
      throw new ConvexError("Staged record not found");
    const { workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      record.workspaceId,
    );
    assertEditable(workspace);
    if (record.isCommitted)
      throw new ConvexError("Committed row outcomes are immutable");
    if ((record.rowRevision ?? 1) !== args.expectedRowRevision)
      throw new ConvexError("Row changed; reload and review again");
    const validationErrors = baseValidationErrors(record);
    if (args.resolutionAction !== "ignore" && validationErrors.length) {
      throw new ConvexError(`Correct row #${record.rowNumber} before review`);
    }
    const reviewUniquenessKey =
      record.entityType === "grade_record" &&
      args.resolutionAction === "create_new" &&
      args.selectedStudentId &&
      args.selectedClassId &&
      args.selectedSubjectId &&
      args.selectedSessionId &&
      args.selectedTermId
        ? [
            args.selectedStudentId,
            args.selectedClassId,
            args.selectedSubjectId,
            args.selectedSessionId,
            args.selectedTermId,
          ].join(":")
        : undefined;
    const gradeEvidence =
      record.entityType === "grade_record" && args.resolutionAction === "create_new"
        ? await resolveGradeImportEvidence(ctx, args.schoolId, {
            ...record,
            selectedClassId: args.selectedClassId,
            selectedSubjectId: args.selectedSubjectId,
            selectedStudentId: args.selectedStudentId,
            selectedSessionId: args.selectedSessionId,
            selectedTermId: args.selectedTermId,
          })
        : undefined;
    const candidate: Doc<"stagedImportRecords"> = {
      ...record,
      resolutionAction: args.resolutionAction,
      reviewStatus: "approved",
      reviewedRowRevision: args.expectedRowRevision,
      selectedClassId: args.selectedClassId,
      selectedSubjectId: args.selectedSubjectId,
      selectedStudentId: args.selectedStudentId,
      selectedUserId: args.selectedUserId,
      selectedFamilyId: args.selectedFamilyId,
      selectedSessionId: args.selectedSessionId,
      selectedTermId: args.selectedTermId,
      reviewUniquenessKey,
      admissionNumberMode: args.admissionNumberMode,
      manualNumberConfirmed: args.manualNumberConfirmed,
      manualNumberReason: args.manualNumberReason?.trim(),
      advanceCounterTo: args.advanceCounterTo,
      expectedNumberPolicyVersion: args.expectedNumberPolicyVersion,
      expectedNumberFormatVersion: args.expectedNumberFormatVersion,
      expectedNumberCounterKey: args.expectedNumberCounterKey,
      expectedNumberCounterVersion: args.expectedNumberCounterVersion,
      reviewedAssessmentPolicySnapshot: gradeEvidence?.assessmentPolicy,
      reviewedGradingPolicySnapshot: gradeEvidence?.gradingPolicy,
      isResolved: true,
      validationStatus: "valid",
      validationErrors: [],
      updatedAt: Date.now(),
    };
    if (
      candidate.entityType === "student" &&
      candidate.resolutionAction === "create_new" &&
      candidate.admissionNumberMode === "supplied"
    ) {
      await requireCapability(
        ctx,
        args.schoolId,
        "enrollment.admissions.override_number",
      );
      if (candidate.advanceCounterTo !== undefined) {
        const selectedClass = candidate.selectedClassId
          ? await ctx.db.get(candidate.selectedClassId)
          : null;
        const proposal = await proposeAdmissionNumberHelper(ctx, {
          schoolId: args.schoolId,
          level: selectedClass?.level,
        });
        if (
          candidate.expectedNumberPolicyVersion !== proposal.policyVersion ||
          candidate.expectedNumberFormatVersion !== proposal.formatVersion ||
          candidate.expectedNumberCounterKey !== proposal.counterKey ||
          candidate.expectedNumberCounterVersion !== proposal.counterVersion ||
          candidate.advanceCounterTo <= proposal.sequenceNumber
        ) {
          throw new ConvexError(
            "Explicit counter advancement is stale or does not exceed the official next sequence",
          );
        }
      }
    }
    if (
      candidate.entityType === "student" &&
      candidate.resolutionAction === "create_new" &&
      candidate.admissionNumberMode === "official_generated"
    ) {
      const selectedClass = candidate.selectedClassId
        ? await ctx.db.get(candidate.selectedClassId)
        : null;
      const proposal = await proposeAdmissionNumberHelper(ctx, {
        schoolId: args.schoolId,
        level: selectedClass?.level,
      });
      if (
        candidate.expectedNumberPolicyVersion !== proposal.policyVersion ||
        candidate.expectedNumberFormatVersion !== proposal.formatVersion ||
        candidate.expectedNumberCounterKey !== proposal.counterKey ||
        candidate.expectedNumberCounterVersion !== proposal.counterVersion
      )
        throw new ConvexError(
          "Numbering policy or counter changed; review again",
        );
    }
    await validateReviewedRecord(ctx, args.schoolId, candidate);
    const oldStatus = record.validationStatus;
    await ctx.db.patch(record._id, {
      resolutionAction: candidate.resolutionAction,
      reviewStatus: "approved",
      reviewedRowRevision: candidate.reviewedRowRevision,
      selectedClassId: candidate.selectedClassId,
      selectedSubjectId: candidate.selectedSubjectId,
      selectedStudentId: candidate.selectedStudentId,
      selectedUserId: candidate.selectedUserId,
      selectedFamilyId: candidate.selectedFamilyId,
      selectedSessionId: candidate.selectedSessionId,
      selectedTermId: candidate.selectedTermId,
      reviewUniquenessKey: candidate.reviewUniquenessKey,
      admissionNumberMode: candidate.admissionNumberMode,
      manualNumberConfirmed: candidate.manualNumberConfirmed,
      manualNumberReason: candidate.manualNumberReason,
      advanceCounterTo: candidate.advanceCounterTo,
      expectedNumberPolicyVersion: candidate.expectedNumberPolicyVersion,
      expectedNumberFormatVersion: candidate.expectedNumberFormatVersion,
      expectedNumberCounterKey: candidate.expectedNumberCounterKey,
      expectedNumberCounterVersion: candidate.expectedNumberCounterVersion,
      proposedAdmissionNumber: undefined,
      reviewedAssessmentPolicySnapshot: candidate.reviewedAssessmentPolicySnapshot,
      reviewedGradingPolicySnapshot: candidate.reviewedGradingPolicySnapshot,
      approvedPlanVersion: undefined,
      isResolved: true,
      validationStatus: "valid",
      validationErrors: [],
      updatedAt: Date.now(),
    });
    await updateCountersOnStatusChange(
      ctx,
      record.workspaceId,
      oldStatus,
      "valid",
    );
    await invalidateWorkspaceReview(ctx, workspace);
    return { success: true, status: "approved" as const };
  },
});

/** Legacy clash shortcut is safe only for explicit merge-to-displayed-candidate or ignore. */
export const resolveRecordClash = mutation({
  args: {
    schoolId: v.id("schools"),
    recordId: v.id("stagedImportRecords"),
    resolutionAction: v.union(
      v.literal("create_new"),
      v.literal("merge_existing"),
      v.literal("link_as_sibling"),
      v.literal("ignore"),
    ),
    targetStudentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.recordId);
    if (!record || record.schoolId !== args.schoolId)
      throw new ConvexError("Staged record not found");
    const { workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      record.workspaceId,
    );
    assertEditable(workspace);
    if (record.isCommitted)
      throw new ConvexError("Committed row outcomes are immutable");
    if (
      args.resolutionAction === "create_new" ||
      args.resolutionAction === "link_as_sibling"
    ) {
      throw new ConvexError(
        "Open full row review to select an existing identity, class, and optional family",
      );
    }
    const selectedStudentId =
      args.resolutionAction === "merge_existing"
        ? (args.targetStudentId ?? record.existingStudentId)
        : undefined;
    const candidate: Doc<"stagedImportRecords"> = {
      ...record,
      resolutionAction: args.resolutionAction,
      selectedStudentId,
      reviewStatus: "approved",
      reviewedRowRevision: record.rowRevision ?? 1,
      validationStatus: "valid",
      validationErrors: [],
      isResolved: true,
      updatedAt: Date.now(),
    };
    await validateReviewedRecord(ctx, args.schoolId, candidate);
    const oldStatus = record.validationStatus;
    await ctx.db.patch(record._id, {
      resolutionAction: args.resolutionAction,
      selectedStudentId,
      existingStudentId: selectedStudentId,
      reviewUniquenessKey: undefined,
      reviewStatus: "approved",
      reviewedRowRevision: record.rowRevision ?? 1,
      validationStatus: "valid",
      validationErrors: [],
      isResolved: true,
      approvedPlanVersion: undefined,
      updatedAt: Date.now(),
    });
    await updateCountersOnStatusChange(
      ctx,
      record.workspaceId,
      oldStatus,
      "valid",
    );
    await invalidateWorkspaceReview(ctx, workspace);
    return { success: true };
  },
});

/** Unsafe import-local numbering is intentionally unreachable. */
export const bulkResolveAdmissionNumbers = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    prefix: v.optional(v.string()),
    startingSequence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);
    throw new ConvexError(
      "Import-local numbering is disabled. Review missing IDs against the official H4 policy.",
    );
  },
});

async function updateCountersOnStatusChange(
  ctx: MutationCtx,
  workspaceId: Id<"importWorkspaces">,
  oldStatus: "valid" | "warning" | "error",
  newStatus: "valid" | "warning" | "error",
) {
  if (oldStatus === newStatus) return;
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) return;
  const diff = { validRecords: 0, warningRecords: 0, errorRecords: 0 };
  diff[`${oldStatus}Records`] -= 1;
  diff[`${newStatus}Records`] += 1;
  await ctx.db.patch(workspaceId, {
    validRecords: Math.max(0, workspace.validRecords + diff.validRecords),
    warningRecords: Math.max(0, workspace.warningRecords + diff.warningRecords),
    errorRecords: Math.max(0, workspace.errorRecords + diff.errorRecords),
    updatedAt: Date.now(),
  });
}
