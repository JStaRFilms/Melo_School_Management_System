import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
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
  const seenUserIds = new Map<string, number>();

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

    // 3. Imports preserve supplied historical numbers. H4 allocation is not
    // available in this pipeline, so a missing number blocks review/commit.
    const admissionNumber = row.admissionNumber || row.admission_number;
    if (!admissionNumber || typeof admissionNumber !== "string" || admissionNumber.trim() === "") {
      errors.push({
        rowIndex: i,
        field: "admissionNumber",
        message: "Admission number is required until an H4 allocator proposal is reviewed",
      });
    } else {
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

    // 4. A student import must reference a pre-provisioned student user. The
    // import pipeline never invents auth IDs or token identifiers.
    const userId = row.userId;
    if (!userId || typeof userId !== "string") {
      errors.push({
        rowIndex: i,
        field: "userId",
        message: "A pre-provisioned student userId is required; imports cannot create credentials",
      });
    } else if (seenUserIds.has(userId)) {
      errors.push({
        rowIndex: i,
        field: "userId",
        message: `Duplicate student userId in import batch (first seen at row ${seenUserIds.get(userId)! + 1})`,
      });
    } else {
      seenUserIds.set(userId, i);
      let linkedUser: Doc<"users"> | null = null;
      try {
        linkedUser = await ctx.db.get("users", userId as Id<"users">);
      } catch {
        // Invalid document IDs are validation failures, not transaction errors.
      }
      if (!linkedUser || linkedUser.schoolId !== schoolId || linkedUser.role !== "student" || linkedUser.isArchived) {
        errors.push({
          rowIndex: i,
          field: "userId",
          message: "student userId must reference an active student user in this school",
        });
      } else {
        const existingStudentForUser = await ctx.db
          .query("students")
          .withIndex("by_school_and_user", (q) =>
            q.eq("schoolId", schoolId).eq("userId", linkedUser._id)
          )
          .first();
        if (existingStudentForUser) {
          errors.push({
            rowIndex: i,
            field: "userId",
            message: "student userId is already enrolled in this school",
          });
        }
      }
    }

    // 5. Gender validation
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
    const actor = await requireCapability(ctx, args.schoolId, "enrollment.intakes.manage");
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }
    if (args.entityType !== "students") {
      throw new ConvexError(`AI import entity type "${args.entityType}" is not supported for commit`);
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
    const importerIdentifier = actor.personId
      ? String(actor.personId)
      : actor.userId
        ? String(actor.userId)
        : "platform_admin";

    // 3. Stage in aiImportWorkspaces table
    const workspaceId = await ctx.db.insert("aiImportWorkspaces", {
      schoolId: args.schoolId,
      importer: importerIdentifier,
      importerUserId: actor.userId,
      ownerMembershipId: actor.membershipId,
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
    const actor = await requireCapability(ctx, workspace.schoolId, "enrollment.intakes.manage");
    if (
      workspace.ownerMembershipId &&
      !actor.isPlatformAdmin &&
      actor.membershipId !== workspace.ownerMembershipId
    ) {
      throw new ConvexError("Only the workspace owner may update this import");
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
      // Editing invalidates a prior approval. Review is an explicit separate act.
      status: "staged",
      reviewedAt: undefined,
      reviewedBy: undefined,
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

/** Explicitly records a human approval after deterministic validation succeeds. */
export const approveImportWorkspace = mutation({
  args: { workspaceId: v.id("aiImportWorkspaces") },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new ConvexError("Workspace not found");
    const actor = await requireCapability(ctx, workspace.schoolId, "enrollment.intakes.manage");
    if (workspace.ownerMembershipId && !actor.isPlatformAdmin && actor.membershipId !== workspace.ownerMembershipId) {
      throw new ConvexError("Only the workspace owner may approve this import");
    }
    if (workspace.status !== "staged") {
      throw new ConvexError(`Workspace cannot be approved from status "${workspace.status}"`);
    }
    if (workspace.entityType !== "students") {
      throw new ConvexError(`AI import entity type "${workspace.entityType}" is not supported for commit`);
    }
    if (workspace.validationErrors.length > 0) {
      throw new ConvexError(`Cannot approve workspace with ${workspace.validationErrors.length} unresolved validation errors`);
    }
    const now = Date.now();
    const reviewedBy = actor.personId ? String(actor.personId) : actor.userId ? String(actor.userId) : "platform_admin";
    await ctx.db.patch(workspace._id, { status: "reviewed", reviewedAt: now, reviewedBy, updatedAt: now });
    return { success: true, workspaceId: workspace._id, status: "reviewed" as const };
  },
});

/**
 * Atomically commits an explicitly reviewed workspace into supported operational tables.
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
    const actor = await requireCapability(ctx, workspace.schoolId, "enrollment.intakes.manage");
    if (
      workspace.ownerMembershipId &&
      !actor.isPlatformAdmin &&
      actor.membershipId !== workspace.ownerMembershipId
    ) {
      throw new ConvexError("Only the workspace owner may commit this import");
    }

    if (workspace.status === "committed") {
      return {
        success: true,
        alreadyCommitted: true,
        committedCount: workspace.commitResult?.committedCount ?? 0,
        workspaceId: workspace._id,
      };
    }

    if (workspace.status !== "reviewed" || !workspace.reviewedAt || !workspace.reviewedBy) {
      throw new ConvexError("Workspace requires explicit reviewed approval before commit");
    }
    if (workspace.entityType !== "students") {
      throw new ConvexError(`AI import entity type "${workspace.entityType}" is not supported for commit`);
    }

    // Approval is only a snapshot. Re-run deterministic tenant, relationship,
    // admission-number, and user-enrollment validation in this same commit
    // transaction so concurrent operational writes cannot bypass review.
    const transactionalValidationErrors = await validateStudentRows(
      ctx,
      workspace.schoolId,
      workspace.stagedRows
    );
    if (transactionalValidationErrors.length > 0) {
      throw new ConvexError(
        `Cannot commit workspace: ${transactionalValidationErrors.length} validation errors were found during transactional revalidation.`
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
        const admissionNumber = row.admissionNumber || row.admission_number;
        const userId = row.userId as Id<"users">;

        // Validation and explicit approval above establish these prerequisites;
        // this path deliberately performs no credential or H4-number fabrication.
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
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return null;
    const actor = await requireCapability(ctx, workspace.schoolId, "enrollment.intakes.manage");
    if (
      workspace.ownerMembershipId &&
      !actor.isPlatformAdmin &&
      actor.membershipId !== workspace.ownerMembershipId
    ) {
      throw new ConvexError("Only the workspace owner may view this import");
    }
    return workspace;
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
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage"
    );
    const workspaces = args.status
      ? await ctx.db
          .query("aiImportWorkspaces")
          .withIndex("by_school_and_status", (q) =>
            q.eq("schoolId", args.schoolId).eq("status", args.status!)
          )
          .order("desc")
          .take(50)
      : await ctx.db
          .query("aiImportWorkspaces")
          .withIndex("by_school_and_status", (q) => q.eq("schoolId", args.schoolId))
          .order("desc")
          .take(50);

    return actor.isPlatformAdmin
      ? workspaces
      : workspaces.filter(
          (workspace) =>
            !workspace.ownerMembershipId ||
            workspace.ownerMembershipId === actor.membershipId
        );
  },
});
