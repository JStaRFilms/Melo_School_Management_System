import { ACADEMIC_CONTEXT_CAPABILITIES } from "../../../shared/src/workspace-capability-matrix";
import { query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  getTeacherAssignableClassIds,
  getTeacherAssignableSubjectIds,
} from "./auth";
import { formatClassDisplayName, normalizeHumanName } from "@school/shared/name-format";
import { getDerivedUmbrellaSubjectIdsForClass } from "./subjectAggregationHelpers";

export const getTeacherSessions = query({
  args: { schoolId: v.optional(v.id("schools")) },
  returns: v.array(v.object({ _id: v.id("academicSessions"), name: v.string() })),
  handler: async (ctx: any, args: { schoolId?: Id<"schools"> }) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
      .collect();

    return sessions
      .filter((session: any) => !session.isArchived)
      .sort((a: any, b: any) => b.startDate - a.startDate)
      .map((session: any) => ({
        _id: session._id,
        name: normalizeHumanName(session.name),
      }));
  },
});

export const getTermsBySession = query({
  args: { schoolId: v.optional(v.id("schools")), sessionId: v.id("academicSessions") },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any, args: { schoolId?: Id<"schools">; sessionId: any }) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    const session = await ctx.db.get(args.sessionId);

    if (!session || session.schoolId !== schoolId || session.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    const terms = await ctx.db
      .query("academicTerms")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    return terms
      .filter((term: any) => term.schoolId === schoolId)
      .sort((a: any, b: any) => a.startDate - b.startDate)
      .map((term: any) => ({
        id: term._id,
        name: normalizeHumanName(term.name),
      }));
  },
});

export const getTeacherActiveTerms = query({
  args: { schoolId: v.optional(v.id("schools")) },
  returns: v.array(v.object({ id: v.string(), name: v.string(), isActive: v.boolean() })),
  handler: async (ctx: any, args: { schoolId?: Id<"schools"> }) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    const terms = await ctx.db
      .query("academicTerms")
      .withIndex("by_school_active", (q: any) => q.eq("schoolId", schoolId).eq("isActive", true))
      .collect();

    return terms
      .filter((term: any) => term.schoolId === schoolId)
      .sort((a: any, b: any) => a.startDate - b.startDate)
      .map((term: any) => ({
        id: term._id,
        name: normalizeHumanName(term.name),
        isActive: term.isActive === true,
      }));
  },
});

export const getTeacherAssignableClasses = query({
  args: { schoolId: v.optional(v.id("schools")) },
  returns: v.array(
    v.object({
      _id: v.id("classes"),
      name: v.string(),
      gradeName: v.optional(v.string()),
      classLabel: v.optional(v.string()),
    })
  ),
  handler: async (ctx: any, args: { schoolId?: Id<"schools"> }) => {
    const { schoolId, userId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });

    if (isSchoolAdmin || role === "admin") {
      const classes = await ctx.db
        .query("classes")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();

      return classes
        .filter((classDoc: any) => !classDoc.isArchived)
        .map((classDoc: any) => ({
          _id: classDoc._id,
          name: formatClassDisplayName({
            gradeName: classDoc.gradeName ?? classDoc.name,
            classLabel: classDoc.classLabel,
            name: classDoc.name,
          }),
          gradeName: classDoc.gradeName ?? undefined,
          classLabel: classDoc.classLabel ?? undefined,
        }))
        .sort((a: any, b: any) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        );
    }

    if (role !== "teacher") {
      throw new ConvexError("Unauthorized");
    }

    const classIds = await getTeacherAssignableClassIds(ctx, userId, schoolId);
    const classes = await Promise.all(
      classIds.map((classId) => ctx.db.get(classId))
    );

    return classes
      .filter(
        (classDoc: any) =>
          classDoc &&
          classDoc.schoolId === schoolId &&
          !classDoc.isArchived
      )
      .map((classDoc: any) => ({
        _id: classDoc._id,
        name: formatClassDisplayName({
          gradeName: classDoc.gradeName ?? classDoc.name,
          classLabel: classDoc.classLabel,
          name: classDoc.name,
        }),
        gradeName: classDoc.gradeName ?? undefined,
        classLabel: classDoc.classLabel ?? undefined,
      }))
      .sort((a: any, b: any) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
  },
});

export const getTeacherAssignableSubjectsByClass = query({
  args: { schoolId: v.optional(v.id("schools")), classId: v.id("classes") },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any, args: { schoolId?: Id<"schools">; classId: any }) => {
    const { schoolId, userId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    const classDoc = await ctx.db.get(args.classId);

    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    if (isSchoolAdmin || role === "admin") {
      const [classOfferings, derivedUmbrellaIds] = await Promise.all([
        ctx.db
          .query("classSubjects")
          .withIndex("by_class", (q: any) => q.eq("classId", args.classId))
          .collect(),
        getDerivedUmbrellaSubjectIdsForClass(ctx, {
          schoolId,
          classId: args.classId,
        }),
      ]);

      const subjects = await Promise.all(
        classOfferings.map((offering: any) => ctx.db.get(offering.subjectId))
      );

      return subjects
        .filter(
          (subject: any) =>
            subject &&
            subject.schoolId === schoolId &&
            !subject.isArchived &&
            !derivedUmbrellaIds.has(String(subject._id))
        )
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
        .map((subject: any) => ({
          id: subject._id,
          name: normalizeHumanName(subject.name),
        }));
    }

    if (role !== "teacher") {
      throw new ConvexError("Unauthorized");
    }

    const subjectIds = await getTeacherAssignableSubjectIds(
      ctx,
      userId,
      schoolId,
      args.classId
    );
    const derivedUmbrellaIds = await getDerivedUmbrellaSubjectIdsForClass(ctx, {
      schoolId,
      classId: args.classId,
    });

    const subjects = await Promise.all(
      subjectIds.map((subjectId) => ctx.db.get(subjectId))
    );

    return subjects
      .filter(
        (subject: any) =>
          subject &&
          subject.schoolId === schoolId &&
          !subject.isArchived &&
          !derivedUmbrellaIds.has(String(subject._id))
      )
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((subject: any) => ({
        id: subject._id,
        name: normalizeHumanName(subject.name),
      }));
  },
});
