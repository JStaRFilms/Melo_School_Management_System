import { getPrivateMigrationWorkspace } from "./migrationWorkspace";
import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { assertMigrationAccess } from "./migrationAuth";
import { generateFamilyClusterKey, normalizePhoneNumber } from "@school/shared";

/**
 * In-place shallow patch for a single staged record in the review workbench.
 * Autosaves immediately and recalculates row validation and workspace counters.
 */
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
    await assertMigrationAccess(ctx, args.schoolId);

    const record = await ctx.db.get(args.recordId);
    if (!record || record.schoolId !== args.schoolId) {
      throw new ConvexError("Staged record not found");
    }

    const { workspace } = await getPrivateMigrationWorkspace(ctx, args.schoolId, record.workspaceId);

    if (workspace.status === "cancelled" || workspace.status === "merged" || workspace.status === "committing") {
      throw new ConvexError(`Cannot modify records in a ${workspace.status} workspace`);
    }

    const updatedParsed = {
      ...record.parsedData,
      ...args.parsedDataPatch,
    };

    // Re-normalize phone if changed
    if (args.parsedDataPatch.guardianPhone !== undefined) {
      updatedParsed.guardianPhone =
        normalizePhoneNumber(args.parsedDataPatch.guardianPhone) ??
        args.parsedDataPatch.guardianPhone;
    }

    // Re-evaluate validation errors
    const validationErrors: string[] = [];
    if (!updatedParsed.firstName.trim()) {
      validationErrors.push("First name is required");
    }

    if (record.entityType === "grade_record") {
      if (!updatedParsed.subjectName) {
        validationErrors.push("Subject name is required for grade records");
      }
      if (updatedParsed.ca1 !== undefined && (updatedParsed.ca1 < 0 || updatedParsed.ca1 > 100)) {
        validationErrors.push("CA1 score must be between 0 and 100");
      }
      if (updatedParsed.ca2 !== undefined && (updatedParsed.ca2 < 0 || updatedParsed.ca2 > 100)) {
        validationErrors.push("CA2 score must be between 0 and 100");
      }
      if (updatedParsed.exam !== undefined && (updatedParsed.exam < 0 || updatedParsed.exam > 100)) {
        validationErrors.push("Exam score must be between 0 and 100");
      }
    }

    let validationStatus: "valid" | "warning" | "error" = "valid";
    if (validationErrors.length > 0) {
      validationStatus = "error";
    } else if (!record.isResolved && record.clashConfidence && record.clashConfidence >= 50) {
      validationStatus = "warning";
    }

    const familyClusterKey = generateFamilyClusterKey(updatedParsed.guardianPhone);

    const oldStatus = record.validationStatus;
    const now = Date.now();

    await ctx.db.patch(args.recordId, {
      parsedData: updatedParsed,
      validationStatus,
      validationErrors,
      familyClusterKey,
      updatedAt: now,
    });

    // Update workspace counters incrementally on status change
    await updateCountersOnStatusChange(ctx, record.workspaceId, oldStatus, validationStatus);

    return { success: true, validationStatus, validationErrors };
  },
});

/**
 * Resolves a detected clash between a staged row and another staged/live record.
 * Strictly verifies target student tenant ownership and candidate eligibility.
 */
export const resolveRecordClash = mutation({
  args: {
    schoolId: v.id("schools"),
    recordId: v.id("stagedImportRecords"),
    resolutionAction: v.union(
      v.literal("create_new"),
      v.literal("merge_existing"),
      v.literal("link_as_sibling"),
      v.literal("ignore")
    ),
    targetStudentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    await assertMigrationAccess(ctx, args.schoolId);

    const record = await ctx.db.get(args.recordId);
    if (!record || record.schoolId !== args.schoolId) {
      throw new ConvexError("Staged record not found");
    }

    const { workspace } = await getPrivateMigrationWorkspace(ctx, args.schoolId, record.workspaceId);

    if (workspace.status === "cancelled" || workspace.status === "merged" || workspace.status === "committing") {
      throw new ConvexError(`Cannot modify records in a ${workspace.status} workspace`);
    }

    let resolvedTargetStudentId: Id<"students"> | undefined = undefined;

    if (args.resolutionAction === "merge_existing") {
      const candidateStudentId = args.targetStudentId ?? record.existingStudentId;
      if (!candidateStudentId) {
        throw new ConvexError("A target student is required for merge_existing action");
      }

      // Verify student belongs to this school
      const targetStudent = await ctx.db.get(candidateStudentId);
      if (!targetStudent || targetStudent.schoolId !== args.schoolId) {
        throw new ConvexError("Target student not found or belongs to a different school");
      }

      // Verify the target is an allowed candidate if candidate data exists
      if (record.existingStudentId && record.existingStudentId !== candidateStudentId) {
        throw new ConvexError("Target student is not an allowed candidate for this record");
      }

      resolvedTargetStudentId = candidateStudentId;
    } else if (args.resolutionAction === "create_new" || args.resolutionAction === "ignore") {
      resolvedTargetStudentId = undefined;
    } else if (args.resolutionAction === "link_as_sibling") {
      if (args.targetStudentId) {
        const targetStudent = await ctx.db.get(args.targetStudentId);
        if (!targetStudent || targetStudent.schoolId !== args.schoolId) {
          throw new ConvexError("Target student not found or belongs to a different school");
        }
        resolvedTargetStudentId = args.targetStudentId;
      }
    }

    const validationStatus = record.validationErrors.length > 0 ? "error" : "valid";
    const oldStatus = record.validationStatus;

    await ctx.db.patch(args.recordId, {
      isResolved: true,
      resolutionAction: args.resolutionAction,
      existingStudentId: resolvedTargetStudentId,
      validationStatus,
      updatedAt: Date.now(),
    });

    await updateCountersOnStatusChange(ctx, record.workspaceId, oldStatus, validationStatus);

    return { success: true };
  },
});

/**
 * Bulk assigns sequential admission numbers to all student records missing an admission number.
 */
export const bulkResolveAdmissionNumbers = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    prefix: v.optional(v.string()),
    startingSequence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertMigrationAccess(ctx, args.schoolId);

    const { workspace } = await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);

    if (workspace.status === "cancelled" || workspace.status === "merged" || workspace.status === "committing") {
      throw new ConvexError(`Cannot modify records in a ${workspace.status} workspace`);
    }

    const currentYear = new Date().getFullYear();
    const prefix =
      args.prefix?.trim() || workspace.admissionNumberPrefix || `SCH/${currentYear}/`;
    let seq = args.startingSequence ?? workspace.nextAdmissionSequence ?? 1;

    let assignedCount = 0;
    const now = Date.now();

    const stagedStudents = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_entityType", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("entityType", "student")
      )
      .take(1000);

    for (const rec of stagedStudents) {
      if (!rec.parsedData.admissionNumber || !rec.parsedData.admissionNumber.trim()) {
        const formattedNumber = `${prefix}${String(seq).padStart(4, "0")}`;
        seq++;
        assignedCount++;

        const updatedParsed = {
          ...rec.parsedData,
          admissionNumber: formattedNumber,
        };

        const validationStatus = rec.validationErrors.length > 0 ? "error" : "valid";

        await ctx.db.patch(rec._id, {
          parsedData: updatedParsed,
          validationStatus,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.workspaceId, {
      admissionNumberPrefix: prefix,
      nextAdmissionSequence: seq,
      updatedAt: now,
    });

    return { assignedCount, nextSequence: seq };
  },
});

async function updateCountersOnStatusChange(
  ctx: MutationCtx,
  workspaceId: Id<"importWorkspaces">,
  oldStatus: "valid" | "warning" | "error",
  newStatus: "valid" | "warning" | "error"
) {
  if (oldStatus === newStatus) return;
  const ws = await ctx.db.get(workspaceId);
  if (!ws) return;

  let validDiff = 0;
  let warningDiff = 0;
  let errorDiff = 0;

  if (oldStatus === "valid") validDiff -= 1;
  if (oldStatus === "warning") warningDiff -= 1;
  if (oldStatus === "error") errorDiff -= 1;

  if (newStatus === "valid") validDiff += 1;
  if (newStatus === "warning") warningDiff += 1;
  if (newStatus === "error") errorDiff += 1;

  await ctx.db.patch(workspaceId, {
    validRecords: Math.max(0, (ws.validRecords || 0) + validDiff),
    warningRecords: Math.max(0, (ws.warningRecords || 0) + warningDiff),
    errorRecords: Math.max(0, (ws.errorRecords || 0) + errorDiff),
    updatedAt: Date.now(),
  });
}
