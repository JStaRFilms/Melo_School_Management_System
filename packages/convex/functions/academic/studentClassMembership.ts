import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export async function isStudentEnrolledInClassForSession(
  ctx: QueryCtx | MutationCtx,
  args: {
    student: Doc<"students">;
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
  },
) {
  if (args.student.schoolId !== args.schoolId || args.student.isArchived) {
    return false;
  }

  const promotions = await ctx.db
    .query("studentPromotions")
    .withIndex("by_student_and_to_session", (q) =>
      q.eq("studentId", args.student._id).eq("toSessionId", args.sessionId),
    )
    .collect();
  const promotion = promotions
    .filter((entry) => entry.schoolId === args.schoolId)
    .sort(
      (left, right) =>
        right.createdAt - left.createdAt ||
        right._creationTime - left._creationTime,
    )[0];

  if (promotion) {
    return promotion.toClassId === args.classId;
  }

  return args.student.classId === args.classId;
}
