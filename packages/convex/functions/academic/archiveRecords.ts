import { query } from "../../_generated/server";
import { v } from "convex/values";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";
import {
  formatClassDisplayName,
  normalizeHumanName,
  normalizePersonName,
} from "@school/shared/name-format";

const archiveRecordTypeValidator = v.union(
  v.literal("session"),
  v.literal("class"),
  v.literal("teacher"),
  v.literal("subject")
);

const archiveRecordValidator = v.object({
  id: v.string(),
  type: archiveRecordTypeValidator,
  typeLabel: v.string(),
  recordId: v.string(),
  name: v.string(),
  subtitle: v.union(v.string(), v.null()),
  archivedAt: v.number(),
  createdAt: v.number(),
  archivedById: v.union(v.id("users"), v.null()),
  archivedByName: v.union(v.string(), v.null()),
  statusNote: v.string(),
  linkedHistory: v.string(),
  detailFields: v.array(
    v.object({
      label: v.string(),
      value: v.string(),
    })
  ),
});

function formatDateLabel(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildClassName(classDoc: {
  gradeName?: string | null;
  classLabel?: string | null;
  name: string;
}) {
  return formatClassDisplayName({
    gradeName: classDoc.gradeName,
    classLabel: classDoc.classLabel,
    name: classDoc.name,
  });
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export const listArchivedRecords = query({
  args: {},
  returns: v.object({
    summary: v.object({
      totalArchived: v.number(),
      archivedSessions: v.number(),
      archivedClasses: v.number(),
      archivedTeachers: v.number(),
      archivedSubjects: v.number(),
    }),
    records: v.array(archiveRecordValidator),
  }),
  handler: async (ctx) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const [
      users,
      sessions,
      classes,
      subjects,
      terms,
      classSubjects,
      teacherAssignments,
      students,
      selections,
      assessments,
    ] = await Promise.all([
      ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("academicSessions").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("subjects").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("academicTerms").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("classSubjects").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("teacherAssignments").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("studentSubjectSelections").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
      ctx.db.query("assessmentRecords").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect(),
    ]);

    const userLookup = new Map(users.map((user) => [String(user._id), user] as const));
    const sessionLookup = new Map(sessions.map((session) => [String(session._id), session] as const));
    const classLookup = new Map(classes.map((classDoc) => [String(classDoc._id), classDoc] as const));

    const classSubjectCountByClass = new Map<string, number>();
    const classSubjectCountBySubject = new Map<string, number>();
    const assessmentCountByClass = new Map<string, number>();
    const assessmentCountBySubject = new Map<string, number>();
    const assessmentCountBySession = new Map<string, number>();
    const selectionCountBySession = new Map<string, number>();
    const selectionCountBySubject = new Map<string, number>();
    const assignmentCountByTeacher = new Map<string, number>();
    const classOfferingCountByTeacher = new Map<string, number>();
    const formClassCountByTeacher = new Map<string, number>();
    const studentCountByClass = new Map<string, number>();
    const termCountBySession = new Map<string, number>();

    for (const classSubject of classSubjects) {
      const classId = String(classSubject.classId);
      const subjectId = String(classSubject.subjectId);
      classSubjectCountByClass.set(classId, (classSubjectCountByClass.get(classId) ?? 0) + 1);
      classSubjectCountBySubject.set(subjectId, (classSubjectCountBySubject.get(subjectId) ?? 0) + 1);
      if (classSubject.teacherId) {
        const teacherId = String(classSubject.teacherId);
        classOfferingCountByTeacher.set(
          teacherId,
          (classOfferingCountByTeacher.get(teacherId) ?? 0) + 1
        );
      }
    }

    for (const assignment of teacherAssignments) {
      const teacherId = String(assignment.teacherId);
      assignmentCountByTeacher.set(
        teacherId,
        (assignmentCountByTeacher.get(teacherId) ?? 0) + 1
      );
    }

    for (const classDoc of classes) {
      if (!classDoc.formTeacherId) continue;
      const teacherId = String(classDoc.formTeacherId);
      formClassCountByTeacher.set(teacherId, (formClassCountByTeacher.get(teacherId) ?? 0) + 1);
    }

    for (const student of students) {
      const classId = String(student.classId);
      studentCountByClass.set(classId, (studentCountByClass.get(classId) ?? 0) + 1);
    }

    for (const term of terms) {
      const sessionId = String(term.sessionId);
      termCountBySession.set(sessionId, (termCountBySession.get(sessionId) ?? 0) + 1);
    }

    for (const selection of selections) {
      const sessionId = String(selection.sessionId);
      const subjectId = String(selection.subjectId);
      selectionCountBySession.set(sessionId, (selectionCountBySession.get(sessionId) ?? 0) + 1);
      selectionCountBySubject.set(subjectId, (selectionCountBySubject.get(subjectId) ?? 0) + 1);
    }

    for (const assessment of assessments) {
      const classId = String(assessment.classId);
      const subjectId = String(assessment.subjectId);
      const sessionId = String(assessment.sessionId);
      assessmentCountByClass.set(classId, (assessmentCountByClass.get(classId) ?? 0) + 1);
      assessmentCountBySubject.set(subjectId, (assessmentCountBySubject.get(subjectId) ?? 0) + 1);
      assessmentCountBySession.set(sessionId, (assessmentCountBySession.get(sessionId) ?? 0) + 1);
    }

    const archivedByName = (archivedBy?: unknown) => {
      if (!archivedBy) return null;
      const archivedUser = userLookup.get(String(archivedBy));
      return archivedUser ? normalizePersonName(archivedUser.name) : null;
    };

    const sessionRecords = sessions
      .filter((session) => session.isArchived)
      .map((session) => ({
        id: `session:${String(session._id)}`,
        type: "session" as const,
        typeLabel: "Session",
        recordId: String(session._id),
        name: normalizeHumanName(session.name),
        subtitle: `${formatDateLabel(session.startDate)} to ${formatDateLabel(session.endDate)}`,
        archivedAt: session.archivedAt ?? session.updatedAt,
        createdAt: session.createdAt,
        archivedById: session.archivedBy ?? null,
        archivedByName: archivedByName(session.archivedBy),
        statusNote: "Removed from active session setup while preserving historical records.",
        linkedHistory: `${pluralize(termCountBySession.get(String(session._id)) ?? 0, "term")}, ${pluralize(selectionCountBySession.get(String(session._id)) ?? 0, "selection row")}, and ${pluralize(assessmentCountBySession.get(String(session._id)) ?? 0, "assessment row")} remain tied to this session.`,
        detailFields: [
          { label: "Period", value: `${formatDateLabel(session.startDate)} to ${formatDateLabel(session.endDate)}` },
          { label: "Terms", value: String(termCountBySession.get(String(session._id)) ?? 0) },
          { label: "Subject selections", value: String(selectionCountBySession.get(String(session._id)) ?? 0) },
          { label: "Assessment records", value: String(assessmentCountBySession.get(String(session._id)) ?? 0) },
        ],
      }));

    const classRecords = classes
      .filter((classDoc) => classDoc.isArchived)
      .map((classDoc) => {
        const formTeacher =
          classDoc.formTeacherId ? userLookup.get(String(classDoc.formTeacherId)) : null;
        return {
          id: `class:${String(classDoc._id)}`,
          type: "class" as const,
          typeLabel: "Class",
          recordId: String(classDoc._id),
          name: buildClassName(classDoc),
          subtitle: normalizeHumanName(classDoc.level),
          archivedAt: classDoc.archivedAt ?? classDoc.updatedAt,
          createdAt: classDoc.createdAt,
          archivedById: classDoc.archivedBy ?? null,
          archivedByName: archivedByName(classDoc.archivedBy),
          statusNote: "Hidden from class setup and current enrollment flows.",
          linkedHistory: `${pluralize(classSubjectCountByClass.get(String(classDoc._id)) ?? 0, "subject offering")}, ${pluralize(assessmentCountByClass.get(String(classDoc._id)) ?? 0, "assessment row")}, and ${pluralize(studentCountByClass.get(String(classDoc._id)) ?? 0, "student row")} still reference this class.`,
          detailFields: [
            { label: "Level", value: normalizeHumanName(classDoc.level) },
            { label: "Form teacher", value: formTeacher ? normalizePersonName(formTeacher.name) : "None assigned" },
            { label: "Subject blueprint", value: String(classSubjectCountByClass.get(String(classDoc._id)) ?? 0) },
            { label: "Student rows", value: String(studentCountByClass.get(String(classDoc._id)) ?? 0) },
          ],
        };
      });

    const teacherRecords = users
      .filter((user) => user.role === "teacher" && user.isArchived)
      .map((teacher) => ({
        id: `teacher:${String(teacher._id)}`,
        type: "teacher" as const,
        typeLabel: "Teacher",
        recordId: String(teacher._id),
        name: normalizePersonName(teacher.name),
        subtitle: teacher.email,
        archivedAt: teacher.archivedAt ?? teacher.updatedAt,
        createdAt: teacher.createdAt,
        archivedById: teacher.archivedBy ?? null,
        archivedByName: archivedByName(teacher.archivedBy),
        statusNote: "Teaching access is removed, but identity data stays for history and audit.",
        linkedHistory: `${pluralize(formClassCountByTeacher.get(String(teacher._id)) ?? 0, "form class")}, ${pluralize(classOfferingCountByTeacher.get(String(teacher._id)) ?? 0, "class-subject link")}, and ${pluralize(assignmentCountByTeacher.get(String(teacher._id)) ?? 0, "assignment")} are attached to this teacher record.`,
        detailFields: [
          { label: "Email", value: teacher.email },
          { label: "Form classes", value: String(formClassCountByTeacher.get(String(teacher._id)) ?? 0) },
          { label: "Class-subject links", value: String(classOfferingCountByTeacher.get(String(teacher._id)) ?? 0) },
          { label: "Assignments", value: String(assignmentCountByTeacher.get(String(teacher._id)) ?? 0) },
        ],
      }));

    const subjectRecords = subjects
      .filter((subject) => subject.isArchived)
      .map((subject) => ({
        id: `subject:${String(subject._id)}`,
        type: "subject" as const,
        typeLabel: "Subject",
        recordId: String(subject._id),
        name: normalizeHumanName(subject.name),
        subtitle: subject.code,
        archivedAt: subject.archivedAt ?? subject.updatedAt,
        createdAt: subject.createdAt,
        archivedById: subject.archivedBy ?? null,
        archivedByName: archivedByName(subject.archivedBy),
        statusNote: "Removed from active class offerings and selection flows.",
        linkedHistory: `${pluralize(classSubjectCountBySubject.get(String(subject._id)) ?? 0, "class offering")}, ${pluralize(selectionCountBySubject.get(String(subject._id)) ?? 0, "selection row")}, and ${pluralize(assessmentCountBySubject.get(String(subject._id)) ?? 0, "assessment row")} still preserve this subject in history.`,
        detailFields: [
          { label: "Code", value: subject.code },
          { label: "Linked classes", value: String(classSubjectCountBySubject.get(String(subject._id)) ?? 0) },
          { label: "Subject selections", value: String(selectionCountBySubject.get(String(subject._id)) ?? 0) },
          { label: "Assessment records", value: String(assessmentCountBySubject.get(String(subject._id)) ?? 0) },
        ],
      }));

    const records = [
      ...sessionRecords,
      ...classRecords,
      ...teacherRecords,
      ...subjectRecords,
    ].sort((a, b) => b.archivedAt - a.archivedAt);

    return {
      summary: {
        totalArchived: records.length,
        archivedSessions: sessionRecords.length,
        archivedClasses: classRecords.length,
        archivedTeachers: teacherRecords.length,
        archivedSubjects: subjectRecords.length,
      },
      records,
    };
  },
});
