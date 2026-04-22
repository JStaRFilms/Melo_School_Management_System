import { query } from "../../_generated/server";
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
  args: {},
  returns: v.array(v.object({ _id: v.id("academicSessions"), name: v.string() })),
  handler: async (ctx: any) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx);
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
  args: { sessionId: v.id("academicSessions") },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any, args: { sessionId: any }) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx);
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

export const getTeacherAssignableClasses = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("classes"),
      name: v.string(),
      gradeName: v.optional(v.string()),
      classLabel: v.optional(v.string()),
    })
  ),
  handler: async (ctx: any) => {
    const { schoolId, userId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);

    if (isSchoolAdmin || role === "admin") {
      const classes = await ctx.db
        .query("classes")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect();

      return classes
        .filter((classDoc: any) => !classDoc.isArchived)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
        .map((classDoc: any) => ({
          _id: classDoc._id,
          name: formatClassDisplayName({
            gradeName: classDoc.gradeName ?? classDoc.name,
            classLabel: classDoc.classLabel,
            name: classDoc.name,
          }),
          gradeName: classDoc.gradeName ?? undefined,
          classLabel: classDoc.classLabel ?? undefined,
        }));
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
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((classDoc: any) => ({
        _id: classDoc._id,
        name: formatClassDisplayName({
          gradeName: classDoc.gradeName ?? classDoc.name,
          classLabel: classDoc.classLabel,
          name: classDoc.name,
        }),
        gradeName: classDoc.gradeName ?? undefined,
        classLabel: classDoc.classLabel ?? undefined,
      }));
  },
});

export const getTeacherAssignableSubjectsByClass = query({
  args: { classId: v.id("classes") },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any, args: { classId: any }) => {
    const { schoolId, userId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
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
