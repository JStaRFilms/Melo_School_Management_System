import type { Id } from "../../_generated/dataModel";
import type { LoadedClassSubjectAggregation } from "./subjectAggregationHelpers";

export function deriveEffectiveSubjectSelectionIds(args: {
  explicitSubjectIds: Iterable<string>;
  aggregations: LoadedClassSubjectAggregation[];
  optOutAggregationIds?: Iterable<string>;
}): Set<string> {
  const explicitSubjectIds = new Set(Array.from(args.explicitSubjectIds));
  const optOutAggregationIds = new Set(Array.from(args.optOutAggregationIds ?? []));
  const effectiveSubjectIds = new Set(explicitSubjectIds);

  for (const aggregation of args.aggregations) {
    const aggregationId = String(aggregation._id);
    const umbrellaSubjectId = String(aggregation.umbrellaSubjectId);
    const allComponentsSelected = aggregation.components.every((component) =>
      explicitSubjectIds.has(String(component.componentSubjectId))
    );

    if (effectiveSubjectIds.has(umbrellaSubjectId) && allComponentsSelected) {
      continue;
    }

    effectiveSubjectIds.delete(umbrellaSubjectId);

    if (!allComponentsSelected) {
      continue;
    }

    if (optOutAggregationIds.has(aggregationId)) {
      continue;
    }

    effectiveSubjectIds.add(umbrellaSubjectId);
  }

  return effectiveSubjectIds;
}

export async function listStudentAggregationOptOuts(
  ctx: any,
  args: {
    studentId: Id<"students">;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
  }
) {
  return await ctx.db
    .query("studentSubjectAggregationOptOuts")
    .withIndex("by_student_class_session", (q: any) =>
      q
        .eq("studentId", args.studentId)
        .eq("classId", args.classId)
        .eq("sessionId", args.sessionId)
    )
    .collect();
}

export async function listClassAggregationOptOuts(
  ctx: any,
  args: {
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
  }
) {
  return await ctx.db
    .query("studentSubjectAggregationOptOuts")
    .withIndex("by_class_and_session", (q: any) =>
      q.eq("classId", args.classId).eq("sessionId", args.sessionId)
    )
    .collect();
}
