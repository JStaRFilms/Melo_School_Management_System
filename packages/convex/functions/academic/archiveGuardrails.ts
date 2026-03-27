import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
  formatClassDisplayName,
  normalizeHumanName,
} from "@school/shared/name-format";

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

function summarizeBlockers(blockers: string[]) {
  const uniqueBlockers = [...new Set(blockers)].filter(Boolean);

  if (uniqueBlockers.length === 0) {
    return "";
  }

  if (uniqueBlockers.length <= 3) {
    return uniqueBlockers.join(", ");
  }

  return `${uniqueBlockers.slice(0, 3).join(", ")}, and ${
    uniqueBlockers.length - 3
  } more`;
}

export async function assertTeacherCanBeArchived(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    teacherId: Id<"users">;
  }
) {
  const [classes, classSubjects, teacherAssignments, subjects] =
    await Promise.all([
      ctx.db
        .query("classes")
        .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
        .collect(),
      ctx.db
        .query("classSubjects")
        .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
        .collect(),
      ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher", (q: any) => q.eq("teacherId", args.teacherId))
        .collect(),
      ctx.db
        .query("subjects")
        .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
        .collect(),
    ]);

  const activeClasses: Map<string, any> = new Map(
    classes
      .filter((classDoc: any) => !classDoc.isArchived)
      .map((classDoc: any) => [String(classDoc._id), classDoc] as const)
  );
  const activeSubjects: Map<string, any> = new Map(
    subjects
      .filter((subject: any) => !subject.isArchived)
      .map((subject: any) => [String(subject._id), subject] as const)
  );

  const blockers: string[] = [];

  for (const classDoc of activeClasses.values()) {
    if (String(classDoc.formTeacherId) === String(args.teacherId)) {
      blockers.push(`form teacher for ${buildClassName(classDoc)}`);
    }
  }

  for (const offering of classSubjects) {
    if (String(offering.teacherId) !== String(args.teacherId)) {
      continue;
    }

    const classDoc = activeClasses.get(String(offering.classId));
    const subject = activeSubjects.get(String(offering.subjectId));
    if (!classDoc || !subject) {
      continue;
    }

    blockers.push(
      `${normalizeHumanName(subject.name)} in ${buildClassName(classDoc)}`
    );
  }

  for (const assignment of teacherAssignments) {
    if (String(assignment.schoolId) !== String(args.schoolId)) {
      continue;
    }

    const classDoc = activeClasses.get(String(assignment.classId));
    const subject = activeSubjects.get(String(assignment.subjectId));
    if (!classDoc || !subject) {
      continue;
    }

    blockers.push(
      `${normalizeHumanName(subject.name)} in ${buildClassName(classDoc)}`
    );
  }

  if (blockers.length > 0) {
    throw new ConvexError(
      `Reassign this teacher before archiving. Active links: ${summarizeBlockers(
        blockers
      )}.`
    );
  }
}

export async function assertSessionCanBeArchived(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    sessionId: Id<"academicSessions">;
  }
) {
  const terms = await ctx.db
    .query("academicTerms")
    .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
    .collect();

  const activeTerms = terms.filter(
    (term: any) => term.schoolId === args.schoolId && term.isActive
  );

  if (activeTerms.length > 0) {
    const termNames = activeTerms.map((term: any) => normalizeHumanName(term.name));
    throw new ConvexError(
      `Make all terms in this session inactive before archiving it. Active terms: ${summarizeBlockers(
        termNames
      )}.`
    );
  }
}

export async function assertSubjectCanBeArchived(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    subjectId: Id<"subjects">;
  }
) {
  const [classes, sessions, classOfferings, selections] = await Promise.all([
    ctx.db
      .query("classes")
      .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
      .collect(),
    ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
      .collect(),
    ctx.db
      .query("classSubjects")
      .withIndex("by_subject", (q: any) => q.eq("subjectId", args.subjectId))
      .collect(),
    ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_subject", (q: any) => q.eq("subjectId", args.subjectId))
      .collect(),
  ]);

  const activeClasses: Map<string, any> = new Map(
    classes
      .filter((classDoc: any) => !classDoc.isArchived)
      .map((classDoc: any) => [String(classDoc._id), classDoc] as const)
  );
  const activeSessions = new Set(
    sessions
      .filter((session: any) => !session.isArchived)
      .map((session: any) => String(session._id))
  );
  const sessionNames = new Map(
    sessions.map((session: any) => [
      String(session._id),
      normalizeHumanName(session.name),
    ] as const)
  );

  const blockers = new Set<string>();

  for (const offering of classOfferings) {
    if (String(offering.schoolId) !== String(args.schoolId)) {
      continue;
    }

    const classDoc = activeClasses.get(String(offering.classId));
    if (!classDoc) {
      continue;
    }

    blockers.add(buildClassName(classDoc));
  }

  for (const selection of selections) {
    if (
      String(selection.schoolId) !== String(args.schoolId) ||
      !activeSessions.has(String(selection.sessionId))
    ) {
      continue;
    }

    const classDoc = activeClasses.get(String(selection.classId));
    if (!classDoc) {
      continue;
    }

    const sessionName =
      sessionNames.get(String(selection.sessionId)) ?? "current session";
    blockers.add(`${buildClassName(classDoc)} (${sessionName})`);
  }

  if (blockers.size > 0) {
    throw new ConvexError(
      `Remove this subject from active class setups before archiving it. Still used in: ${summarizeBlockers(
        [...blockers]
      )}.`
    );
  }
}

export async function assertClassCanBeArchived(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    className: string;
  }
) {
  const students = await ctx.db
    .query("students")
    .withIndex("by_school_and_class", (q: any) =>
      q.eq("schoolId", args.schoolId).eq("classId", args.classId)
    )
    .collect();

  if (students.length > 0) {
    throw new ConvexError(
      `Move all enrolled students out of ${args.className} before archiving it.`
    );
  }
}
