import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation, query } from "../../_generated/server";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import { buildStudentReportCard } from "./reportCards";

const cumulativeTermKeyValidator = v.union(
  v.literal("first"),
  v.literal("second"),
  v.literal("current")
);

type CumulativeTermKey = "first" | "second" | "current";

function normalizeReason(value: string) {
  const reason = value.trim();
  if (!reason) {
    throw new ConvexError("Enter a reason for this manual adjustment");
  }
  if (reason.length > 500) {
    throw new ConvexError("Adjustment reasons cannot exceed 500 characters");
  }
  return reason;
}

function normalizeIncludedTerms(values: CumulativeTermKey[]) {
  const order: CumulativeTermKey[] = ["first", "second", "current"];
  const selected = new Set(values);
  return order.filter((key) => selected.has(key));
}

async function assertAdjustmentContext(
  ctx: QueryCtx | MutationCtx,
  args: {
    schoolId: Id<"schools">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
    classId: Id<"classes">;
    studentId: Id<"students">;
  }
) {
  const [session, term, classDoc, student] = await Promise.all([
    ctx.db.get(args.sessionId),
    ctx.db.get(args.termId),
    ctx.db.get(args.classId),
    ctx.db.get(args.studentId),
  ]);

  if (!session || session.schoolId !== args.schoolId || session.isArchived) {
    throw new ConvexError("Session not found");
  }
  if (
    !term ||
    term.schoolId !== args.schoolId ||
    term.sessionId !== args.sessionId ||
    term.reportCardCalculationMode !== "cumulative_annual"
  ) {
    throw new ConvexError("Manual annual adjustments require a cumulative annual term");
  }
  if (!classDoc || classDoc.schoolId !== args.schoolId || classDoc.isArchived) {
    throw new ConvexError("Class not found");
  }
  if (!student || student.schoolId !== args.schoolId || student.isArchived) {
    throw new ConvexError("Student not found");
  }

  const terms = await ctx.db
    .query("academicTerms")
    .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
    .collect();
  const orderedTerms = terms
    .filter((candidate: any) => candidate.schoolId === args.schoolId)
    .sort((a: any, b: any) => a.startDate - b.startDate);

  if (String(orderedTerms[2]?._id) !== String(args.termId)) {
    throw new ConvexError("Manual annual adjustments can only be saved for the third term");
  }
}

export const listManualAdjustmentsForStudent = query({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    studentId: v.id("students"),
  },
  returns: v.array(
    v.object({
      _id: v.id("reportCardManualAdjustments"),
      subjectId: v.id("subjects"),
      includedTerms: v.array(cumulativeTermKeyValidator),
      finalTotalOverride: v.union(v.number(), v.null()),
      reason: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.id("users"),
      updatedBy: v.id("users"),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.assessments.adjust" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    await assertAdjustmentContext(ctx, { ...args, schoolId });

    const rows = await ctx.db
      .query("reportCardManualAdjustments")
      .withIndex("by_student_and_report_term", (q) =>
        q
          .eq("schoolId", schoolId)
          .eq("studentId", args.studentId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
      )
      .take(500);

    return rows
      .filter((row) => String(row.classId) === String(args.classId))
      .map((row) => ({
        _id: row._id,
        subjectId: row.subjectId,
        includedTerms: row.includedTerms,
        finalTotalOverride: row.finalTotalOverride ?? null,
        reason: row.reason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
      }));
  },
});

export const saveManualAdjustmentsBulk = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    studentId: v.id("students"),
    entries: v.array(
      v.object({
        subjectId: v.id("subjects"),
        reset: v.boolean(),
        includedTerms: v.array(cumulativeTermKeyValidator),
        finalTotalOverride: v.optional(v.union(v.number(), v.null())),
        reason: v.string(),
      })
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    reset: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.assessments.adjust" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    await assertAdjustmentContext(ctx, { ...args, schoolId });

    if (args.entries.length === 0) {
      throw new ConvexError("Select at least one subject adjustment to save");
    }
    if (args.entries.length > 200) {
      throw new ConvexError("Save at most 200 subject adjustments at a time");
    }

    const reportCard = await buildStudentReportCard(ctx, {
      userId,
      schoolId,
      role,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
      preferredClassId: args.classId,
      skipRoleCheck: true,
    });
    const reportRowBySubjectId = new Map(
      reportCard.results.map((row) => [String(row.subjectId), row] as const)
    );

    const seenSubjectIds = new Set<string>();
    let created = 0;
    let updated = 0;
    let reset = 0;
    const now = Date.now();

    for (const entry of args.entries) {
      const subjectKey = String(entry.subjectId);
      if (seenSubjectIds.has(subjectKey)) {
        throw new ConvexError("Each subject can only appear once in an adjustment save");
      }
      seenSubjectIds.add(subjectKey);

      const subject = await ctx.db.get(entry.subjectId);
      if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
        throw new ConvexError("One of the subjects was not found");
      }

      const existing = await ctx.db
        .query("reportCardManualAdjustments")
        .withIndex("by_lookup", (q) =>
          q
            .eq("schoolId", schoolId)
            .eq("studentId", args.studentId)
            .eq("sessionId", args.sessionId)
            .eq("termId", args.termId)
            .eq("classId", args.classId)
            .eq("subjectId", entry.subjectId)
        )
        .unique();

      if (entry.reset) {
        const reason = normalizeReason(entry.reason);
        if (!existing) {
          continue;
        }

        await ctx.db.delete(existing._id);
        await ctx.db.insert("reportCardManualAdjustmentEvents", {
          schoolId,
          sessionId: args.sessionId,
          termId: args.termId,
          classId: args.classId,
          studentId: args.studentId,
          subjectId: entry.subjectId,
          action: "reset",
          includedTerms: existing.includedTerms,
          ...(existing.finalTotalOverride !== undefined
            ? { finalTotalOverride: existing.finalTotalOverride }
            : {}),
          reason,
          createdAt: now,
          actorId: userId,
        });
        reset += 1;
        continue;
      }

      const includedTerms = normalizeIncludedTerms(entry.includedTerms);
      if (includedTerms.length === 0) {
        throw new ConvexError("Choose at least one included term for every adjusted subject");
      }
      const finalTotalOverride = entry.finalTotalOverride ?? undefined;
      if (
        finalTotalOverride !== undefined &&
        (!Number.isFinite(finalTotalOverride) ||
          finalTotalOverride < 0 ||
          finalTotalOverride > 100)
      ) {
        throw new ConvexError("Final score overrides must be finite and between 0 and 100");
      }

      const reportRow = reportRowBySubjectId.get(subjectKey);
      if (!reportRow || reportRow.calculationMode !== "cumulative_annual") {
        throw new ConvexError("One of the subjects is not available on this report card");
      }
      const missingSelectedTerm = includedTerms.some((termKey) => {
        if (termKey === "first") return reportRow.firstTermTotal === null;
        if (termKey === "second") return reportRow.secondTermTotal === null;
        return reportRow.currentTermTotal === null;
      });
      if (missingSelectedTerm && finalTotalOverride === undefined) {
        throw new ConvexError(
          "Selected terms must have recorded scores unless a final override is provided"
        );
      }

      const reason = normalizeReason(entry.reason);
      const payload = {
        schoolId,
        sessionId: args.sessionId,
        termId: args.termId,
        classId: args.classId,
        studentId: args.studentId,
        subjectId: entry.subjectId,
        includedTerms,
        ...(finalTotalOverride !== undefined ? { finalTotalOverride } : {}),
        reason,
        updatedAt: now,
        updatedBy: userId,
      };

      if (existing) {
        await ctx.db.replace(existing._id, {
          ...payload,
          createdAt: existing.createdAt,
          createdBy: existing.createdBy,
        });
        updated += 1;
      } else {
        await ctx.db.insert("reportCardManualAdjustments", {
          ...payload,
          createdAt: now,
          createdBy: userId,
        });
        created += 1;
      }

      await ctx.db.insert("reportCardManualAdjustmentEvents", {
        schoolId,
        sessionId: args.sessionId,
        termId: args.termId,
        classId: args.classId,
        studentId: args.studentId,
        subjectId: entry.subjectId,
        action: "apply",
        includedTerms,
        ...(finalTotalOverride !== undefined ? { finalTotalOverride } : {}),
        reason,
        createdAt: now,
        actorId: userId,
      });
    }

    return { created, updated, reset };
  },
});
