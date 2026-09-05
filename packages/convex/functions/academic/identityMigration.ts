import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

/**
 * MX-01 & MX-02: Durable cursor-based batch mutation for backfilling canonical persons
 * and explicit branch memberships from existing users table without altering operational schoolIds.
 */
class IdentityMigrationError extends Error {
  constructor(
    readonly code: "missing_canonical_token" | "duplicate_canonical_token" | "mismatched_prelink" | "duplicate_membership" | "migration_error",
    message: string,
  ) {
    super(message);
  }
}

async function reportIdentityMigrationIssue(
  ctx: MutationCtx,
  args: {
    sliceId: string;
    userId: Id<"users">;
    schoolId: Id<"schools">;
    code: "missing_canonical_token" | "duplicate_canonical_token" | "mismatched_prelink" | "duplicate_membership" | "migration_error";
    message: string;
    now: number;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("identityMigrationIssues")
    .withIndex("by_slice_and_user_and_code", (q) =>
      q.eq("sliceId", args.sliceId).eq("userId", args.userId).eq("code", args.code)
    )
    .take(2);
  for (const issue of existing) {
    if (issue.status === "open") {
      await ctx.db.patch(issue._id, { message: args.message, updatedAt: args.now });
      return;
    }
  }
  await ctx.db.insert("identityMigrationIssues", {
    sliceId: args.sliceId,
    userId: args.userId,
    schoolId: args.schoolId,
    code: args.code,
    message: args.message,
    status: "open",
    createdAt: args.now,
    updatedAt: args.now,
  });
}

/**
 * MX-01: Backfill identity links without using mutable email or promoting a
 * Better Auth subject/authId into a canonical token identifier.
 */
export const backfillCanonicalIdentityBatch = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    sliceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sliceId = args.sliceId ?? "MX-01";
    const batchSize = Math.min(Math.max(args.batchSize ?? 150, 1), 150);
    const now = Date.now();
    const priorRuns = await ctx.db
      .query("migrationRuns")
      .withIndex("by_slice_and_batch", (q) => q.eq("sliceId", sliceId))
      .order("desc")
      .take(1);
    const run = priorRuns[0] ?? null;

    // There is exactly one authoritative state record for a slice. A completed
    // run is idempotent; a failed end-of-stream run can complete only after its
    // reviewed issues have been resolved.
    const openIssues = await ctx.db
      .query("identityMigrationIssues")
      .withIndex("by_slice_and_status", (q) => q.eq("sliceId", sliceId).eq("status", "open"))
      .take(1);
    if (run?.status === "completed") {
      return { cursor: null, isDone: true, processedCount: run.processedCount, failedCount: run.failedCount };
    }
    if (run?.status === "failed" && run.cursor === null) {
      if (openIssues.length > 0) {
        return { cursor: null, isDone: true, processedCount: run.processedCount, failedCount: run.failedCount };
      }
      await ctx.db.patch(run._id, { status: "completed", completedAt: now, updatedAt: now });
      return { cursor: null, isDone: true, processedCount: run.processedCount, failedCount: run.failedCount };
    }

    const runId = run?._id ?? await ctx.db.insert("migrationRuns", {
      sliceId,
      batchNumber: (priorRuns[0]?.batchNumber ?? 0) + 1,
      cursor: args.cursor ?? null,
      processedCount: 0,
      failedCount: 0,
      status: "in_progress",
      startedAt: now,
      updatedAt: now,
    });
    const cursor = run?.cursor ?? args.cursor ?? null;
    const result = await ctx.db.query("users").order("asc").paginate({
      numItems: batchSize,
      cursor,
    });
    let processedCount = 0;
    let failedCount = 0;

    for (const user of result.page) {
      try {
        const tokenIdentifier = user.authTokenIdentifier;
        let person = user.personId ? await ctx.db.get(user.personId) : null;
        if (user.personId && !person) {
          throw new IdentityMigrationError("mismatched_prelink", "Legacy user points to a missing canonical person");
        }
        if (person?.authTokenIdentifier && person.authTokenIdentifier !== tokenIdentifier) {
          throw new IdentityMigrationError("mismatched_prelink", "Legacy user and canonical person have different token identifiers");
        }

        if (!person && tokenIdentifier) {
          const canonicalMatches = await ctx.db
            .query("persons")
            .withIndex("by_token_identifier", (q) =>
              q.eq("authTokenIdentifier", tokenIdentifier)
            )
            .take(2);
          if (canonicalMatches.length > 1) {
            throw new IdentityMigrationError("duplicate_canonical_token", "Multiple canonical persons share a token identifier");
          }
          person = canonicalMatches[0] ?? null;
        }

        let personId: Id<"persons">;
        if (person) {
          personId = person._id;
          if (tokenIdentifier && !person.authTokenIdentifier) {
            await ctx.db.patch(personId, {
              authTokenIdentifier: tokenIdentifier,
              identityReconciliationState: "resolved",
              updatedAt: now,
            });
          }
        } else {
          personId = await ctx.db.insert("persons", {
            authTokenIdentifier: tokenIdentifier,
            identityReconciliationState: tokenIdentifier ? "resolved" : "reconciliation_required",
            email: user.email,
            name: user.name,
            status: user.isArchived ? "archived" : "active",
            primarySchoolId: user.schoolId,
            createdAt: user.createdAt ?? now,
            updatedAt: now,
          });
        }

        if (user.personId !== personId) {
          await ctx.db.patch(user._id, { personId, updatedAt: now });
        }
        if (!tokenIdentifier) {
          throw new IdentityMigrationError("missing_canonical_token", "Legacy user requires trusted token reconciliation before migration completion");
        }

        const memberships = await ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_school", (q) =>
            q.eq("personId", personId).eq("schoolId", user.schoolId)
          )
          .take(2);
        if (memberships.length > 1) {
          throw new IdentityMigrationError("duplicate_membership", "Multiple memberships exist for the same person and school");
        }
        const membership = memberships[0];
        if (!membership) {
          await ctx.db.insert("branchMemberships", {
            personId,
            schoolId: user.schoolId,
            status: user.isArchived ? "archived" : "active",
            isDefaultBranch: true,
            legacyUserId: user._id,
            joinedAt: user.createdAt ?? now,
            updatedAt: now,
          });
        } else if (!membership.legacyUserId) {
          await ctx.db.patch(membership._id, { legacyUserId: user._id, updatedAt: now });
        } else if (membership.legacyUserId !== user._id) {
          throw new IdentityMigrationError("mismatched_prelink", "Membership is already linked to another legacy user");
        }
        processedCount++;
      } catch (error) {
        failedCount++;
        const issue = error instanceof IdentityMigrationError
          ? error
          : new IdentityMigrationError("migration_error", "Unexpected identity migration failure requires review");
        await reportIdentityMigrationIssue(ctx, {
          sliceId,
          userId: user._id,
          schoolId: user.schoolId,
          code: issue.code,
          message: issue.message,
          now,
        });
      }
    }

    const nextCursor = result.isDone ? null : result.continueCursor;
    const unresolvedIssues = await ctx.db
      .query("identityMigrationIssues")
      .withIndex("by_slice_and_status", (q) => q.eq("sliceId", sliceId).eq("status", "open"))
      .take(1);
    const totalProcessedCount = (run?.processedCount ?? 0) + processedCount;
    const totalFailedCount = (run?.failedCount ?? 0) + failedCount;
    const status = result.isDone
      ? unresolvedIssues.length === 0 ? "completed" : "failed"
      : "in_progress";
    await ctx.db.patch(runId, {
      cursor: nextCursor,
      processedCount: totalProcessedCount,
      failedCount: totalFailedCount,
      status,
      updatedAt: now,
      completedAt: status === "completed" ? now : undefined,
    });

    if (status === "in_progress") {
      await ctx.scheduler.runAfter(0, internal.functions.academic.identityMigration.backfillCanonicalIdentityBatch, {
        sliceId,
        batchSize,
      });
    }
    return { cursor: nextCursor, isDone: result.isDone, processedCount: totalProcessedCount, failedCount: totalFailedCount };
  },
});

/** Trusted reconciliation for a reviewed legacy-user/token pairing. */
export const reconcileLegacyUserIdentity = internalMutation({
  args: { userId: v.id("users"), authTokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Legacy user not found");
    const now = Date.now();
    const canonicalMatches = await ctx.db
      .query("persons")
      .withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", args.authTokenIdentifier))
      .take(2);
    if (canonicalMatches.length > 1) {
      throw new Error("Token identifier is ambiguous across canonical persons");
    }
    const canonicalPerson = canonicalMatches[0] ?? null;
    const linkedPerson = user.personId ? await ctx.db.get(user.personId) : null;
    if (user.personId && !linkedPerson) throw new Error("Canonical person not found");
    if (linkedPerson?.authTokenIdentifier && linkedPerson.authTokenIdentifier !== args.authTokenIdentifier) {
      throw new Error("Person is already reconciled to another token identifier");
    }
    if (canonicalPerson && linkedPerson && canonicalPerson._id !== linkedPerson._id) {
      throw new Error("Token identifier is already reconciled to another person");
    }

    const personId = linkedPerson?._id ?? canonicalPerson?._id ?? await ctx.db.insert("persons", {
      authTokenIdentifier: args.authTokenIdentifier,
      identityReconciliationState: "resolved",
      email: user.email,
      name: user.name,
      status: user.isArchived ? "archived" : "active",
      primarySchoolId: user.schoolId,
      createdAt: user.createdAt ?? now,
      updatedAt: now,
    });
    if (linkedPerson && !linkedPerson.authTokenIdentifier) {
      await ctx.db.patch(personId, {
        authTokenIdentifier: args.authTokenIdentifier,
        identityReconciliationState: "resolved",
        updatedAt: now,
      });
    }
    await ctx.db.patch(user._id, { personId, authTokenIdentifier: args.authTokenIdentifier, updatedAt: now });

    const memberships = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) => q.eq("personId", personId).eq("schoolId", user.schoolId))
      .take(2);
    if (memberships.length > 1) throw new Error("Canonical membership is ambiguous");
    if (!memberships[0]) {
      await ctx.db.insert("branchMemberships", {
        personId,
        schoolId: user.schoolId,
        status: user.isArchived ? "archived" : "active",
        isDefaultBranch: true,
        legacyUserId: user._id,
        joinedAt: user.createdAt ?? now,
        updatedAt: now,
      });
    } else if (!memberships[0].legacyUserId) {
      await ctx.db.patch(memberships[0]._id, { legacyUserId: user._id, updatedAt: now });
    } else if (memberships[0].legacyUserId !== user._id) {
      throw new Error("Membership is already linked to another legacy user");
    }

    const openIssues = await ctx.db
      .query("identityMigrationIssues")
      .withIndex("by_user_and_status", (q) => q.eq("userId", user._id).eq("status", "open"))
      .take(100);
    const affectedSlices = new Set(openIssues.map((issue) => issue.sliceId));
    for (const issue of openIssues) {
      await ctx.db.patch(issue._id, { status: "resolved", resolvedAt: now, updatedAt: now });
    }
    for (const sliceId of affectedSlices) {
      await ctx.scheduler.runAfter(0, internal.functions.academic.identityMigration.backfillCanonicalIdentityBatch, { sliceId });
    }
    return { personId };
  },
});

/**
 * MX-02: Links an individual school branch to a multi-branch schoolGroup in schoolGroupBranches.
 * Note: Group linking NEVER creates implicit branch access across member schools.
 */
export const linkSchoolToGroupInternal = internalMutation({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    isHeadquarters: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_group_and_school", (q) =>
        q.eq("groupId", args.groupId).eq("schoolId", args.schoolId)
      )
      .first();

    const now = Date.now();
    if (existing) {
      if (args.isHeadquarters !== undefined && existing.isHeadquarters !== args.isHeadquarters) {
        await ctx.db.patch(existing._id, {
          isHeadquarters: args.isHeadquarters,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("schoolGroupBranches", {
      groupId: args.groupId,
      schoolId: args.schoolId,
      isHeadquarters: args.isHeadquarters ?? false,
      linkedAt: now,
    });
  },
});

/**
 * Internal helper mutation to create or find a schoolGroup.
 */
export const createSchoolGroupInternal = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    proprietorPersonId: v.id("persons"),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("schoolGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("schoolGroups", {
      name: args.name,
      slug: args.slug,
      proprietorPersonId: args.proprietorPersonId,
      status: args.status ?? "active",
      settingsVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal helper mutation to create or find a branchMembership.
 */
export const createBranchMembershipInternal = internalMutation({
  args: {
    personId: v.id("persons"),
    schoolId: v.id("schools"),
    status: v.optional(
      v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))
    ),
    isDefaultBranch: v.optional(v.boolean()),
    legacyUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", args.personId).eq("schoolId", args.schoolId)
      )
      .first();

    const now = Date.now();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("branchMemberships", {
      personId: args.personId,
      schoolId: args.schoolId,
      status: args.status ?? "active",
      isDefaultBranch: args.isDefaultBranch ?? false,
      legacyUserId: args.legacyUserId,
      joinedAt: now,
      updatedAt: now,
    });
  },
});
