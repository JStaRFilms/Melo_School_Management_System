import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";

/**
 * Strict Invariant (F3 / MX-11):
 * ZERO DIRECT AI COMMITS.
 * All AI extractions stage into `aiImportWorkspaces` for human review.
 * The AI service possesses zero direct write permissions to operational tables.
 */

export interface StagedRowValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

const SECRET_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i,
  /bearer/i,
  /auth[_-]?code/i,
  /credit[_-]?card/i,
];

/**
 * Strips secrets, passwords, and sensitive authentication credentials from rows prior to staging.
 */
export function sanitizeImportRow(
  rawRow: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawRow)) {
    // Check if key looks like a credential/secret
    if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      continue; // Strip entirely
    }

    if (typeof value === "string") {
      // Check for JWT token pattern
      if (/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)) {
        continue; // Strip JWTs
      }
      // Check for Bearer token pattern
      if (/^bearer\s+[A-Za-z0-9_\-\.]+/i.test(value)) {
        continue;
      }
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Deterministically validates student rows against schema & uniqueness invariants.
 */
export async function validateStudentRows(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  rows: Record<string, any>[]
): Promise<StagedRowValidationError[]> {
  const errors: StagedRowValidationError[] = [];
  const seenAdmissionNumbers = new Map<string, number>(); // admissionNumber -> first rowIndex

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Name validation
    const firstName = row.firstName || row.first_name;
    const lastName = row.lastName || row.last_name;

    if (!firstName || typeof firstName !== "string" || firstName.trim() === "") {
      errors.push({
        rowIndex: i,
        field: "firstName",
        message: "First name is required and cannot be empty",
      });
    }

    if (!lastName || typeof lastName !== "string" || lastName.trim() === "") {
      errors.push({
        rowIndex: i,
        field: "lastName",
        message: "Last name is required and cannot be empty",
      });
    }

    // 2. Date of birth validation
    if (row.dateOfBirth !== undefined && row.dateOfBirth !== null && row.dateOfBirth !== "") {
      let dobTimestamp: number | null = null;
      if (typeof row.dateOfBirth === "number") {
        dobTimestamp = row.dateOfBirth;
      } else if (typeof row.dateOfBirth === "string") {
        const parsed = Date.parse(row.dateOfBirth);
        if (!isNaN(parsed)) {
          dobTimestamp = parsed;
        }
      }

      const now = Date.now();
      const minValidYear = new Date(1920, 0, 1).getTime();

      if (dobTimestamp === null || dobTimestamp > now || dobTimestamp < minValidYear) {
        errors.push({
          rowIndex: i,
          field: "dateOfBirth",
          message: "Date of birth must be a valid timestamp or date in the past",
        });
      }
    }

    // 3. Admission number uniqueness (within batch and against database)
    const admissionNumber = row.admissionNumber || row.admission_number;
    if (admissionNumber && typeof admissionNumber === "string") {
      const normalizedAdm = admissionNumber.trim();
      if (seenAdmissionNumbers.has(normalizedAdm)) {
        errors.push({
          rowIndex: i,
          field: "admissionNumber",
          message: `Duplicate admission number in import batch: "${normalizedAdm}" (first seen at row ${seenAdmissionNumbers.get(normalizedAdm)! + 1})`,
        });
      } else {
        seenAdmissionNumbers.set(normalizedAdm, i);

        // Check against active operational students table
        const existingStudent = await ctx.db
          .query("students")
          .withIndex("by_school_and_admission_number", (q) =>
            q.eq("schoolId", schoolId).eq("admissionNumber", normalizedAdm)
          )
          .first();

        if (existingStudent) {
          errors.push({
            rowIndex: i,
            field: "admissionNumber",
            message: `Admission number "${normalizedAdm}" already exists for an active student in this school`,
          });
        }
      }
    }

    // 4. Gender validation
    if (row.gender && typeof row.gender === "string") {
      const g = row.gender.toLowerCase().trim();
      if (!["male", "female", "other", "unspecified"].includes(g)) {
        errors.push({
          rowIndex: i,
          field: "gender",
          message: `Invalid gender: "${row.gender}". Expected Male, Female, or Other`,
        });
      }
    }
  }

  return errors;
}

/**
 * Stages extracted AI import rows into a review workspace.
 * Non-negotiable invariant: ZERO DIRECT COMMITS.
 * All rows are sanitized, checked deterministically, and placed in 'staged' status.
 */
export const stageImportData = mutation({
  args: {
    schoolId: v.id("schools"),
    importer: v.optional(v.string()),
    importerUserId: v.optional(v.id("users")),
    entityType: v.union(
      v.literal("students"),
      v.literal("teachers"),
      v.literal("curriculum"),
      v.literal("grades")
    ),
    rawRows: v.array(v.record(v.string(), v.any())),
    rawTokenCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    // 1. Sanitize rows and strip secrets/credentials
    const sanitizedRows = args.rawRows.map(sanitizeImportRow);

    // 2. Deterministic validation
    let validationErrors: StagedRowValidationError[] = [];
    if (args.entityType === "students") {
      validationErrors = await validateStudentRows(
        ctx,
        args.schoolId,
        sanitizedRows
      );
    }

    const now = Date.now();
    const importerIdentifier =
      args.importer ??
      (args.importerUserId ? String(args.importerUserId) : "ai_service");

    // 3. Stage in aiImportWorkspaces table
    const workspaceId = await ctx.db.insert("aiImportWorkspaces", {
      schoolId: args.schoolId,
      importer: importerIdentifier,
      importerUserId: args.importerUserId,
      entityType: args.entityType,
      status: "staged",
      rawTokenCount: args.rawTokenCount,
      stagedRows: sanitizedRows,
      validationErrors,
      createdAt: now,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "ai-importer@melo.school",
      module: "ai_import",
      action: "stage_ai_import",
      targetType: "aiImportWorkspaces",
      targetId: String(workspaceId),
      outcome: "success",
      safeSummary: `Staged ${sanitizedRows.length} ${args.entityType} rows for operator review (${validationErrors.length} validation errors flagged)`,
    });

    return {
      workspaceId,
      status: "staged" as const,
      rowCount: sanitizedRows.length,
      errorCount: validationErrors.length,
      validationErrors,
    };
  },
});

/**
 * Allows human reviewer to correct a cell before commit.
 * Re-evaluates deterministic validation and updates status to 'reviewed'.
 */
export const updateStagedRow = mutation({
  args: {
    workspaceId: v.id("aiImportWorkspaces"),
    rowIndex: v.number(),
    updatedFields: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    if (workspace.status === "committed" || workspace.status === "rejected") {
      throw new ConvexError(
        `Cannot update workspace in terminal status "${workspace.status}"`
      );
    }

    if (args.rowIndex < 0 || args.rowIndex >= workspace.stagedRows.length) {
      throw new ConvexError(
        `Row index ${args.rowIndex} out of bounds (workspace has ${workspace.stagedRows.length} rows)`
      );
    }

    // Merge updated fields with sanitization
    const updatedRows = [...workspace.stagedRows];
    const sanitizedUpdates = sanitizeImportRow(args.updatedFields);
    updatedRows[args.rowIndex] = {
      ...updatedRows[args.rowIndex],
      ...sanitizedUpdates,
    };

    // Re-run deterministic validation across all rows
    let newValidationErrors: StagedRowValidationError[] = [];
    if (workspace.entityType === "students") {
      newValidationErrors = await validateStudentRows(
        ctx,
        workspace.schoolId,
        updatedRows
      );
    }

    const now = Date.now();
    await ctx.db.patch(workspace._id, {
      stagedRows: updatedRows,
      validationErrors: newValidationErrors,
      status: "reviewed",
      reviewedAt: now,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: workspace.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "reviewer@melo.school",
      module: "ai_import",
      action: "update_staged_row",
      targetType: "aiImportWorkspaces",
      targetId: String(workspace._id),
      outcome: "success",
      safeSummary: `Human reviewer updated row ${args.rowIndex + 1} in workspace ${workspace._id}; remaining errors: ${newValidationErrors.length}`,
    });

    return {
      success: true,
      workspaceId: workspace._id,
      remainingErrors: newValidationErrors,
    };
  },
});

/**
 * Atomically commits a reviewed workspace into operational tables (e.g. students, classes).
 * Non-negotiable invariant:
 * 1. Must be in 'staged' or 'reviewed' status.
 * 2. Zero unhandled blocking validation errors allowed.
 */
export const commitImportWorkspace = mutation({
  args: {
    workspaceId: v.id("aiImportWorkspaces"),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new ConvexError("Workspace not found");
    }

    if (workspace.status === "committed") {
      return {
        success: true,
        alreadyCommitted: true,
        committedCount: workspace.commitResult?.committedCount ?? 0,
        workspaceId: workspace._id,
      };
    }

    if (workspace.status !== "staged" && workspace.status !== "reviewed") {
      throw new ConvexError(
        `Workspace cannot be committed from status "${workspace.status}"`
      );
    }

    // Blocking Invariant: Committing with any unresolved validation errors is strictly rejected
    if (workspace.validationErrors && workspace.validationErrors.length > 0) {
      throw new ConvexError(
        `Cannot commit workspace with ${workspace.validationErrors.length} unresolved validation errors. All rows must pass deterministic validation before commit.`
      );
    }

    const now = Date.now();

    // Commit operational records based on entityType
    if (workspace.entityType === "students") {
      // Find or create default class for intake
      let defaultClass = await ctx.db
        .query("classes")
        .withIndex("by_school", (q) => q.eq("schoolId", workspace.schoolId))
        .first();

      if (!defaultClass) {
        const classId = await ctx.db.insert("classes", {
          schoolId: workspace.schoolId,
          name: "General Intake",
          level: "Junior",
          createdAt: now,
          updatedAt: now,
        });
        defaultClass = (await ctx.db.get(classId))!;
      }

      for (let i = 0; i < workspace.stagedRows.length; i++) {
        const row = workspace.stagedRows[i];
        const firstName = row.firstName || row.first_name || "Student";
        const lastName = row.lastName || row.last_name || `${i + 1}`;
        const fullName = `${firstName} ${lastName}`.trim();
        const admissionNumber =
          row.admissionNumber ||
          row.admission_number ||
          `ADM-${Date.now().toString().slice(-4)}-${i + 1}`;

        // Create linked user account for student
        const studentEmail =
          row.email ||
          `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@melo.internal`;

        const userId = await ctx.db.insert("users", {
          schoolId: workspace.schoolId,
          authId: `imported_student_${now}_${i}`,
          authTokenIdentifier: `imported_student_${now}_${i}`,
          name: fullName,
          email: studentEmail,
          role: "student",
          isSchoolAdmin: false,
          createdAt: now,
          updatedAt: now,
        });

        // Insert official operational student record
        await ctx.db.insert("students", {
          schoolId: workspace.schoolId,
          classId: defaultClass._id,
          userId,
          admissionNumber,
          gender: row.gender,
          dateOfBirth:
            typeof row.dateOfBirth === "number" ? row.dateOfBirth : undefined,
          guardianName: row.guardianName,
          guardianPhone: row.guardianPhone,
          address: row.address,
          enrollmentStatus: "active",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Mark workspace committed atomically
    await ctx.db.patch(workspace._id, {
      status: "committed",
      committedAt: now,
      commitResult: {
        committedCount: workspace.stagedRows.length,
        timestamp: now,
      },
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: workspace.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "reviewer@melo.school",
      module: "ai_import",
      action: "commit_ai_import",
      targetType: "aiImportWorkspaces",
      targetId: String(workspace._id),
      outcome: "success",
      safeSummary: `Atomically committed ${workspace.stagedRows.length} ${workspace.entityType} records into operational database`,
    });

    return {
      success: true,
      committedCount: workspace.stagedRows.length,
      workspaceId: workspace._id,
    };
  },
});

/**
 * Fetches an import workspace with its staged rows and validation errors.
 */
export const getImportWorkspace = query({
  args: {
    workspaceId: v.id("aiImportWorkspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workspaceId);
  },
});

/**
 * Lists import workspaces for a school.
 */
export const listImportWorkspaces = query({
  args: {
    schoolId: v.id("schools"),
    status: v.optional(
      v.union(
        v.literal("staged"),
        v.literal("reviewed"),
        v.literal("committed"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("aiImportWorkspaces")
        .withIndex("by_school_and_status", (q) =>
          q.eq("schoolId", args.schoolId).eq("status", args.status!)
        )
        .order("desc")
        .take(50);
    }

    return await ctx.db
      .query("aiImportWorkspaces")
      .withIndex("by_school_and_status", (q) => q.eq("schoolId", args.schoolId))
      .order("desc")
      .take(50);
  },
});
