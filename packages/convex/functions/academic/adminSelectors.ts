import { query } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import { formatClassDisplayName, normalizeHumanName } from "@school/shared";

export const getAdminSessions = query({
  args: {},
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
      .collect();

    return sessions
      .sort((a: any, b: any) => b.startDate - a.startDate)
      .map((session: any) => ({
        id: session._id,
        name: normalizeHumanName(session.name),
      }));
  },
});

export const getTermsBySession = query({
  args: { sessionId: v.id("academicSessions") },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any, args: { sessionId: any }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId) {
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

export const getAllClasses = query({
  args: {},
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
      .collect();

    return classes
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((classDoc: any) => ({
        id: classDoc._id,
        name: formatClassDisplayName({
          gradeName: classDoc.gradeName ?? classDoc.name,
          classLabel: classDoc.classLabel,
          name: classDoc.name,
        }),
      }));
  },
});

export const getSubjectsByClass = query({
  args: { classId: v.id("classes") },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx: any, args: { classId: any }) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const subjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
      .collect();

    return subjects
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((subject: any) => ({
        id: subject._id,
        name: normalizeHumanName(subject.name),
      }));
  },
});
