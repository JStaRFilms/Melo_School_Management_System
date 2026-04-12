import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { formatClassDisplayName, normalizeHumanName } from "@school/shared/name-format";
import { getAuthenticatedSchoolMembership } from "./academic/auth";
import { buildStudentReportCard, reportCardResultValidator } from "./academic/reportCards";
import { getReadableUserName } from "./academic/studentNameCompat";

const portalStudentValidator = v.object({
  studentId: v.id("students"),
  userId: v.id("users"),
  name: v.string(),
  admissionNumber: v.string(),
  classId: v.id("classes"),
  className: v.string(),
  relationship: v.union(v.string(), v.null()),
  photoUrl: v.union(v.string(), v.null()),
  isActive: v.boolean(),
});

const portalHistoryItemValidator = v.object({
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  sessionName: v.string(),
  termName: v.string(),
  classId: v.id("classes"),
  className: v.string(),
  generatedAt: v.number(),
  totalSubjects: v.number(),
  recordedSubjects: v.number(),
  pendingSubjects: v.number(),
  averageScore: v.union(v.number(), v.null()),
  totalScore: v.number(),
  resultCalculationMode: v.union(
    v.literal("standalone"),
    v.literal("cumulative_annual")
  ),
  href: v.string(),
  note: v.union(v.string(), v.null()),
});

const portalNotificationValidator = v.object({
  id: v.string(),
  title: v.string(),
  body: v.string(),
  tone: v.union(v.literal("info"), v.literal("success"), v.literal("warning")),
  href: v.union(v.string(), v.null()),
});

export const portalWorkspaceDataValidator = v.object({
  school: v.object({
    id: v.id("schools"),
    name: v.string(),
    logoUrl: v.union(v.string(), v.null()),
  }),
  viewer: v.object({
    userId: v.id("users"),
    name: v.string(),
    role: v.union(v.literal("parent"), v.literal("student")),
    schoolId: v.id("schools"),
  }),
  students: v.array(portalStudentValidator),
  selectedStudentId: v.union(v.id("students"), v.null()),
  selectedSessionId: v.union(v.id("academicSessions"), v.null()),
  selectedTermId: v.union(v.id("academicTerms"), v.null()),
  selectedStudent: v.union(v.null(), portalStudentValidator),
  activeSession: v.union(
    v.null(),
    v.object({
      id: v.id("academicSessions"),
      name: v.string(),
    })
  ),
  activeTerm: v.union(
    v.null(),
    v.object({
      id: v.id("academicTerms"),
      name: v.string(),
    })
  ),
  selectedReportCard: v.union(v.null(), reportCardResultValidator),
  history: v.array(portalHistoryItemValidator),
  notifications: v.array(portalNotificationValidator),
});

function buildPortalHref(
  pathname: string,
  params: Record<string, string | null | undefined>
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function formatDateLabel(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function sortNewestFirst<T extends { startDate: number }>(items: T[]) {
  return [...items].sort((a, b) => b.startDate - a.startDate);
}

async function getAccessibleStudents(
  ctx: any,
  args: {
    userId: Id<"users">;
    schoolId: Id<"schools">;
    role: "parent" | "student";
  }
) {
  const classDocs = await ctx.db
    .query("classes")
    .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
    .collect();
  const classNameById = new Map<string, string>();
  for (const classDoc of classDocs) {
    if (!classDoc.isArchived) {
      classNameById.set(
        String(classDoc._id),
        formatClassDisplayName({
          gradeName: classDoc.gradeName,
          classLabel: classDoc.classLabel,
          name: classDoc.name,
        })
      );
    }
  }

  if (args.role === "student") {
    const studentRows = await ctx.db
      .query("students")
      .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
      .collect();
    const activeStudent = studentRows.find(
      (student: any) =>
        !student.isArchived && String(student.userId) === String(args.userId)
    );

    if (!activeStudent) {
      return {
        students: [] as Array<{
          student: any;
          relationship: string | null;
        }>,
        classNameById,
      };
    }

    return {
      students: [
        {
          student: activeStudent,
          relationship: null,
        },
      ],
      classNameById,
    };
  }

  const familyLinks = await ctx.db
    .query("familyMembers")
    .withIndex("by_parent_user", (q: any) => q.eq("parentUserId", args.userId))
    .collect();
  const familyById = new Map<string, string | null>();
  for (const familyLink of familyLinks) {
    familyById.set(String(familyLink.familyId), familyLink.relationship ?? null);
  }

  const studentById = new Map<string, { student: any; relationship: string | null }>();

  await Promise.all(
    familyLinks.map(async (familyLink: any) => {
      const familyStudents = await ctx.db
        .query("students")
        .withIndex("by_family", (q: any) => q.eq("familyId", familyLink.familyId))
        .collect();

      for (const student of familyStudents) {
        if (student.schoolId !== args.schoolId || student.isArchived) {
          continue;
        }

        const studentKey = String(student._id);
        if (!studentById.has(studentKey)) {
          studentById.set(studentKey, {
            student,
            relationship: familyById.get(String(familyLink.familyId)) ?? null,
          });
        }
      }
    })
  );

  return {
    students: [...studentById.values()],
    classNameById,
  };
}

async function tryBuildStudentReportCard(
  ctx: any,
  args: {
    userId: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    studentId: Id<"students">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
    preferredClassId?: Id<"classes">;
  }
) {
  try {
    return await buildStudentReportCard(ctx, {
      ...args,
      skipRoleCheck: true,
    });
  } catch {
    return null;
  }
}

export const getWorkspaceData = query({
  args: {
    studentId: v.optional(v.union(v.id("students"), v.null())),
    sessionId: v.optional(v.union(v.id("academicSessions"), v.null())),
    termId: v.optional(v.union(v.id("academicTerms"), v.null())),
    historyLimit: v.optional(v.number()),
  },
  returns: portalWorkspaceDataValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    const portalRole: "parent" | "student" | null =
      role === "parent" || role === "student" ? role : null;

    if (!portalRole) {
      throw new ConvexError("Unauthorized");
    }

    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    const [accessibleStudentsResult, sessions, terms, schoolEvents] = await Promise.all([
      getAccessibleStudents(ctx, { userId, schoolId, role: portalRole }),
      ctx.db
        .query("academicSessions")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect(),
      ctx.db
        .query("academicTerms")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect(),
      ctx.db
        .query("schoolEvents")
        .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
        .collect(),
    ]);

    const studentRows = accessibleStudentsResult.students;
    const classNameById = accessibleStudentsResult.classNameById;
    const selectedStudentRow =
      args.studentId === undefined || args.studentId === null
        ? studentRows[0] ?? null
        : studentRows.find((entry) => String(entry.student._id) === String(args.studentId)) ?? null;

    if (
      (args.studentId !== undefined && args.studentId !== null) &&
      !selectedStudentRow &&
      studentRows.length > 0
    ) {
      throw new ConvexError("Student not found");
    }

    const selectedStudent = selectedStudentRow
      ? selectedStudentRow.student
      : null;
    const selectedStudentId = selectedStudent ? selectedStudent._id : null;

    const normalizedStudents = await Promise.all(
      studentRows.map(async ({ student, relationship }) => {
        const [studentUser, photoUrl] = await Promise.all([
          ctx.db.get(student.userId),
          student.photoStorageId ? ctx.storage.getUrl(student.photoStorageId) : null,
        ]);

        const studentUserRecord = studentUser as
          | {
              schoolId?: Id<"schools">;
              isArchived?: boolean;
              name?: string | null;
              firstName?: string | null;
              lastName?: string | null;
            }
          | null;

        if (!studentUserRecord || studentUserRecord.schoolId !== schoolId || studentUserRecord.isArchived) {
          return null;
        }

        const studentName = getReadableUserName(studentUserRecord as any);
        return {
          studentId: student._id,
          userId: student.userId,
          name: studentName.displayName || "Unnamed Student",
          admissionNumber: student.admissionNumber,
          classId: student.classId,
          className:
            classNameById.get(String(student.classId)) ??
            (selectedStudent?.classId === student.classId
              ? classNameById.get(String(student.classId)) ?? "Current class"
              : "Unknown class"),
          relationship,
          photoUrl,
          isActive: selectedStudentId
            ? String(selectedStudentId) === String(student._id)
            : false,
        };
      })
    );

    const students = normalizedStudents.filter(
      (student): student is NonNullable<typeof student> => student !== null
    );

    const activeSessions = sortNewestFirst(
      sessions.filter((session: any) => !session.isArchived)
    );
    const activeSession =
      activeSessions.find((session: any) => session.isActive) ?? activeSessions[0] ?? null;
    const activeTerms = activeSession
      ? terms.filter(
          (term: any) =>
            term.sessionId && String(term.sessionId) === String(activeSession._id)
        )
      : [];
    const activeTerm =
      activeTerms.find((term: any) => term.isActive) ??
      sortNewestFirst(activeTerms)[0] ??
      null;

    const requestedTerm =
      args.termId && args.termId !== null
        ? terms.find((term: any) => String(term._id) === String(args.termId)) ?? null
        : null;
    const requestedSession =
      args.sessionId && args.sessionId !== null
        ? sessions.find((session: any) => String(session._id) === String(args.sessionId)) ?? null
        : null;

    let selectedSession: any = requestedSession ?? activeSession;
    let selectedTerm: any = requestedTerm ?? null;

    if (selectedTerm) {
      selectedSession =
        sessions.find((session: any) => String(session._id) === String(selectedTerm.sessionId)) ??
        selectedSession;
    }

    if (!selectedTerm && selectedSession) {
      const sessionTerms = terms.filter(
        (term: any) => String(term.sessionId) === String(selectedSession._id)
      );
      selectedTerm =
        sessionTerms.find((term: any) => term.isActive) ??
        sortNewestFirst(sessionTerms)[0] ??
        null;
    }

    if (!selectedSession && selectedTerm) {
      selectedSession =
        sessions.find((session: any) => String(session._id) === String(selectedTerm?.sessionId ?? "")) ??
        null;
    }

    if (!selectedSession) {
      selectedSession = activeSession;
    }

    if (!selectedTerm) {
      selectedTerm = activeTerm;
    }

    const selectedSessionId = selectedSession ? selectedSession._id : null;
    const selectedTermId = selectedTerm ? selectedTerm._id : null;

    const selectedReportCard =
      selectedStudent && selectedSessionId && selectedTermId
        ? await tryBuildStudentReportCard(ctx, {
            userId,
            schoolId,
            role: portalRole,
            studentId: selectedStudent._id,
            sessionId: selectedSessionId,
            termId: selectedTermId,
            preferredClassId: selectedStudent.classId,
          })
        : null;

    const allTerms = terms
      .filter((term: any) => !term.isArchived)
      .sort((a: any, b: any) => {
        const sessionA = sessions.find((session: any) => String(session._id) === String(a.sessionId));
        const sessionB = sessions.find((session: any) => String(session._id) === String(b.sessionId));
        const sessionDiff = (sessionB?.startDate ?? 0) - (sessionA?.startDate ?? 0);
        if (sessionDiff !== 0) {
          return sessionDiff;
        }
        return b.startDate - a.startDate;
      });

    const historyLimit = Math.max(1, Math.min(args.historyLimit ?? 4, 12));
    const selectedHistoryTerms = allTerms.slice(0, historyLimit);
    const history = [] as Array<{
      sessionId: Id<"academicSessions">;
      termId: Id<"academicTerms">;
      sessionName: string;
      termName: string;
      classId: Id<"classes">;
      className: string;
      generatedAt: number;
      totalSubjects: number;
      recordedSubjects: number;
      pendingSubjects: number;
      averageScore: number | null;
      totalScore: number;
      resultCalculationMode: "standalone" | "cumulative_annual";
      href: string;
      note: string | null;
    }>;

    if (selectedStudent) {
      for (const term of selectedHistoryTerms) {
        const session = sessions.find((entry: any) => String(entry._id) === String(term.sessionId));
        if (!session) {
          continue;
        }

        const reportCard = await tryBuildStudentReportCard(ctx, {
          userId,
          schoolId,
          role: portalRole,
          studentId: selectedStudent._id,
          sessionId: session._id,
          termId: term._id,
          preferredClassId: selectedStudent.classId,
        });

        if (reportCard) {
          history.push({
            sessionId: session._id,
            termId: term._id,
            sessionName: reportCard.sessionName,
            termName: reportCard.termName,
            classId: reportCard.classId,
            className: reportCard.className,
            generatedAt: reportCard.generatedAt,
            totalSubjects: reportCard.summary.totalSubjects,
            recordedSubjects: reportCard.summary.recordedSubjects,
            pendingSubjects: reportCard.summary.pendingSubjects,
            averageScore: reportCard.summary.averageScore,
            totalScore: reportCard.summary.totalScore,
            resultCalculationMode: reportCard.resultCalculationMode,
            href: buildPortalHref("/report-cards", {
              studentId: String(selectedStudent._id),
              sessionId: String(session._id),
              termId: String(term._id),
            }),
            note: null,
          });
          continue;
        }

        history.push({
          sessionId: session._id,
          termId: term._id,
          sessionName: normalizeHumanName(session.name),
          termName: normalizeHumanName(term.name),
          classId: selectedStudent.classId,
          className:
            classNameById.get(String(selectedStudent.classId)) ??
            "Current class",
          generatedAt: term.startDate,
          totalSubjects: 0,
          recordedSubjects: 0,
          pendingSubjects: 0,
          averageScore: null,
          totalScore: 0,
          resultCalculationMode: "standalone",
          href: buildPortalHref("/report-cards", {
            studentId: String(selectedStudent._id),
            sessionId: String(session._id),
            termId: String(term._id),
          }),
          note: "Report card not ready yet.",
        });
      }
    }

    const notifications: Array<{
      id: string;
      title: string;
      body: string;
      tone: "info" | "success" | "warning";
      href: string | null;
    }> = [];

    if (selectedReportCard) {
      if (selectedReportCard.summary.pendingSubjects > 0) {
        notifications.push({
          id: `pending-${selectedReportCard.student._id}`,
          title: "Some subjects are still pending",
          body: `${selectedReportCard.summary.pendingSubjects} subject${
            selectedReportCard.summary.pendingSubjects === 1 ? "" : "s"
          } still need marks for ${selectedReportCard.termName}.`,
          tone: "warning",
          href: buildPortalHref("/results", {
            studentId: String(selectedStudentId),
          }),
        });
      }

      if (selectedReportCard.student.nextTermBegins) {
        notifications.push({
          id: `next-term-${selectedReportCard.student._id}`,
          title: "Next term date is available",
          body: `The next term begins on ${formatDateLabel(
            selectedReportCard.student.nextTermBegins
          )}.`,
          tone: "success",
          href: buildPortalHref("/report-cards", {
            studentId: String(selectedStudentId),
            sessionId: String(selectedSessionId ?? ""),
            termId: String(selectedTermId ?? ""),
          }),
        });
      }

      if (selectedReportCard.classTeacherComment || selectedReportCard.headTeacherComment) {
        notifications.push({
          id: `comment-${selectedReportCard.student._id}`,
          title: "A class comment is attached",
          body: "Open the report card to read the latest teacher feedback.",
          tone: "info",
          href: buildPortalHref("/report-cards", {
            studentId: String(selectedStudentId),
            sessionId: String(selectedSessionId ?? ""),
            termId: String(selectedTermId ?? ""),
          }),
        });
      }
    }

    const upcomingEvents = sortNewestFirst(
      schoolEvents.filter((event: any) => !event.isArchived && event.startDate >= Date.now())
    ).slice(0, 3);

    for (const event of upcomingEvents) {
      notifications.push({
        id: `event-${event._id}`,
        title: normalizeHumanName(event.title),
        body: `${formatDateLabel(event.startDate)}${
          event.location ? ` · ${normalizeHumanName(event.location)}` : ""
        }${event.description ? ` · ${normalizeHumanName(event.description)}` : ""}`,
        tone: "info",
        href: buildPortalHref("/notifications", {
          studentId: String(selectedStudentId ?? ""),
        }),
      });
    }

    if (notifications.length === 0) {
      notifications.push({
        id: "portal-intro",
        title: "Academic updates will appear here",
        body: "Use the report card and result history views to track performance once the school publishes results.",
        tone: "info",
        href: buildPortalHref("/report-cards", {
          studentId: String(selectedStudentId ?? ""),
        }),
      });
    }

    return {
      school: {
        id: school._id,
        name: normalizeHumanName(school.name),
        logoUrl: school.logoStorageId ? await ctx.storage.getUrl(school.logoStorageId) : null,
      },
      viewer: {
        userId,
        name: getReadableUserName(await ctx.db.get(userId)).displayName || "Portal user",
        role: portalRole,
        schoolId,
      },
      students,
      selectedStudentId,
      selectedSessionId,
      selectedTermId,
      selectedStudent: selectedStudent
        ? students.find((student) => String(student.studentId) === String(selectedStudent._id)) ?? null
        : null,
      activeSession: activeSession
        ? {
            id: activeSession._id,
            name: normalizeHumanName(activeSession.name),
          }
        : null,
      activeTerm: activeTerm
        ? {
            id: activeTerm._id,
            name: normalizeHumanName(activeTerm.name),
          }
        : null,
      selectedReportCard,
      history,
      notifications,
    };
  },
});
