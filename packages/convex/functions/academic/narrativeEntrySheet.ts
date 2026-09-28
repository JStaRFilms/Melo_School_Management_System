import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { getAuthenticatedSchoolMembership, assertTeacherAssignment } from "./auth";
import { getReadableUserName } from "./studentNameCompat";
import { deriveNarrativeSubjectSelectionIds } from "./subjectAggregationSelectionHelpers";
import { listActiveClassSubjectAggregations } from "./subjectAggregationHelpers";

// A bounded sheet for the selected subject. Authorization and applicability are
// repeated at saveDraft, so a stale roster cannot authorize a write.
export const getSheet = query({
  args: { schoolId: v.optional(v.id("schools")), classId: v.id("classes"), sessionId: v.id("academicSessions"), termId: v.id("academicTerms"), subjectId: v.id("subjects") },
  returns: v.array(v.object({ studentId: v.id("students"), studentName: v.string(), comment: v.string(), issued: v.boolean() })),
  handler: async (ctx, args) => {
    const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, capability: "academic.report_cards.preview" });
    const [classDoc, session, term, subject] = await Promise.all([
      ctx.db.get(args.classId), ctx.db.get(args.sessionId), ctx.db.get(args.termId), ctx.db.get(args.subjectId),
    ]);
    if (!classDoc || classDoc.schoolId !== auth.schoolId || classDoc.isArchived || !session || session.schoolId !== auth.schoolId ||
        !term || term.schoolId !== auth.schoolId || term.sessionId !== args.sessionId || !subject || subject.schoolId !== auth.schoolId || subject.isArchived)
      throw new ConvexError("Invalid sheet selection");
    const mode = await ctx.db.query("classSessionReportModes").withIndex("by_classId_and_sessionId", q => q.eq("classId", args.classId).eq("sessionId", args.sessionId)).unique();
    if (!mode) throw new ConvexError("This class uses graded reports");
    if (!auth.isSchoolAdmin) {
      if (auth.role !== "teacher") throw new ConvexError("Staff access required");
      await assertTeacherAssignment(ctx, auth.userId, args.classId, args.subjectId);
    }
    const [current, arrivals, departures, graduating, assignments, aggregations, issuedRows] = await Promise.all([
      session.isActive ? ctx.db.query("students").withIndex("by_school_and_class", q => q.eq("schoolId", auth.schoolId).eq("classId", args.classId)).take(201) : Promise.resolve([]),
      ctx.db.query("studentPromotions").withIndex("by_to_class_and_to_session", q => q.eq("toClassId", args.classId).eq("toSessionId", args.sessionId)).take(201),
      ctx.db.query("studentPromotions").withIndex("by_from_class_and_from_session", q => q.eq("fromClassId", args.classId).eq("fromSessionId", args.sessionId)).take(201),
      ctx.db.query("studentGraduations").withIndex("by_class_and_session", q => q.eq("classId", args.classId).eq("sessionId", args.sessionId)).take(201),
      ctx.db.query("classSubjects").withIndex("by_class", q => q.eq("classId", args.classId)).take(101),
      listActiveClassSubjectAggregations(ctx, { schoolId: auth.schoolId, classId: args.classId }),
      ctx.db.query("issuedNarrativeReports").withIndex("by_classId_and_sessionId_and_termId", q => q.eq("classId", args.classId).eq("sessionId", args.sessionId).eq("termId", args.termId)).take(201),
    ]);
    if ([current, arrivals, departures, graduating, issuedRows].some(rows => rows.length > 200) || assignments.length > 100)
      throw new ConvexError("Roster exceeds supported size");
    const candidateIds = [...new Set([...current.map(s => s._id), ...arrivals.map(p => p.studentId), ...departures.map(p => p.studentId), ...graduating.map(g => g.studentId)])];
    if (candidateIds.length > 200) throw new ConvexError("Roster exceeds supported size");
    const students = await Promise.all(candidateIds.map(id => ctx.db.get(id)));
    const enrolled = (await Promise.all(students.map(async student => {
      if (!student || student.schoolId !== auth.schoolId || student.isArchived) return null;
      // Match assertStaff: a promotion out of this class still proves membership
      // in its old session; the current class alone proves only active enrollment.
      const fromHere = departures.some(p => p.schoolId === auth.schoolId && p.studentId === student._id);
      const toHere = arrivals.some(p => p.schoolId === auth.schoolId && p.studentId === student._id);
      const graduatedHere = student.graduatingSessionId === args.sessionId && student.graduatingClassId === args.classId &&
        graduating.some(g => g.schoolId === auth.schoolId && g.studentId === student._id);
      if (!fromHere && !toHere && !graduatedHere) {
        if (!session.isActive || student.classId !== args.classId) return null;
        const to = await ctx.db.query("studentPromotions").withIndex("by_student_and_to_session", q =>
          q.eq("studentId", student._id).eq("toSessionId", args.sessionId)).take(100);
        if (to.length === 100) throw new ConvexError("Enrollment history requires review");
        if (to.length) return null;
      }
      return student;
    }))).filter((student): student is NonNullable<typeof student> => student !== null);
    const drafts = await ctx.db.query("narrativeReportDrafts").withIndex("by_classId_and_sessionId_and_termId_and_subjectId", q => q.eq("classId", args.classId).eq("sessionId", args.sessionId).eq("termId", args.termId).eq("subjectId", args.subjectId)).take(201);
    if (drafts.length > 200) throw new ConvexError("Roster exceeds supported size");
    const draftMap = new Map(drafts.filter(d => d.schoolId === auth.schoolId).map(d => [d.studentId, d]));
    const issuedMap = new Map(issuedRows.filter(row => row.schoolId === auth.schoolId).map(row => [row.studentId, row]));
    const rows = await Promise.all(enrolled.map(async student => {
      const explicit = await ctx.db.query("studentSubjectSelections").withIndex("by_student_and_class_and_session", q =>
        q.eq("studentId", student._id).eq("classId", args.classId).eq("sessionId", args.sessionId)).take(101);
      if (explicit.length > 100) throw new ConvexError("Subject list exceeds supported size");
      const ids = deriveNarrativeSubjectSelectionIds({ explicitSubjectIds: (explicit.length ? explicit : assignments).filter(s => s.schoolId === auth.schoolId).map(s => String(s.subjectId)), aggregations });
      if (!ids.has(String(args.subjectId))) return null;
      const user = await ctx.db.get(student.userId);
      const issued = issuedMap.get(student._id);
      if (issued && issued.classId !== args.classId) throw new ConvexError("Report already issued for another class");
      return { studentId: student._id as Id<"students">, studentName: getReadableUserName(user).displayName, comment: issued?.snapshot.subjects.find(s => s.subjectId === args.subjectId)?.comment ?? draftMap.get(student._id)?.comment ?? "", issued: Boolean(issued) };
    }));
    return rows.filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => a.studentName.localeCompare(b.studentName));
  },
});
