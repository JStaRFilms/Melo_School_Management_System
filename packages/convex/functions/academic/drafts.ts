import { mutation, query } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthenticatedSchoolMembership } from "./auth";

/**
 * Status of a draft form
 */
export const formDraftStatusValidator = v.union(
  v.literal("active"),
  v.literal("committed"),
  v.literal("discarded")
);

/**
 * Save or update an active form draft for the authenticated user.
 * Performs an upsert: if an active draft already exists for the given (user, formKey, entityId),
 * it updates the payload, increments revision, and refreshes timestamps.
 */
export const saveFormDraft = mutation({
  args: {
    formKey: v.string(),
    entityId: v.optional(v.string()),
    payload: v.any(),
    expectedRevision: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedSchoolMembership(ctx);
    const now = Date.now();

    // Query drafts for this user and formKey
    const existingDrafts = await ctx.db
      .query("formDrafts")
      .withIndex("by_user_and_form", (q) =>
        q.eq("userId", auth.userId).eq("formKey", args.formKey)
      )
      .collect();

    // Filter to find matching active draft
    const activeDraft = existingDrafts.find((doc) => {
      if (doc.status !== "active") return false;
      if (args.entityId !== undefined) {
        return doc.entityId === args.entityId;
      }
      return !doc.entityId;
    });

    if (activeDraft) {
      if (
        args.expectedRevision !== undefined &&
        activeDraft.revision !== undefined &&
        activeDraft.revision !== args.expectedRevision
      ) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Conflict detected: Draft revision mismatch on server",
          serverRevision: activeDraft.revision,
          clientRevision: args.expectedRevision,
        });
      }

      const nextRevision = (activeDraft.revision ?? 1) + 1;
      await ctx.db.patch(activeDraft._id, {
        payload: args.payload,
        entityId: args.entityId,
        revision: nextRevision,
        lastSavedAt: now,
        updatedAt: now,
      });

      return {
        draftId: activeDraft._id,
        revision: nextRevision,
        lastSavedAt: now,
        isNew: false,
      };
    }

    // Insert brand new active draft
    const draftId = await ctx.db.insert("formDrafts", {
      schoolId: auth.schoolId,
      userId: auth.userId,
      formKey: args.formKey,
      entityId: args.entityId,
      payload: args.payload,
      status: "active",
      revision: 1,
      lastSavedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      draftId,
      revision: 1,
      lastSavedAt: now,
      isNew: true,
    };
  },
});

/**
 * Retrieve the active form draft for the authenticated user and formKey.
 * Returns null if no active draft exists.
 */
export const getFormDraft = query({
  args: {
    formKey: v.string(),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let auth;
    try {
      auth = await getAuthenticatedSchoolMembership(ctx, {
        allowSuspended: true,
      });
    } catch {
      return null;
    }

    const drafts = await ctx.db
      .query("formDrafts")
      .withIndex("by_user_and_form", (q) =>
        q.eq("userId", auth.userId).eq("formKey", args.formKey)
      )
      .collect();

    // Find active draft matching entityId criteria
    const activeDrafts = drafts
      .filter((doc) => {
        if (doc.status !== "active") return false;
        if (args.entityId !== undefined) {
          return doc.entityId === args.entityId;
        }
        return !doc.entityId;
      })
      .sort((a, b) => b.lastSavedAt - a.lastSavedAt);

    if (activeDrafts.length === 0) {
      return null;
    }

    const draft = activeDrafts[0];
    return {
      _id: draft._id,
      schoolId: draft.schoolId,
      userId: draft.userId,
      formKey: draft.formKey,
      entityId: draft.entityId,
      payload: draft.payload,
      status: draft.status,
      revision: draft.revision ?? 1,
      lastSavedAt: draft.lastSavedAt,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  },
});

/**
 * Discard an active draft.
 * Accepts either a specific draftId or (formKey, entityId).
 */
export const discardFormDraft = mutation({
  args: {
    formKey: v.optional(v.string()),
    draftId: v.optional(v.id("formDrafts")),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedSchoolMembership(ctx);
    const now = Date.now();

    if (args.draftId) {
      const draft = await ctx.db.get(args.draftId);
      if (!draft || draft.userId !== auth.userId) {
        return { success: false, discardedCount: 0 };
      }
      await ctx.db.patch(draft._id, {
        status: "discarded",
        updatedAt: now,
      });
      return { success: true, discardedCount: 1 };
    }

    if (args.formKey) {
      const drafts = await ctx.db
        .query("formDrafts")
        .withIndex("by_user_and_form", (q) =>
          q.eq("userId", auth.userId).eq("formKey", args.formKey!)
        )
        .collect();

      const toDiscard = drafts.filter((doc) => {
        if (doc.status !== "active") return false;
        if (args.entityId !== undefined) {
          return doc.entityId === args.entityId;
        }
        return !doc.entityId;
      });

      for (const draft of toDiscard) {
        await ctx.db.patch(draft._id, {
          status: "discarded",
          updatedAt: now,
        });
      }

      return { success: true, discardedCount: toDiscard.length };
    }

    return { success: false, discardedCount: 0 };
  },
});

/**
 * Mark a form draft as committed (e.g. upon successful final submission).
 */
export const commitFormDraft = mutation({
  args: {
    formKey: v.optional(v.string()),
    draftId: v.optional(v.id("formDrafts")),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedSchoolMembership(ctx);
    const now = Date.now();

    if (args.draftId) {
      const draft = await ctx.db.get(args.draftId);
      if (!draft || draft.userId !== auth.userId) {
        return { success: false, committedCount: 0 };
      }
      await ctx.db.patch(draft._id, {
        status: "committed",
        updatedAt: now,
      });
      return { success: true, committedCount: 1 };
    }

    if (args.formKey) {
      const drafts = await ctx.db
        .query("formDrafts")
        .withIndex("by_user_and_form", (q) =>
          q.eq("userId", auth.userId).eq("formKey", args.formKey!)
        )
        .collect();

      const toCommit = drafts.filter((doc) => {
        if (doc.status !== "active") return false;
        if (args.entityId !== undefined) {
          return doc.entityId === args.entityId;
        }
        return !doc.entityId;
      });

      for (const draft of toCommit) {
        await ctx.db.patch(draft._id, {
          status: "committed",
          updatedAt: now,
        });
      }

      return { success: true, committedCount: toCommit.length };
    }

    return { success: false, committedCount: 0 };
  },
});

// Backward-compatible aliases as referenced in task specifications
export const saveDraft = saveFormDraft;
export const getDraft = getFormDraft;
export const discardDraft = discardFormDraft;
export const commitDraft = commitFormDraft;
