import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation, query } from "../../_generated/server";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";

type TermSettingGroupDoc = {
  _id: Id<"reportCardTermSettingGroups">;
  schoolId: Id<"schools">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  name: string;
  classIds: Id<"classes">[];
  nextTermBegins?: number;
  timesSchoolOpened?: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: Id<"users">;
};

const termSettingGroupValidator = v.object({
  _id: v.id("reportCardTermSettingGroups"),
  name: v.string(),
  classIds: v.array(v.id("classes")),
  nextTermBegins: v.union(v.number(), v.null()),
  timesSchoolOpened: v.union(v.number(), v.null()),
});

export async function resolveEffectiveReportCardTermSettings(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    termId: Id<"academicTerms">;
  }
) {
  const term = await ctx.db.get(args.termId);

  if (!term || term.schoolId !== args.schoolId) {
    throw new ConvexError("Term not found");
  }

  const [groupDocs, legacyClassAttendanceDocs] = await Promise.all([
    ctx.db
      .query("reportCardTermSettingGroups")
      .withIndex("by_term", (q: any) => q.eq("termId", args.termId))
      .collect(),
    ctx.db
      .query("reportCardAttendanceClassValues")
      .withIndex("by_class_session_term", (q: any) =>
        q
          .eq("classId", args.classId)
          .eq("sessionId", term.sessionId)
          .eq("termId", args.termId)
      )
      .collect(),
  ]);

  const scopedGroups = groupDocs.filter(
    (group: any) => group.schoolId === args.schoolId
  ) as TermSettingGroupDoc[];
  const matchingGroups = scopedGroups.filter((group) =>
    group.classIds.some((classId) => String(classId) === String(args.classId))
  );

  if (matchingGroups.length > 1) {
    throw new ConvexError(
      "This class belongs to more than one report-card settings group for the same term"
    );
  }

  const matchingGroup = matchingGroups[0] ?? null;
  const legacyClassAttendance = legacyClassAttendanceDocs.find(
    (doc: any) =>
      String(doc.schoolId) === String(args.schoolId) &&
      String(doc.classId) === String(args.classId)
  ) ?? null;

  return {
    nextTermBegins:
      matchingGroup?.nextTermBegins ?? term.nextTermBegins ?? null,
    timesSchoolOpened:
      matchingGroup?.timesSchoolOpened ??
      legacyClassAttendance?.timesSchoolOpened ??
      term.defaultTimesSchoolOpened ??
      null,
    matchedGroup:
      matchingGroup
        ? {
            _id: matchingGroup._id,
            name: matchingGroup.name,
          }
        : null,
  };
}

export const getTermReportCardSettings = query({
  args: {
    termId: v.id("academicTerms"),
  },
  returns: v.object({
    termId: v.id("academicTerms"),
    nextTermBegins: v.union(v.number(), v.null()),
    defaultTimesSchoolOpened: v.union(v.number(), v.null()),
    groups: v.array(termSettingGroupValidator),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const [term, groups] = await Promise.all([
      ctx.db.get(args.termId),
      ctx.db
        .query("reportCardTermSettingGroups")
        .withIndex("by_term", (q) => q.eq("termId", args.termId))
        .collect(),
    ]);

    if (!term || term.schoolId !== schoolId) {
      throw new ConvexError("Term not found");
    }

    return {
      termId: args.termId,
      nextTermBegins: term.nextTermBegins ?? null,
      defaultTimesSchoolOpened: term.defaultTimesSchoolOpened ?? null,
      groups: groups
        .filter((group) => group.schoolId === schoolId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((group) => ({
          _id: group._id,
          name: normalizeHumanName(group.name),
          classIds: group.classIds,
          nextTermBegins: group.nextTermBegins ?? null,
          timesSchoolOpened: group.timesSchoolOpened ?? null,
        })),
    };
  },
});

export const saveTermReportCardDefaults = mutation({
  args: {
    termId: v.id("academicTerms"),
    nextTermBegins: v.union(v.number(), v.null()),
    defaultTimesSchoolOpened: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const term = await ctx.db.get(args.termId);
    if (!term || term.schoolId !== schoolId) {
      throw new ConvexError("Term not found");
    }

    if (args.nextTermBegins !== null && args.nextTermBegins <= term.endDate) {
      throw new ConvexError("Next term start date must be after this term ends");
    }
    if (
      args.defaultTimesSchoolOpened !== null &&
      (!Number.isInteger(args.defaultTimesSchoolOpened) ||
        args.defaultTimesSchoolOpened < 0)
    ) {
      throw new ConvexError(
        "Default number of times opened must be a whole number zero or higher"
      );
    }

    const replacement: Record<string, unknown> = {
      schoolId: term.schoolId,
      sessionId: term.sessionId,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      isActive: term.isActive,
      createdAt: term.createdAt,
      updatedAt: Date.now(),
    };

    if (args.nextTermBegins !== null) {
      replacement.nextTermBegins = args.nextTermBegins;
    }
    if (args.defaultTimesSchoolOpened !== null) {
      replacement.defaultTimesSchoolOpened = args.defaultTimesSchoolOpened;
    }

    await ctx.db.replace(args.termId, replacement as any);
    return null;
  },
});

export const saveTermReportCardSettingGroup = mutation({
  args: {
    groupId: v.optional(v.union(v.id("reportCardTermSettingGroups"), v.null())),
    termId: v.id("academicTerms"),
    name: v.string(),
    classIds: v.array(v.id("classes")),
    nextTermBegins: v.union(v.number(), v.null()),
    timesSchoolOpened: v.union(v.number(), v.null()),
  },
  returns: v.id("reportCardTermSettingGroups"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const term = await ctx.db.get(args.termId);
    if (!term || term.schoolId !== schoolId) {
      throw new ConvexError("Term not found");
    }

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("Group name is required");
    }

    const uniqueClassIds = args.classIds.filter((classId, index, all) =>
      all.findIndex((candidate) => String(candidate) === String(classId)) === index
    );
    if (uniqueClassIds.length === 0) {
      throw new ConvexError("Choose at least one class for this group");
    }

    if (args.nextTermBegins === null && args.timesSchoolOpened === null) {
      throw new ConvexError(
        "Set at least one shared value for this report-card group"
      );
    }
    if (args.nextTermBegins !== null && args.nextTermBegins <= term.endDate) {
      throw new ConvexError("Next term start date must be after this term ends");
    }
    if (
      args.timesSchoolOpened !== null &&
      (!Number.isInteger(args.timesSchoolOpened) || args.timesSchoolOpened < 0)
    ) {
      throw new ConvexError(
        "Number of times opened must be a whole number zero or higher"
      );
    }

    const classes = await Promise.all(uniqueClassIds.map((classId) => ctx.db.get(classId)));
    for (const classDoc of classes) {
      if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
        throw new ConvexError("One of the selected classes was not found");
      }
    }

    const existingGroups = (await ctx.db
      .query("reportCardTermSettingGroups")
      .withIndex("by_term", (q) => q.eq("termId", args.termId))
      .collect())
      .filter((group) => group.schoolId === schoolId);

    for (const group of existingGroups) {
      if (args.groupId && String(group._id) === String(args.groupId)) {
        continue;
      }
      const overlap = group.classIds.some((classId) =>
        uniqueClassIds.some(
          (selectedClassId) => String(selectedClassId) === String(classId)
        )
      );
      if (overlap) {
        throw new ConvexError(
          `A selected class already belongs to the shared group "${group.name}"`
        );
      }
    }

    const now = Date.now();
    if (args.groupId) {
      const existing = await ctx.db.get(args.groupId);
      if (!existing || existing.schoolId !== schoolId || existing.termId !== args.termId) {
        throw new ConvexError("Shared group not found");
      }

      await ctx.db.replace(args.groupId, {
        schoolId,
        sessionId: term.sessionId,
        termId: args.termId,
        name,
        classIds: uniqueClassIds,
        ...(args.nextTermBegins !== null ? { nextTermBegins: args.nextTermBegins } : {}),
        ...(args.timesSchoolOpened !== null ? { timesSchoolOpened: args.timesSchoolOpened } : {}),
        createdAt: existing.createdAt,
        updatedAt: now,
        updatedBy: userId,
      });
      return args.groupId;
    }

    return await ctx.db.insert("reportCardTermSettingGroups", {
      schoolId,
      sessionId: term.sessionId,
      termId: args.termId,
      name,
      classIds: uniqueClassIds,
      ...(args.nextTermBegins !== null ? { nextTermBegins: args.nextTermBegins } : {}),
      ...(args.timesSchoolOpened !== null ? { timesSchoolOpened: args.timesSchoolOpened } : {}),
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });
  },
});

export const deleteTermReportCardSettingGroup = mutation({
  args: {
    groupId: v.id("reportCardTermSettingGroups"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const group = await ctx.db.get(args.groupId);
    if (!group || group.schoolId !== schoolId) {
      throw new ConvexError("Shared group not found");
    }

    await ctx.db.delete(args.groupId);
    return null;
  },
});
