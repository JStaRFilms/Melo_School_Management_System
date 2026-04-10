import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation, query } from "../../_generated/server";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";

function normalizeNotes(value: string | null | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export const listHistoricalTermTotalsForClassTerm = query({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
  },
  returns: v.array(
    v.object({
      _id: v.id("historicalTermTotals"),
      _creationTime: v.number(),
      schoolId: v.id("schools"),
      sessionId: v.id("academicSessions"),
      termId: v.id("academicTerms"),
      classId: v.id("classes"),
      subjectId: v.id("subjects"),
      studentId: v.id("students"),
      total: v.number(),
      source: v.union(
        v.literal("manual_backfill"),
        v.literal("migration_snapshot")
      ),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const [session, term, classDoc] = await Promise.all([
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
      ctx.db.get(args.classId),
    ]);

    if (!session || session.schoolId !== schoolId || session.isArchived) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== schoolId || term.sessionId !== args.sessionId) {
      throw new ConvexError("Term not found");
    }
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }

    const docs = await ctx.db
      .query("historicalTermTotals")
      .withIndex("by_class_session_term", (q) =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId).eq("termId", args.termId)
      )
      .collect();

    return docs
      .filter((doc) => String(doc.schoolId) === String(schoolId))
      .sort((a, b) => {
        if (String(a.subjectId) !== String(b.subjectId)) {
          return String(a.subjectId).localeCompare(String(b.subjectId));
        }
        return String(a.studentId).localeCompare(String(b.studentId));
      });
  },
});

export const saveHistoricalTermTotalsBulk = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    source: v.optional(
      v.union(v.literal("manual_backfill"), v.literal("migration_snapshot"))
    ),
    entries: v.array(
      v.object({
        studentId: v.id("students"),
        subjectId: v.id("subjects"),
        total: v.number(),
        notes: v.optional(v.union(v.string(), v.null())),
      })
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const [session, term, classDoc] = await Promise.all([
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
      ctx.db.get(args.classId),
    ]);

    if (!session || session.schoolId !== schoolId || session.isArchived) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== schoolId || term.sessionId !== args.sessionId) {
      throw new ConvexError("Term not found");
    }
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }

    const subjectIds = Array.from(new Set(args.entries.map((entry) => String(entry.subjectId))));
    const studentIds = Array.from(new Set(args.entries.map((entry) => String(entry.studentId))));

    const [subjects, students] = await Promise.all([
      Promise.all(
        subjectIds.map((subjectId) =>
          ctx.db.get(subjectId as Id<"subjects">)
        )
      ),
      Promise.all(
        studentIds.map((studentId) =>
          ctx.db.get(studentId as Id<"students">)
        )
      ),
    ]);

    for (const subject of subjects) {
      if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
        throw new ConvexError("One of the subjects was not found");
      }
    }

    for (const student of students) {
      if (!student || student.schoolId !== schoolId || student.isArchived) {
        throw new ConvexError("One of the students was not found");
      }
    }

    let created = 0;
    let updated = 0;
    const now = Date.now();
    const source = args.source ?? "manual_backfill";

    for (const entry of args.entries) {
      if (entry.total < 0 || entry.total > 100) {
        throw new ConvexError("Historical totals must be between 0 and 100");
      }

      const existing = await ctx.db
        .query("historicalTermTotals")
        .withIndex("by_lookup", (q) =>
          q
            .eq("schoolId", schoolId)
            .eq("sessionId", args.sessionId)
            .eq("termId", args.termId)
            .eq("classId", args.classId)
            .eq("subjectId", entry.subjectId)
            .eq("studentId", entry.studentId)
        )
        .unique();

      const payload = {
        schoolId,
        sessionId: args.sessionId,
        termId: args.termId,
        classId: args.classId,
        subjectId: entry.subjectId,
        studentId: entry.studentId,
        total: entry.total,
        source,
        ...(normalizeNotes(entry.notes) ? { notes: normalizeNotes(entry.notes) } : {}),
        updatedAt: now,
        updatedBy: userId,
      };

      if (existing) {
        await ctx.db.replace(existing._id, {
          ...payload,
          createdAt: existing.createdAt,
        });
        updated += 1;
      } else {
        await ctx.db.insert("historicalTermTotals", {
          ...payload,
          createdAt: now,
        });
        created += 1;
      }
    }

    return { created, updated };
  },
});
