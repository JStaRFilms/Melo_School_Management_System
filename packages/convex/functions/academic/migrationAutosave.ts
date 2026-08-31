import { mutation } from "../../_generated/server";
import { v } from "convex/values";
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
      throw new Error("Staged record not found");
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

    const now = Date.now();
    await ctx.db.patch(args.recordId, {
      parsedData: updatedParsed,
      validationStatus,
      validationErrors,
      familyClusterKey,
      updatedAt: now,
    });

    // Refresh workspace summary
    await refreshWorkspaceCounters(ctx, record.workspaceId);

    return { success: true, validationStatus, validationErrors };
  },
});

/**
 * Resolves a detected clash between a staged row and another staged/live record.
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
      throw new Error("Staged record not found");
    }

    const validationStatus = record.validationErrors.length > 0 ? "error" : "valid";

    await ctx.db.patch(args.recordId, {
      isResolved: true,
      resolutionAction: args.resolutionAction,
      existingStudentId: args.targetStudentId ?? record.existingStudentId,
      validationStatus,
      updatedAt: Date.now(),
    });

    await refreshWorkspaceCounters(ctx, record.workspaceId);

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

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.schoolId !== args.schoolId) {
      throw new Error("Workspace not found");
    }

    const currentYear = new Date().getFullYear();
    const prefix =
      args.prefix?.trim() || workspace.admissionNumberPrefix || `SCH/${currentYear}/`;
    let seq = args.startingSequence ?? workspace.nextAdmissionSequence ?? 1;

    const stagedStudents = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_entityType", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("entityType", "student")
      )
      .take(1000);

    let assignedCount = 0;
    const now = Date.now();

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

    await refreshWorkspaceCounters(ctx, args.workspaceId);

    return { assignedCount, nextSequence: seq };
  },
});

async function refreshWorkspaceCounters(ctx: any, workspaceId: any) {
  const allStaged = await ctx.db
    .query("stagedImportRecords")
    .withIndex("by_workspaceId", (q: any) => q.eq("workspaceId", workspaceId))
    .take(1000);

  const validCount = allStaged.filter((r: any) => r.validationStatus === "valid").length;
  const warningCount = allStaged.filter((r: any) => r.validationStatus === "warning").length;
  const errorCount = allStaged.filter((r: any) => r.validationStatus === "error").length;

  await ctx.db.patch(workspaceId, {
    totalRecords: allStaged.length,
    validRecords: validCount,
    warningRecords: warningCount,
    errorRecords: errorCount,
    updatedAt: Date.now(),
  });
}
