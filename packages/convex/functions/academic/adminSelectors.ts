import { ACADEMIC_CONTEXT_CAPABILITIES } from "../../../shared/src/workspace-capability-matrix";
import { query } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import { formatClassDisplayName, normalizeHumanName } from "@school/shared/name-format";
import { getDerivedUmbrellaSubjectIdsForClass } from "./subjectAggregationHelpers";
import { assertBranchDoc } from "../foundation/tenantScope";

export const getAdminSessions = query({
  args: { schoolId: v.optional(v.id("schools")) },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", q => q.eq("schoolId", schoolId))
      .collect();

    return sessions
      .filter(session => !session.isArchived)
      .sort((a, b) => b.startDate - a.startDate)
      .map(session => ({
        id: session._id,
        name: normalizeHumanName(session.name),
      }));
  },
});

export const getTermsBySession = query({
  args: { sessionId: v.id("academicSessions"), schoolId: v.optional(v.id("schools")) },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    assertBranchDoc(session, schoolId, { excludeArchived: true });

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
  args: { schoolId: v.optional(v.id("schools")) },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
      .collect();

    return classes
      .filter((classDoc: any) => !classDoc.isArchived)
      .map((classDoc: any) => ({
        id: classDoc._id,
        name: formatClassDisplayName({
          gradeName: classDoc.gradeName ?? classDoc.name,
          classLabel: classDoc.classLabel,
          name: classDoc.name,
        }),
      }))
      .sort((a: any, b: any) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
  },
});

export const getSubjectsByClass = query({
  args: { classId: v.id("classes"), schoolId: v.optional(v.id("schools")) },
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: ACADEMIC_CONTEXT_CAPABILITIES });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    assertBranchDoc(classDoc, schoolId, { excludeArchived: true });

    const [offerings, derivedUmbrellaIds] = await Promise.all([
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
      offerings.map((offering: any) => ctx.db.get(offering.subjectId))
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
