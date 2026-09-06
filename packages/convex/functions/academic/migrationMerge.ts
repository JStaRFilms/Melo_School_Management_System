import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { getPrivateMigrationWorkspace } from "./migrationWorkspace";
import { validateReviewedRecord } from "./migrationAutosave";
import {
  allocateNextAdmissionNumberHelper,
  commitManualAdmissionNumberHelper,
  proposeAdmissionNumberAtSequenceHelper,
  proposeAdmissionNumberHelper,
} from "./admissionNumbers";
import { recordAuditEventHelper } from "./audit";
import {
  deriveAssessmentFields,
  validateScoreRanges,
  type GradingBand,
} from "@school/shared/exam-recording";

function validateBatchSize(value: number | undefined): number {
  const batchSize = value ?? 25;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new ConvexError("Batch size must be an integer between 1 and 50");
  }
  return batchSize;
}

/**
 * Freezes reviewed row decisions into a versioned plan in bounded batches.
 * Generated numbers are exact read-only H4 proposals; no counter is consumed here.
 */
export const approveImportWorkspace = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = validateBatchSize(args.batchSize);
    const { auth, workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      args.workspaceId,
    );
    if (workspace.status === "ready") {
      return {
        success: true,
        done: true,
        processedRecords: workspace.totalRecords,
        totalRecords: workspace.totalRecords,
        reviewPlanVersion: workspace.reviewPlanVersion ?? 0,
      };
    }
    if (workspace.status !== "reviewing" && workspace.status !== "analyzing") {
      throw new ConvexError(
        `Workspace cannot be approved from ${workspace.status} status`,
      );
    }
    const firstPending = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_reviewStatus", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("reviewStatus", "pending"),
      )
      .first();
    if (firstPending)
      throw new ConvexError(
        `Row #${firstPending.rowNumber} still requires explicit review`,
      );

    const starting = workspace.status === "reviewing";
    const planVersion = starting
      ? (workspace.reviewPlanVersion ?? 0) + 1
      : workspace.reviewPlanVersion;
    if (planVersion === undefined)
      throw new ConvexError("Reviewed plan version is unavailable");
    const page = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_rowNumber", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .paginate({
        numItems: batchSize,
        cursor: starting ? null : (workspace.planningCursor ?? null),
      });

    const legacyPlanningCounter =
      workspace.planningCounterKey !== undefined &&
      workspace.planningPolicyVersion !== undefined &&
      workspace.planningFormatVersion !== undefined &&
      workspace.planningCounterVersion !== undefined &&
      workspace.planningBaseSequence !== undefined &&
      workspace.planningNextSequence !== undefined
        ? {
            key: workspace.planningCounterKey,
            policyVersion: workspace.planningPolicyVersion,
            formatVersion: workspace.planningFormatVersion,
            counterVersion: workspace.planningCounterVersion,
            baseSequence: workspace.planningBaseSequence,
            nextSequence: workspace.planningNextSequence,
          }
        : undefined;
    const planningCounters = starting
      ? []
      : [...(workspace.planningCounters ?? (legacyPlanningCounter ? [legacyPlanningCounter] : []))];
    const proposals: Array<{ rowNumber: number; admissionNumber: string }> = [];

    for (const record of page.page) {
      if (record.isCommitted) {
        await ctx.db.patch(record._id, {
          approvedPlanVersion: planVersion,
          updatedAt: Date.now(),
        });
        continue;
      }
      await validateReviewedRecord(ctx, args.schoolId, record);
      let proposedAdmissionNumber: string | undefined;
      const usesOfficialCounter =
        record.entityType === "student" &&
        record.resolutionAction === "create_new" &&
        (record.admissionNumberMode === "official_generated" ||
          record.advanceCounterTo !== undefined);
      if (usesOfficialCounter) {
        if (!record.selectedClassId)
          throw new ConvexError(
            `Row #${record.rowNumber} requires an existing class`,
          );
        const selectedClass = await ctx.db.get(record.selectedClassId);
        if (!selectedClass || selectedClass.schoolId !== args.schoolId)
          throw new ConvexError(
            `Row #${record.rowNumber} class is outside this school`,
          );
        const current = await proposeAdmissionNumberHelper(ctx, {
          schoolId: args.schoolId,
          level: selectedClass.level,
        });
        let counterState = planningCounters.find(
          (item) => item.key === current.counterKey,
        );
        if (!counterState) {
          counterState = {
            key: current.counterKey,
            policyVersion: current.policyVersion,
            formatVersion: current.formatVersion,
            counterVersion: current.counterVersion,
            baseSequence: current.sequenceNumber,
            nextSequence: current.sequenceNumber,
          };
          planningCounters.push(counterState);
        } else if (
          current.sequenceNumber !== counterState.baseSequence ||
          current.policyVersion !== counterState.policyVersion ||
          current.formatVersion !== counterState.formatVersion ||
          current.counterVersion !== counterState.counterVersion
        ) {
          throw new ConvexError(
            `Counter ${current.counterKey} changed during review; restart approval`,
          );
        }
        if (
          record.expectedNumberPolicyVersion !== counterState.policyVersion ||
          record.expectedNumberFormatVersion !== counterState.formatVersion ||
          record.expectedNumberCounterKey !== counterState.key ||
          record.expectedNumberCounterVersion !== counterState.counterVersion
        ) {
          throw new ConvexError(
            `Row #${record.rowNumber} has a stale numbering review`,
          );
        }
        if (record.admissionNumberMode === "official_generated") {
          const proposalNumber = await proposeAdmissionNumberAtSequenceHelper(
            ctx,
            {
              schoolId: args.schoolId,
              level: selectedClass.level,
              sequence: counterState.nextSequence,
              expectedVersion: counterState.policyVersion,
              expectedFormatVersion: counterState.formatVersion,
              expectedCounterKey: counterState.key,
              expectedCounterVersion: counterState.counterVersion,
            },
          );
          proposedAdmissionNumber = proposalNumber;
          const [existing, claim] = await Promise.all([
            ctx.db
              .query("students")
              .withIndex("by_school_and_admission_number", (q) =>
                q
                  .eq("schoolId", args.schoolId)
                  .eq("admissionNumber", proposalNumber),
              )
              .first(),
            ctx.db
              .query("admissionNumberClaims")
              .withIndex("by_school_number", (q) =>
                q.eq("schoolId", args.schoolId).eq("number", proposalNumber),
              )
              .unique(),
          ]);
          if (existing || claim)
            throw new ConvexError(
              `Official proposal for row #${record.rowNumber} is already assigned or claimed`,
            );
          counterState.nextSequence += 1;
          proposals.push({
            rowNumber: record.rowNumber,
            admissionNumber: proposedAdmissionNumber,
          });
        } else if (record.advanceCounterTo !== undefined) {
          if (record.advanceCounterTo <= counterState.nextSequence) {
            throw new ConvexError(
              `Counter choice on row #${record.rowNumber} does not exceed the prior reviewed sequence`,
            );
          }
          counterState.nextSequence = record.advanceCounterTo;
        }
      }
      await ctx.db.patch(record._id, {
        approvedPlanVersion: planVersion,
        proposedAdmissionNumber,
        updatedAt: Date.now(),
      });
    }

    const processedRecords =
      (starting ? 0 : (workspace.planningProcessedRecords ?? 0)) +
      page.page.length;
    const now = Date.now();
    const singleCounter = planningCounters.length === 1 ? planningCounters[0] : undefined;
    if (!page.isDone) {
      await ctx.db.patch(workspace._id, {
        status: "analyzing",
        reviewPlanVersion: planVersion,
        planningCursor: page.continueCursor,
        planningProcessedRecords: processedRecords,
        planningBaseSequence: singleCounter?.baseSequence,
        planningNextSequence: singleCounter?.nextSequence,
        planningPolicyVersion: singleCounter?.policyVersion,
        planningFormatVersion: singleCounter?.formatVersion,
        planningCounterKey: singleCounter?.key,
        planningCounterVersion: singleCounter?.counterVersion,
        planningCounters,
        reviewedAt: undefined,
        reviewedBy: undefined,
        updatedAt: now,
      });
      return {
        success: true,
        done: false,
        processedRecords,
        totalRecords: workspace.totalRecords,
        reviewPlanVersion: planVersion,
        proposals,
      };
    }

    const approvalReceipt = await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: auth.isSuperAdmin ? "platform_admin" : "user",
      actorPersonId: auth.actorPersonId,
      actorMembershipId: auth.actorMembershipId,
      actorEmailSnapshot: auth.email,
      module: "migration",
      action: "reviewed_import.plan_approved",
      targetType: "importWorkspaces",
      targetId: String(workspace._id),
      outcome: "success",
      safeSummary: `Approved reviewed import plan version ${planVersion} for ${workspace.totalRecords} rows; missing identifiers remain unallocated proposals.`,
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });
    await ctx.db.patch(workspace._id, {
      status: "ready",
      reviewPlanVersion: planVersion,
      planningCursor: undefined,
      planningProcessedRecords: workspace.totalRecords,
      planningBaseSequence: singleCounter?.baseSequence,
      planningNextSequence: singleCounter?.nextSequence,
      planningPolicyVersion: singleCounter?.policyVersion,
      planningFormatVersion: singleCounter?.formatVersion,
      planningCounterKey: singleCounter?.key,
      planningCounterVersion: singleCounter?.counterVersion,
      planningCounters,
      reviewedAt: now,
      reviewedBy: auth.callerId,
      reviewApprovalReceiptId: approvalReceipt.eventId,
      commitCursor: undefined,
      processedRecords: 0,
      updatedAt: now,
    });
    return {
      success: true,
      done: true,
      processedRecords: workspace.totalRecords,
      totalRecords: workspace.totalRecords,
      reviewPlanVersion: planVersion,
      approvalReceiptId: approvalReceipt.eventId,
      proposals,
    };
  },
});

/** Reopens only incomplete rows after a partial commit needs reviewed reconciliation. */
export const reopenIncompleteImportReview = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
  },
  handler: async (ctx, args) => {
    const { auth, workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      args.workspaceId,
    );
    if (workspace.status !== "committing") {
      throw new ConvexError(
        "Only a partially committed workspace can be reopened for reconciliation",
      );
    }
    const incomplete = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_isCommitted", (q) =>
        q.eq("workspaceId", workspace._id).eq("isCommitted", false),
      )
      .first();
    if (!incomplete)
      throw new ConvexError("No incomplete rows require reconciliation");
    const receipt = await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: auth.isSuperAdmin ? "platform_admin" : "user",
      actorPersonId: auth.actorPersonId,
      actorMembershipId: auth.actorMembershipId,
      actorEmailSnapshot: auth.email,
      module: "migration",
      action: "reviewed_import.reopen_incomplete",
      targetType: "importWorkspaces",
      targetId: String(workspace._id),
      outcome: "success",
      safeSummary: `Reopened reviewed import after ${workspace.processedRecords ?? 0} server-confirmed row outcomes; committed rows remain immutable.`,
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });
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
    return {
      success: true,
      receiptId: receipt.eventId,
      firstIncompleteRow: incomplete.rowNumber,
    };
  },
});

/**
 * Commits only an immutable reviewed plan. Every side effect and its receipt are
 * in the same bounded transaction, so a failed batch is safe to retry.
 */
export const commitImportWorkspace = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = validateBatchSize(args.batchSize);
    const { auth, workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      args.workspaceId,
    );
    if (workspace.status === "cancelled")
      throw new ConvexError("Cannot commit a cancelled workspace");
    if (workspace.status === "merged") {
      return {
        success: true,
        done: true,
        alreadyCommitted: true,
        processedRecords: workspace.totalRecords,
        totalRecords: workspace.totalRecords,
        workspaceId: workspace._id,
        receiptId: workspace.lastCommitReceiptId,
      };
    }
    if (
      (workspace.status !== "ready" && workspace.status !== "committing") ||
      !workspace.reviewedAt ||
      !workspace.reviewedBy ||
      workspace.reviewPlanVersion === undefined
    ) {
      throw new ConvexError(
        "Public import commit is disabled until every row has a current approved plan",
      );
    }

    const page = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_rowNumber", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .paginate({
        numItems: batchSize,
        cursor:
          workspace.status === "ready"
            ? null
            : (workspace.commitCursor ?? null),
      });
    const now = Date.now();
    const outcomes: Array<{
      recordId: Id<"stagedImportRecords">;
      rowNumber: number;
      outcome: "created" | "merged" | "ignored" | "grade_created";
      studentId?: Id<"students">;
      assessmentRecordId?: Id<"assessmentRecords">;
    }> = [];

    for (const record of page.page) {
      if (record.isCommitted) continue;
      await validateReviewedRecord(
        ctx,
        args.schoolId,
        record,
        workspace.reviewPlanVersion,
      );
      if (record.resolutionAction === "ignore") {
        outcomes.push({
          recordId: record._id,
          rowNumber: record.rowNumber,
          outcome: "ignored",
        });
        continue;
      }
      if (
        record.entityType === "student" &&
        record.resolutionAction === "merge_existing"
      ) {
        if (!record.selectedStudentId)
          throw new ConvexError(
            `Row #${record.rowNumber} requires a merge target`,
          );
        // Merge is an explicit reconciliation outcome. Unmapped/import text does
        // not overwrite a canonical student profile without field-level review.
        outcomes.push({
          recordId: record._id,
          rowNumber: record.rowNumber,
          outcome: "merged",
          studentId: record.selectedStudentId,
        });
        continue;
      }
      if (record.entityType === "student") {
        if (!record.selectedClassId || !record.selectedUserId)
          throw new ConvexError(
            `Row #${record.rowNumber} has incomplete placement`,
          );
        const selectedClass = await ctx.db.get(record.selectedClassId);
        if (!selectedClass || selectedClass.schoolId !== args.schoolId)
          throw new ConvexError(
            `Row #${record.rowNumber} class is outside this school`,
          );
        let admissionNumber = record.parsedData.admissionNumber?.trim();
        if (record.admissionNumberMode === "official_generated") {
          const allocation = await allocateNextAdmissionNumberHelper(ctx, {
            schoolId: args.schoolId,
            level: selectedClass.level,
            expectedVersion: record.expectedNumberPolicyVersion,
            expectedFormatVersion: record.expectedNumberFormatVersion,
            expectedCounterKey: record.expectedNumberCounterKey,
            expectedCounterVersion: record.expectedNumberCounterVersion,
          });
          if (
            !record.proposedAdmissionNumber ||
            allocation.allocatedNumber !== record.proposedAdmissionNumber
          ) {
            throw new ConvexError(
              `Official number for row #${record.rowNumber} changed; repeat approval`,
            );
          }
          admissionNumber = allocation.allocatedNumber;
        } else {
          if (!admissionNumber)
            throw new ConvexError(
              `Row #${record.rowNumber} has no reviewed admission number`,
            );
          await commitManualAdmissionNumberHelper(ctx, {
            schoolId: args.schoolId,
            number: admissionNumber,
            level: selectedClass.level,
            confirmed: record.manualNumberConfirmed,
            reason: record.manualNumberReason,
            advanceTo: record.advanceCounterTo,
            expectedVersion: record.expectedNumberPolicyVersion,
            expectedFormatVersion: record.expectedNumberFormatVersion,
            expectedCounterKey: record.expectedNumberCounterKey,
            expectedCounterVersion: record.expectedNumberCounterVersion,
          });
        }
        const studentId = await ctx.db.insert("students", {
          schoolId: args.schoolId,
          classId: record.selectedClassId,
          userId: record.selectedUserId,
          familyId: record.selectedFamilyId,
          admissionNumber,
          gender: record.parsedData.gender || "Unspecified",
          dateOfBirth: record.parsedData.dateOfBirth,
          guardianName: record.parsedData.guardianName,
          guardianPhone: record.parsedData.guardianPhone,
          address: record.parsedData.address,
          enrollmentStatus: "active",
          createdAt: now,
          updatedAt: now,
        });
        outcomes.push({
          recordId: record._id,
          rowNumber: record.rowNumber,
          outcome: "created",
          studentId,
        });
        continue;
      }

      if (!auth.userId)
        throw new ConvexError(
          "Grade import requires an authenticated school user for attribution",
        );
      if (
        !record.selectedStudentId ||
        !record.selectedClassId ||
        !record.selectedSubjectId ||
        !record.selectedSessionId ||
        !record.selectedTermId
      ) {
        throw new ConvexError(
          `Grade row #${record.rowNumber} has incomplete reviewed mappings`,
        );
      }
      const assessmentPolicy = record.reviewedAssessmentPolicySnapshot;
      const gradingPolicy = record.reviewedGradingPolicySnapshot;
      if (!assessmentPolicy || !gradingPolicy) {
        throw new ConvexError(`Grade row #${record.rowNumber} has no reviewed policy snapshot`);
      }
      const ca1 = record.parsedData.ca1 ?? 0;
      const ca2 = record.parsedData.ca2 ?? 0;
      const exam = record.parsedData.exam ?? 0;
      const scoreErrors = validateScoreRanges(ca1, ca2, 0, exam, assessmentPolicy.examInputMode);
      if (scoreErrors.length) {
        throw new ConvexError(`Grade row #${record.rowNumber} has invalid canonical scores: ${scoreErrors.map(error => error.message).join("; ")}`);
      }
      const gradingBands: GradingBand[] = gradingPolicy.bands.map(band => ({
        ...band,
        schoolId: String(args.schoolId),
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: String(auth.userId),
      }));
      const derived = deriveAssessmentFields(
        ca1,
        ca2,
        0,
        exam,
        assessmentPolicy.examInputMode,
        gradingBands,
      );
      if (derived.total < 0 || derived.total > 100) {
        throw new ConvexError(`Grade row #${record.rowNumber} total is outside 0–100`);
      }
      const assessmentRecordId = await ctx.db.insert("assessmentRecords", {
        schoolId: args.schoolId,
        sessionId: record.selectedSessionId,
        termId: record.selectedTermId,
        classId: record.selectedClassId,
        subjectId: record.selectedSubjectId,
        studentId: record.selectedStudentId,
        ca1,
        ca2,
        ca3: 0,
        examRawScore: exam,
        examScaledScore: derived.examScaledScore,
        total: derived.total,
        gradeLetter: derived.gradeLetter,
        remark: derived.remark,
        examInputModeSnapshot: assessmentPolicy.examInputMode,
        examRawMaxSnapshot: assessmentPolicy.examRawMax,
        assessmentPolicySnapshot: assessmentPolicy,
        gradingPolicySnapshot: gradingPolicy,
        status: "draft",
        enteredBy: auth.userId,
        updatedBy: auth.userId,
        createdAt: now,
        updatedAt: now,
      });
      outcomes.push({
        recordId: record._id,
        rowNumber: record.rowNumber,
        outcome: "grade_created",
        assessmentRecordId,
      });
    }

    const receipt = await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: auth.isSuperAdmin ? "platform_admin" : "user",
      actorPersonId: auth.actorPersonId,
      actorMembershipId: auth.actorMembershipId,
      actorEmailSnapshot: auth.email,
      module: "migration",
      action: "reviewed_import.batch_commit",
      targetType: "importWorkspaces",
      targetId: String(workspace._id),
      outcome: "success",
      safeSummary: `Reviewed import batch committed: ${outcomes.length} rows (${outcomes.filter((item) => item.outcome === "created").length} created, ${outcomes.filter((item) => item.outcome === "merged").length} merged, ${outcomes.filter((item) => item.outcome === "ignored").length} ignored, ${outcomes.filter((item) => item.outcome === "grade_created").length} grade records).`,
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });

    for (const outcome of outcomes) {
      await ctx.db.patch(outcome.recordId, {
        isCommitted: true,
        commitOutcome: outcome.outcome,
        commitReceiptId: receipt.eventId,
        committedStudentId: outcome.studentId,
        committedAssessmentRecordId: outcome.assessmentRecordId,
        updatedAt: now,
      });
    }

    const processedRecords =
      (workspace.status === "ready" ? 0 : (workspace.processedRecords ?? 0)) +
      page.page.length;
    if (page.isDone) {
      await ctx.db.patch(workspace._id, {
        status: "merged",
        processedRecords: workspace.totalRecords,
        commitCursor: undefined,
        lastCommitReceiptId: receipt.eventId,
        mergedAt: now,
        mergedBy: auth.callerId,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(workspace._id, {
        status: "committing",
        processedRecords,
        commitCursor: page.continueCursor,
        lastCommitReceiptId: receipt.eventId,
        updatedAt: now,
      });
    }
    return {
      success: true,
      done: page.isDone,
      processedRecords: page.isDone ? workspace.totalRecords : processedRecords,
      totalRecords: workspace.totalRecords,
      workspaceId: workspace._id,
      receiptId: receipt.eventId,
      outcomes: outcomes.map(
        ({ rowNumber, outcome, studentId, assessmentRecordId }) => ({
          rowNumber,
          outcome,
          targetId: studentId
            ? String(studentId)
            : assessmentRecordId
              ? String(assessmentRecordId)
              : undefined,
        }),
      ),
    };
  },
});
