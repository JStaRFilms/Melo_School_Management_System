import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { ConvexError } from "convex/values";

export function isCurrentEnrollment(
  student: Pick<Doc<"students">, "isArchived" | "enrollmentStatus">,
): boolean {
  return (
    student.isArchived !== true &&
    (student.enrollmentStatus ?? "active") === "active"
  );
}

export async function initializeSchoolEnrollmentCount(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  currentStudentCount = 0,
): Promise<void> {
  const existing = await ctx.db
    .query("schoolEnrollmentCounts")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      currentStudentCount,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("schoolEnrollmentCounts", {
    schoolId,
    currentStudentCount,
    updatedAt: now,
  });
}

export async function adjustSchoolEnrollmentCount(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  const count = await ctx.db
    .query("schoolEnrollmentCounts")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();

  // Existing schools remain uninitialized until the platform backfill computes
  // an authoritative snapshot. Do not create a misleading partial count.
  if (!count) return;

  const nextCount = count.currentStudentCount + delta;
  if (!Number.isSafeInteger(nextCount) || nextCount < 0) {
    throw new ConvexError("School enrollment count requires recalculation");
  }

  await ctx.db.patch(count._id, {
    currentStudentCount: nextCount,
    updatedAt: Date.now(),
  });
}
