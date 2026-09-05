import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { FACTORY_ROLE_DEFINITIONS, isMembershipProprietor } from "./rbac";

/**
 * Seeds or updates the canonical factory role templates (D-02 §3.2 / MX-03).
 * Idempotent: Can be run multiple times safely.
 */
export const seedFactoryRoleTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const templateIds: Record<string, Id<"roleTemplates">> = {};
    let seededCount = 0;

    for (const [code, def] of Object.entries(FACTORY_ROLE_DEFINITIONS)) {
      const existing = await ctx.db
        .query("roleTemplates")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: def.name,
          description: def.description,
          capabilities: def.capabilities,
          updatedAt: now,
        });
        templateIds[code] = existing._id;
      } else {
        const id = await ctx.db.insert("roleTemplates", {
          code,
          name: def.name,
          description: def.description,
          scope: "global",
          capabilities: def.capabilities,
          isSystem: true,
          createdAt: now,
          updatedAt: now,
        });
        templateIds[code] = id;
        seededCount++;
      }
    }

    return { seededCount, templateIds };
  },
});

/**
 * MX-03: Backfills existing school administrators with baseline role templates (principal or proprietor)
 * to ensure zero lockout during migration to capability-based RBAC.
 */
export const backfillExistingAdminCapabilities = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const now = Date.now();

    // Ensure factory templates exist
    const principalTemplate = await ctx.db
      .query("roleTemplates")
      .withIndex("by_code", (q) => q.eq("code", "principal"))
      .first();

    const proprietorTemplate = await ctx.db
      .query("roleTemplates")
      .withIndex("by_code", (q) => q.eq("code", "proprietor"))
      .first();

    if (!principalTemplate || !proprietorTemplate) {
      throw new Error("Factory role templates must be seeded before running admin capability backfill");
    }

    // Query bounded batch of memberships
    const result = await ctx.db
      .query("branchMemberships")
      .order("asc")
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    let processedCount = 0;
    let backfilledCount = 0;

    for (const membership of result.page) {
      processedCount++;

      // Check if membership already has role assignments
      const existingAssignment = await ctx.db
        .query("membershipRoleAssignments")
        .withIndex("by_membership", (q) => q.eq("membershipId", membership._id))
        .first();

      if (existingAssignment) {
        continue;
      }

      // Check if user is an admin
      let isAdmin = false;
      if (membership.legacyUserId) {
        const user = await ctx.db.get(membership.legacyUserId);
        if (user && (user.role === "admin" || user.isSchoolAdmin === true)) {
          isAdmin = true;
        }
      } else {
        const users = await ctx.db
          .query("users")
          .withIndex("by_school", (q) => q.eq("schoolId", membership.schoolId))
          .collect();

        const match = users.find(
          (u) => u.personId === membership.personId && (u.role === "admin" || u.isSchoolAdmin === true)
        );
        if (match) {
          isAdmin = true;
        }
      }

      if (isAdmin) {
        const isProprietor = await isMembershipProprietor(ctx, membership);
        const roleTemplateId = isProprietor ? proprietorTemplate._id : principalTemplate._id;
        const roleTemplateKey = isProprietor ? "proprietor" : "principal";

        await ctx.db.insert("membershipRoleAssignments", {
          membershipId: membership._id,
          roleTemplateId,
          roleTemplateKey,
          assignedAt: now,
        });

        backfilledCount++;
      }
    }

    return {
      processedCount,
      backfilledCount,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
