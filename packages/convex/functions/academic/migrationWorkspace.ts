import { mutation, query } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { assertMigrationAccess, type MigrationCtx } from "./migrationAuth";
import type { Id } from "../../_generated/dataModel";
import { proposeAdmissionNumberHelper } from "./admissionNumbers";

/** Staging content is private even to other administrators of the same branch. */
export async function getPrivateMigrationWorkspace(
  ctx: MigrationCtx,
  schoolId: Id<"schools">,
  workspaceId: Id<"importWorkspaces">,
) {
  const auth = await assertMigrationAccess(ctx, schoolId);
  const workspace = await ctx.db.get(workspaceId);
  if (
    !workspace ||
    workspace.schoolId !== schoolId ||
    workspace.createdBy !== auth.callerId
  ) {
    throw new ConvexError("Workspace not found");
  }
  return { auth, workspace };
}

/**
 * Creates a new Data Migration Workspace for a school.
 */
export const createWorkspace = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    mode: v.union(v.literal("school_admin"), v.literal("super_admin")),
    admissionNumberPrefix: v.optional(v.string()),
    nextAdmissionSequence: v.optional(v.number()),
    sourceFiles: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          fileSize: v.number(),
          uploadedAt: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await assertMigrationAccess(ctx, args.schoolId);
    if (args.sourceFiles?.length) {
      throw new ConvexError(
        "Temporary file storage is unavailable until private upload controls are configured",
      );
    }
    if (
      args.admissionNumberPrefix !== undefined ||
      args.nextAdmissionSequence !== undefined
    ) {
      throw new ConvexError(
        "Import-local numbering is disabled; use the reviewed official admission-number policy",
      );
    }
    if ((args.mode === "super_admin") !== auth.isSuperAdmin) {
      throw new ConvexError(
        "Workspace mode does not match authenticated actor",
      );
    }
    const now = Date.now();

    const workspaceId = await ctx.db.insert("importWorkspaces", {
      schoolId: args.schoolId,
      name: args.name.trim(),
      mode: args.mode,
      status: "draft",
      totalRecords: 0,
      validRecords: 0,
      warningRecords: 0,
      errorRecords: 0,
      sourceFiles: args.sourceFiles ?? [],
      admissionNumberPrefix: undefined,
      nextAdmissionSequence: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.callerId,
    });

    return workspaceId;
  },
});

/**
 * Lists all migration workspaces for a given school.
 */
export const listWorkspaces = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const auth = await assertMigrationAccess(ctx, args.schoolId);

    const workspaces = await ctx.db
      .query("importWorkspaces")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .order("desc")
      .take(50);

    return workspaces.filter(
      (workspace) => workspace.createdBy === auth.callerId,
    );
  },
});

/**
 * Gets high-level summary and counts for a specific workspace.
 */
export const getWorkspaceSummary = query({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      args.workspaceId,
    );
    return workspace;
  },
});

/**
 * Gets staged records for a workspace with optional status / type filtering.
 * Enforces strict workspace tenant ownership.
 */
export const getWorkspaceRecords = query({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    validationStatus: v.optional(
      v.union(v.literal("valid"), v.literal("warning"), v.literal("error")),
    ),
    entityType: v.optional(
      v.union(v.literal("student"), v.literal("grade_record")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);

    const maxItems = Math.min(args.limit ?? 200, 1000);

    if (args.validationStatus) {
      const records = await ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId_and_validationStatus", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("validationStatus", args.validationStatus!),
        )
        .take(maxItems);
      return records;
    }

    if (args.entityType) {
      const records = await ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId_and_entityType", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("entityType", args.entityType!),
        )
        .take(maxItems);
      return records;
    }

    const records = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_rowNumber", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .take(maxItems);

    return records;
  },
});

/** Paginated records for the routed workbench; every page repeats private ownership checks. */
export const getWorkspaceRecordsPage = query({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);
    return await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_rowNumber", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .paginate(args.paginationOpts);
  },
});

/** Bounded existing entities that a reviewer may select. Text labels are never commit instructions. */
export const getWorkspaceReviewOptions = query({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
  },
  handler: async (ctx, args) => {
    await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);
    const [classes, subjects, families, students, users, sessions] =
      await Promise.all([
        ctx.db
          .query("classes")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
          .take(200),
        ctx.db
          .query("subjects")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
          .take(200),
        ctx.db
          .query("families")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
          .take(200),
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
          .take(500),
        ctx.db
          .query("users")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
          .take(500),
        ctx.db
          .query("academicSessions")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
          .take(50),
      ]);
    const enrolledUserIds = new Set(
      students.map((student) => String(student.userId)),
    );
    const userNames = new Map(
      users.map((user) => [String(user._id), user.name]),
    );
    const sessionOptions = [];
    for (const session of sessions) {
      const terms = await ctx.db
        .query("academicTerms")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .take(20);
      sessionOptions.push({
        id: session._id,
        name: session.name,
        terms: terms.map((term) => ({ id: term._id, name: term.name })),
      });
    }
    type NumberingOption =
      | {
          available: true;
          nextNumber: string;
          nextSequence: number;
          policyVersion: number;
          formatVersion: string;
          counterKey: string;
          counterVersion: number;
        }
      | { available: false; reason: string };
    const uniqueLevels = [...new Set(classes.map((item) => item.level))];
    if (uniqueLevels.length > 50) {
      throw new ConvexError(
        "Class level directory exceeds supported numbering review size",
      );
    }
    const byLevel: Array<{ level: string; numbering: NumberingOption }> = [];
    for (const level of uniqueLevels) {
      try {
        const proposal = await proposeAdmissionNumberHelper(ctx, {
          schoolId: args.schoolId,
          level,
        });
        byLevel.push({
          level,
          numbering: {
            available: true,
            nextNumber: proposal.allocatedNumber,
            nextSequence: proposal.sequenceNumber,
            policyVersion: proposal.policyVersion,
            formatVersion: proposal.formatVersion,
            counterKey: proposal.counterKey,
            counterVersion: proposal.counterVersion,
          },
        });
      } catch (error) {
        byLevel.push({
          level,
          numbering: {
            available: false,
            reason:
              error instanceof Error
                ? error.message
                : "Official numbering is unavailable",
          },
        });
      }
    }
    const numbering: NumberingOption = byLevel[0]?.numbering ?? {
      available: false,
      reason: "Select an existing class to review its exact counter",
    };
    return {
      classes: classes.map((item) => ({
        id: item._id,
        name: item.name,
        level: item.level,
      })),
      subjects: subjects.map((item) => ({ id: item._id, name: item.name })),
      families: families.map((item) => ({ id: item._id, name: item.name })),
      students: students.map((item) => ({
        id: item._id,
        name: userNames.get(String(item.userId)) ?? item.admissionNumber,
        admissionNumber: item.admissionNumber,
        classId: item.classId,
        familyId: item.familyId,
      })),
      availableStudentUsers: users
        .filter(
          (user) =>
            user.role === "student" &&
            !user.isArchived &&
            !enrolledUserIds.has(String(user._id)),
        )
        .slice(0, 200)
        .map((user) => ({ id: user._id, name: user.name })),
      sessions: sessionOptions,
      numbering,
      numberingByLevel: byLevel,
      bounded: true,
    };
  },
});

/**
 * Gets product intelligence signals mined from uncatered spreadsheet headers.
 */
export const getWorkspaceFeatureSignals = query({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.optional(v.id("importWorkspaces")),
  },
  handler: async (ctx, args) => {
    await assertMigrationAccess(ctx, args.schoolId);

    if (!args.workspaceId) return [];
    await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);

    const signals = await ctx.db
      .query("migrationFeatureSignals")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .take(100);

    return signals
      .filter((signal) => signal.workspaceId === args.workspaceId)
      .map(({ sampleValue: _sampleValue, ...signal }) => signal);
  },
});

/**
 * Cancels a workspace, preventing further merges.
 */
export const cancelWorkspace = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
  },
  handler: async (ctx, args) => {
    const { workspace } = await getPrivateMigrationWorkspace(
      ctx,
      args.schoolId,
      args.workspaceId,
    );

    if (workspace.status === "merged") {
      throw new ConvexError("Cannot cancel an already merged workspace");
    }

    if (workspace.status === "cancelled") {
      return { success: true };
    }

    await ctx.db.patch(args.workspaceId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
