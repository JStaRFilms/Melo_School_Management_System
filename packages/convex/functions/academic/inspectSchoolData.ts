import { query } from "../../_generated/server";

export const getOliveSubjectAssignments = query({
  args: {},
  handler: async (ctx) => {
    const school = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), "olive-blessed"))
      .first();
    if (!school) return null;

    const classSubjects = await ctx.db
      .query("classSubjects")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .collect();

    const teacherAssignments = await ctx.db
      .query("teacherAssignments")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .collect();

    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .collect();

    const subjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .collect();

    const users = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .collect();

    return classes.map((c) => {
      const offerings = classSubjects.filter((cs) => cs.classId === c._id);
      const direct = teacherAssignments.filter((ta) => ta.classId === c._id);

      return {
        className: c.name,
        offerings: offerings.map((o) => {
          const sub = subjects.find((s) => s._id === o.subjectId);
          const teach = o.teacherId ? users.find((u) => u._id === o.teacherId) : null;
          return {
            subject: sub?.name,
            teacher: teach ? `${teach.name} (${teach.email})` : "Unassigned",
          };
        }),
        directTeacherAssignments: direct.map((d) => {
          const sub = subjects.find((s) => s._id === d.subjectId);
          const teach = users.find((u) => u._id === d.teacherId);
          return {
            subject: sub?.name,
            teacher: teach ? `${teach.name} (${teach.email})` : "Unassigned",
          };
        }),
      };
    });
  },
});
