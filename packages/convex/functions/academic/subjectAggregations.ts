import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import {
  assertAggregationContributionTotals,
  listActiveClassSubjectAggregations,
} from "./subjectAggregationHelpers";

export const getClassSubjectAggregations = query({
  args: {
    classId: v.id("classes"),
  },
  returns: v.array(
    v.object({
      _id: v.id("classSubjectAggregations"),
      classId: v.id("classes"),
      umbrellaSubjectId: v.id("subjects"),
      umbrellaSubjectName: v.string(),
      strategy: v.union(
        v.literal("fixed_contribution"),
        v.literal("raw_combined_normalized")
      ),
      reportDisplayMode: v.union(
        v.literal("umbrella_only"),
        v.literal("umbrella_with_breakdown")
      ),
      components: v.array(
        v.object({
          _id: v.id("classSubjectAggregationComponents"),
          componentSubjectId: v.id("subjects"),
          componentSubjectName: v.string(),
          order: v.number(),
          contributionMax: v.optional(v.number()),
          rawMaxOverride: v.optional(v.number()),
          includeCA: v.boolean(),
          includeExam: v.boolean(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    const aggregations = await listActiveClassSubjectAggregations(ctx, {
      schoolId,
      classId: args.classId,
    });

    return aggregations.map((aggregation) => ({
      _id: aggregation._id,
      classId: aggregation.classId,
      umbrellaSubjectId: aggregation.umbrellaSubjectId,
      umbrellaSubjectName: aggregation.umbrellaSubjectName,
      strategy: aggregation.strategy,
      reportDisplayMode: aggregation.reportDisplayMode,
      components: aggregation.components,
    }));
  },
});

export const saveClassSubjectAggregation = mutation({
  args: {
    aggregationId: v.optional(v.id("classSubjectAggregations")),
    classId: v.id("classes"),
    umbrellaSubjectId: v.id("subjects"),
    strategy: v.union(
      v.literal("fixed_contribution"),
      v.literal("raw_combined_normalized")
    ),
    components: v.array(
      v.object({
        componentSubjectId: v.id("subjects"),
        contributionMax: v.optional(v.number()),
        rawMaxOverride: v.optional(v.number()),
      })
    ),
  },
  returns: v.id("classSubjectAggregations"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    if (args.components.length === 0) {
      throw new ConvexError("Select at least one component subject.");
    }

    const existingOfferings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    const offeredSubjectIds = new Set(
      existingOfferings.map((offering) => String(offering.subjectId))
    );

    if (!offeredSubjectIds.has(String(args.umbrellaSubjectId))) {
      throw new ConvexError(
        "The umbrella subject must already be offered in the selected class."
      );
    }

    const componentIdSet = new Set<string>();
    for (const component of args.components) {
      const componentId = String(component.componentSubjectId);
      if (!offeredSubjectIds.has(componentId)) {
        throw new ConvexError(
          "Every component subject must already be offered in the selected class."
        );
      }
      if (componentId === String(args.umbrellaSubjectId)) {
        throw new ConvexError(
          "The umbrella subject cannot also be one of its own components."
        );
      }
      if (componentIdSet.has(componentId)) {
        throw new ConvexError(
          "The same component subject cannot be added more than once."
        );
      }
      componentIdSet.add(componentId);
    }

    assertAggregationContributionTotals(args.strategy, args.components);

    const activeAggregations = await listActiveClassSubjectAggregations(ctx, {
      schoolId,
      classId: args.classId,
    });
    const currentAggregationId = args.aggregationId
      ? String(args.aggregationId)
      : null;
    const competingAggregations = activeAggregations.filter(
      (aggregation) => String(aggregation._id) !== currentAggregationId
    );

    const competingUmbrellaIds = new Set(
      competingAggregations.map((aggregation) => String(aggregation.umbrellaSubjectId))
    );
    const competingComponentIds = new Set(
      competingAggregations.flatMap((aggregation) =>
        aggregation.components.map((component) => String(component.componentSubjectId))
      )
    );

    if (competingUmbrellaIds.has(String(args.umbrellaSubjectId))) {
      throw new ConvexError(
        "This umbrella subject already has an active aggregation for the class."
      );
    }

    if (competingComponentIds.has(String(args.umbrellaSubjectId))) {
      throw new ConvexError(
        "A subject already used as a component cannot be reused as an umbrella subject in the same class."
      );
    }

    for (const component of args.components) {
      const componentId = String(component.componentSubjectId);
      if (competingUmbrellaIds.has(componentId)) {
        throw new ConvexError(
          "A subject already used as an umbrella subject cannot be reused as a component in the same class."
        );
      }
      if (competingComponentIds.has(componentId)) {
        throw new ConvexError(
          "A component subject can only belong to one active aggregation in the same class."
        );
      }
    }

    const now = Date.now();
    let aggregationId = args.aggregationId;

    if (aggregationId) {
      const currentAggregationId = aggregationId;
      const existing = await ctx.db.get(currentAggregationId);
      if (
        !existing ||
        existing.schoolId !== schoolId ||
        existing.classId !== args.classId
      ) {
        throw new ConvexError("Aggregation not found.");
      }

      await ctx.db.patch(currentAggregationId, {
        umbrellaSubjectId: args.umbrellaSubjectId,
        strategy: args.strategy,
        reportDisplayMode: "umbrella_only",
        isActive: true,
        updatedAt: now,
        updatedBy: userId,
      });

      const previousComponents = await ctx.db
        .query("classSubjectAggregationComponents")
        .withIndex("by_aggregation", (q) =>
          q.eq("aggregationId", currentAggregationId)
        )
        .collect();

      for (const component of previousComponents) {
        await ctx.db.delete(component._id);
      }
    } else {
      aggregationId = await ctx.db.insert("classSubjectAggregations", {
        schoolId,
        classId: args.classId,
        umbrellaSubjectId: args.umbrellaSubjectId,
        strategy: args.strategy,
        reportDisplayMode: "umbrella_only",
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    if (!aggregationId) {
      throw new ConvexError("Aggregation could not be saved.");
    }

    for (const [index, component] of args.components.entries()) {
      await ctx.db.insert("classSubjectAggregationComponents", {
        schoolId,
        aggregationId,
        componentSubjectId: component.componentSubjectId,
        order: index,
        ...(component.contributionMax !== undefined
          ? { contributionMax: component.contributionMax }
          : {}),
        ...(component.rawMaxOverride !== undefined
          ? { rawMaxOverride: component.rawMaxOverride }
          : {}),
        includeCA: true,
        includeExam: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return aggregationId;
  },
});

export const removeClassSubjectAggregation = mutation({
  args: {
    aggregationId: v.id("classSubjectAggregations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const aggregation = await ctx.db.get(args.aggregationId);
    if (!aggregation || aggregation.schoolId !== schoolId) {
      throw new ConvexError("Aggregation not found.");
    }

    const components = await ctx.db
      .query("classSubjectAggregationComponents")
      .withIndex("by_aggregation", (q) => q.eq("aggregationId", args.aggregationId))
      .collect();

    for (const component of components) {
      await ctx.db.delete(component._id);
    }

    await ctx.db.patch(args.aggregationId, {
      isActive: false,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return null;
  },
});
