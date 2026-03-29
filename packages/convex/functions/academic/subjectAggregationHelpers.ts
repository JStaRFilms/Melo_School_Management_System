import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { SubjectAggregationStrategy } from "@school/shared/subject-aggregation";
import { normalizeHumanName } from "@school/shared/name-format";

export type LoadedClassSubjectAggregation = {
  _id: Id<"classSubjectAggregations">;
  schoolId: Id<"schools">;
  classId: Id<"classes">;
  umbrellaSubjectId: Id<"subjects">;
  umbrellaSubjectName: string;
  strategy: SubjectAggregationStrategy;
  reportDisplayMode: "umbrella_only" | "umbrella_with_breakdown";
  components: Array<{
    _id: Id<"classSubjectAggregationComponents">;
    componentSubjectId: Id<"subjects">;
    componentSubjectName: string;
    order: number;
    contributionMax?: number;
    rawMaxOverride?: number;
    includeCA: boolean;
    includeExam: boolean;
  }>;
};

export async function listActiveClassSubjectAggregations(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
  }
): Promise<LoadedClassSubjectAggregation[]> {
  const aggregationDocs = await ctx.db
    .query("classSubjectAggregations")
    .withIndex("by_class", (q: any) => q.eq("classId", args.classId))
    .collect();

  const activeAggregations = aggregationDocs.filter(
    (aggregation: any) =>
      aggregation.schoolId === args.schoolId && aggregation.isActive
  );

  const loaded = await Promise.all(
    activeAggregations.map(async (aggregation: any) => {
      const [umbrellaSubject, componentDocs] = await Promise.all([
        ctx.db.get(aggregation.umbrellaSubjectId),
        ctx.db
          .query("classSubjectAggregationComponents")
          .withIndex("by_aggregation", (q: any) =>
            q.eq("aggregationId", aggregation._id)
          )
          .collect(),
      ]);

      if (
        !umbrellaSubject ||
        umbrellaSubject.schoolId !== args.schoolId ||
        umbrellaSubject.isArchived
      ) {
        return null;
      }

      const components = (
        await Promise.all(
          componentDocs.map(async (component: any) => {
            const subject = await ctx.db.get(component.componentSubjectId);
            if (
              !subject ||
              subject.schoolId !== args.schoolId ||
              subject.isArchived
            ) {
              return null;
            }

            return {
              _id: component._id,
              componentSubjectId: component.componentSubjectId,
              componentSubjectName: normalizeHumanName(subject.name),
              order: component.order,
              contributionMax: component.contributionMax,
              rawMaxOverride: component.rawMaxOverride,
              includeCA: component.includeCA,
              includeExam: component.includeExam,
            };
          })
        )
      )
        .filter(
          (
            component
          ): component is NonNullable<typeof component> => component !== null
        )
        .sort((a, b) => a.order - b.order);

      return {
        _id: aggregation._id,
        schoolId: aggregation.schoolId,
        classId: aggregation.classId,
        umbrellaSubjectId: aggregation.umbrellaSubjectId,
        umbrellaSubjectName: normalizeHumanName(umbrellaSubject.name),
        strategy: aggregation.strategy,
        reportDisplayMode: aggregation.reportDisplayMode,
        components,
      } satisfies LoadedClassSubjectAggregation;
    })
  );

  return loaded
    .filter(
      (
        aggregation
      ): aggregation is NonNullable<typeof aggregation> => aggregation !== null
    )
    .sort((a, b) => a.umbrellaSubjectName.localeCompare(b.umbrellaSubjectName));
}

export async function getActiveAggregationByUmbrellaSubject(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    umbrellaSubjectId: Id<"subjects">;
  }
): Promise<LoadedClassSubjectAggregation | null> {
  const aggregations = await listActiveClassSubjectAggregations(ctx, {
    schoolId: args.schoolId,
    classId: args.classId,
  });

  return (
    aggregations.find(
      (aggregation) =>
        String(aggregation.umbrellaSubjectId) === String(args.umbrellaSubjectId)
    ) ?? null
  );
}

export async function getDerivedUmbrellaSubjectIdsForClass(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
  }
): Promise<Set<string>> {
  const aggregations = await listActiveClassSubjectAggregations(ctx, args);
  return new Set(
    aggregations.map((aggregation) => String(aggregation.umbrellaSubjectId))
  );
}

export function assertAggregationContributionTotals(
  strategy: SubjectAggregationStrategy,
  components: Array<{ contributionMax?: number }>
) {
  if (strategy !== "fixed_contribution") {
    return;
  }

  const contributionTotal = components.reduce(
    (sum, component) => sum + (component.contributionMax ?? 0),
    0
  );

  if (contributionTotal !== 100) {
    throw new ConvexError(
      "Fixed contribution aggregations must add up to 100."
    );
  }
}
