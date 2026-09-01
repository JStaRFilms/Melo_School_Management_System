import { mutation, query } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { assertMigrationAccess } from "./migrationAuth";

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
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const auth = await assertMigrationAccess(ctx, args.schoolId);
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
      admissionNumberPrefix: args.admissionNumberPrefix?.trim() || undefined,
      nextAdmissionSequence: args.nextAdmissionSequence ?? 1,
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
    await assertMigrationAccess(ctx, args.schoolId);

    const workspaces = await ctx.db
      .query("importWorkspaces")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .order("desc")
      .take(50);

    return workspaces;
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
    await assertMigrationAccess(ctx, args.schoolId);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.schoolId !== args.schoolId) {
      return null;
    }

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
      v.union(v.literal("valid"), v.literal("warning"), v.literal("error"))
    ),
    entityType: v.optional(v.union(v.literal("student"), v.literal("grade_record"))),
    limit: v.optional(v.number()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    await assertMigrationAccess(ctx, args.schoolId);

    // Enforce workspace tenant ownership
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.schoolId !== args.schoolId) {
      throw new ConvexError("Workspace not found");
    }

    if (args.paginationOpts) {
      if (args.validationStatus) {
        return await ctx.db
          .query("stagedImportRecords")
          .withIndex("by_workspaceId_and_validationStatus", (q) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("validationStatus", args.validationStatus!)
          )
          .paginate(args.paginationOpts);
      }

      if (args.entityType) {
        return await ctx.db
          .query("stagedImportRecords")
          .withIndex("by_workspaceId_and_entityType", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("entityType", args.entityType!)
          )
          .paginate(args.paginationOpts);
      }

      return await ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
        .paginate(args.paginationOpts);
    }

    const maxItems = Math.min(args.limit ?? 200, 1000);

    if (args.validationStatus) {
      const records = await ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId_and_validationStatus", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("validationStatus", args.validationStatus!)
        )
        .take(maxItems);
      return records;
    }

    if (args.entityType) {
      const records = await ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId_and_entityType", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("entityType", args.entityType!)
        )
        .take(maxItems);
      return records;
    }

    const records = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .take(maxItems);

    return records;
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

    if (args.workspaceId) {
      const workspace = await ctx.db.get(args.workspaceId);
      if (!workspace || workspace.schoolId !== args.schoolId) {
        throw new ConvexError("Workspace not found");
      }
    }

    const signals = await ctx.db
      .query("migrationFeatureSignals")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .take(100);

    return signals;
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
    await assertMigrationAccess(ctx, args.schoolId);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.schoolId !== args.schoolId) {
      throw new ConvexError("Workspace not found");
    }

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
