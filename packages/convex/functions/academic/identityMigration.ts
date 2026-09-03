import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

/**
 * MX-01 & MX-02: Durable cursor-based batch mutation for backfilling canonical persons
 * and explicit branch memberships from existing users table without altering operational schoolIds.
 */
export const backfillCanonicalIdentityBatch = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
    sliceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sliceId = args.sliceId ?? "MX-01";
    const batchSize = args.batchSize ?? 150;
    const now = Date.now();

    // 1. Query a bounded, ordered batch of users using cursor pagination
    const result = await ctx.db
      .query("users")
      .order("asc")
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    let processedCount = 0;
    let failedCount = 0;

    for (const user of result.page) {
      try {
        // Deduplicate person by:
        // a) existing user.personId link
        // b) authTokenIdentifier
        // c) normalized email
        let person = user.personId ? await ctx.db.get(user.personId) : null;

        const tokenIdentifier = user.authTokenIdentifier ?? user.authId;

        if (!person && tokenIdentifier) {
          person = await ctx.db
            .query("persons")
            .withIndex("by_token_identifier", (q) =>
              q.eq("authTokenIdentifier", tokenIdentifier)
            )
            .first();
        }

        if (!person && user.email) {
          person = await ctx.db
            .query("persons")
            .withIndex("by_email", (q) => q.eq("email", user.email))
            .first();
        }

        let personId: Id<"persons">;
        if (person) {
          personId = person._id;
          // Synchronize tokenIdentifier onto person if it was missing
          if (!person.authTokenIdentifier && tokenIdentifier) {
            await ctx.db.patch(personId, {
              authTokenIdentifier: tokenIdentifier,
              updatedAt: now,
            });
          }
        } else {
          personId = await ctx.db.insert("persons", {
            authTokenIdentifier: tokenIdentifier,
            email: user.email,
            name: user.name,
            status: user.isArchived ? "archived" : "active",
            primarySchoolId: user.schoolId,
            createdAt: user.createdAt ?? now,
            updatedAt: now,
          });
        }

        // Link legacy user to person record if not already linked
        if (user.personId !== personId) {
          await ctx.db.patch(user._id, {
            personId,
            updatedAt: now,
          });
        }

        // 2. Ensure explicit branchMemberships record exists for (personId, user.schoolId)
        const existingMembership = await ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_school", (q) =>
            q.eq("personId", personId).eq("schoolId", user.schoolId)
          )
          .first();

        if (!existingMembership) {
          await ctx.db.insert("branchMemberships", {
            personId,
            schoolId: user.schoolId,
            status: user.isArchived ? "archived" : "active",
            isDefaultBranch: true,
            legacyUserId: user._id,
            joinedAt: user.createdAt ?? now,
            updatedAt: now,
          });
        } else if (!existingMembership.legacyUserId) {
          await ctx.db.patch(existingMembership._id, {
            legacyUserId: user._id,
            updatedAt: now,
          });
        }

        processedCount++;
      } catch (err) {
        failedCount++;
        console.error(`[MX-01] Error migrating user ${user._id}:`, err);
      }
    }

    const nextCursor = result.isDone ? null : result.continueCursor;

    // 3. Durable telemetry record in migrationRuns
    const previousRuns = await ctx.db
      .query("migrationRuns")
      .withIndex("by_slice_and_status", (q) => q.eq("sliceId", sliceId))
      .collect();
    const batchNumber = previousRuns.length + 1;

    await ctx.db.insert("migrationRuns", {
      sliceId,
      batchNumber,
      cursor: nextCursor,
      processedCount,
      failedCount,
      status: failedCount > 0 && processedCount === 0 ? "failed" : result.isDone ? "completed" : "in_progress",
      startedAt: now,
      updatedAt: now,
      completedAt: result.isDone ? now : undefined,
    });

    return {
      cursor: nextCursor,
      isDone: result.isDone,
      processedCount,
    };
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
