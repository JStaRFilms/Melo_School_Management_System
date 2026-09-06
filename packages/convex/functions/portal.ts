import { getUnboundStorageUrl } from "./academic/assetStorageBoundary";
import { ConvexError, v } from "convex/values";
import { invoicePaymentInstructions, paymentInstructionsValidator } from "./foundation/bankInstructions";
import type { Doc, Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { query, type QueryCtx } from "../_generated/server";
import { formatClassDisplayName, normalizeHumanName } from "@school/shared/name-format";
import { getPortalStudentAccess, resolvePortalMemberships, type PortalAuth } from "./academic/portalIdentity";
import { buildStudentReportCard, reportCardResultValidator } from "./academic/reportCards";
import { getReadableUserName } from "./academic/studentNameCompat";

const portalStudentValidator = v.object({
  studentId: v.id("students"),
  userId: v.id("users"),
  name: v.string(),
  admissionNumber: v.string(),
  classId: v.id("classes"),
  className: v.string(),
  schoolId: v.id("schools"),
  schoolName: v.string(),
  schoolLogoUrl: v.union(v.string(), v.null()),
  relationship: v.union(v.string(), v.null()),
  photoUrl: v.union(v.string(), v.null()),
  isActive: v.boolean(),
  enrollmentState: v.union(v.literal("active"), v.literal("historical")),
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

const portalBillingInvoiceValidator = v.object({
  paymentInstructions: v.union(paymentInstructionsValidator, v.null()),
  invoiceId: v.id("studentInvoices"),
  studentId: v.id("students"),
  invoiceNumber: v.string(),
  feePlanName: v.string(),
  currency: v.string(),
  totalAmount: v.number(),
  amountPaid: v.number(),
  balanceDue: v.number(),
  dueDate: v.number(),
  issuedAt: v.number(),
  status: v.union(
    v.literal("draft"),
    v.literal("issued"),
    v.literal("partially_paid"),
    v.literal("paid"),
    v.literal("overdue"),
    v.literal("waived"),
    v.literal("cancelled")
  ),
  canPayOnline: v.boolean(),
  lineItems: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      amount: v.number(),
      category: v.string(),
      order: v.number(),
    })
  ),
  notes: v.union(v.string(), v.null()),
});

const portalBillingPaymentValidator = v.object({
  paymentId: v.id("billingPayments"),
  invoiceId: v.id("studentInvoices"),
  invoiceNumber: v.string(),
  reference: v.string(),
  gatewayReference: v.union(v.string(), v.null()),
  provider: v.union(v.string(), v.null()),
  paymentMethod: v.string(),
  amountApplied: v.number(),
  amountReceived: v.number(),
  status: v.string(),
  reconciliationStatus: v.string(),
  receivedAt: v.number(),
  notes: v.union(v.string(), v.null()),
});

export const portalBillingDataValidator = v.object({
  selectedStudentId: v.union(v.id("students"), v.null()),
  school: v.object({
    id: v.id("schools"),
    name: v.string(),
  }),
  settings: v.object({
    allowOnlinePayments: v.boolean(),
    preferredProvider: v.union(v.string(), v.null()),
    defaultCurrency: v.string(),
  }),
  householdSummary: v.object({
    studentCount: v.number(),
    invoiceCount: v.number(),
    totalInvoiced: v.number(),
    totalPaid: v.number(),
    outstandingBalance: v.number(),
  }),
  studentSummary: v.object({
    invoiceCount: v.number(),
    totalInvoiced: v.number(),
    totalPaid: v.number(),
    outstandingBalance: v.number(),
  }),
  invoices: v.array(portalBillingInvoiceValidator),
  payments: v.array(portalBillingPaymentValidator),
});

export const portalInvoicePaymentContextValidator = v.object({
  schoolId: v.id("schools"),
  invoiceId: v.id("studentInvoices"),
  payerEmail: v.string(),
  payerName: v.string(),
});

export const portalWorkspaceDataValidator = v.object({
  school: v.object({
    id: v.id("schools"),
    name: v.string(),
    logoUrl: v.union(v.string(), v.null()),
    theme: v.object({
      primaryColor: v.string(),
      accentColor: v.string(),
    }),
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

export const getPortalShellContext = query({
  args: { studentId: v.optional(v.union(v.id("students"), v.null())) },
  returns: v.object({ schoolId: v.id("schools"), selectedStudentId: v.id("students") }),
  handler: async (ctx, args) => {
    const portalAuth = await resolvePortalMemberships(ctx);
    const students = await getAccessibleStudentsAcrossPortalMemberships(ctx, portalAuth);
    const selected = args.studentId
      ? students.find((entry) => entry.student._id === args.studentId)
      : students[0];
    if (!selected) throw new ConvexError("Student not found");
    return { schoolId: selected.student.schoolId, selectedStudentId: selected.student._id };
  },
});

export const canAccessPortal = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    try {
      const portalAuth = await resolvePortalMemberships(ctx);
      return (await getAccessibleStudentsAcrossPortalMemberships(ctx, portalAuth)).length > 0;
    } catch {
      return false;
    }
  },
});

async function getAccessibleStudentsAcrossPortalMemberships(ctx: QueryCtx, portalAuth: PortalAuth) {
  const access = await getPortalStudentAccess(ctx, portalAuth);
  const entries = [];
  for (const entry of access) {
    const school = await ctx.db.get(entry.student.schoolId);
    if (!school) continue;
    const classDoc = await ctx.db.get(entry.student.classId);
    const className = classDoc && classDoc.schoolId === school._id && !classDoc.isArchived
      ? formatClassDisplayName({
          gradeName: classDoc.gradeName,
          classLabel: classDoc.classLabel,
          name: classDoc.name,
        })
      : "Current class";
    entries.push({
      ...entry,
      school,
      schoolLogoUrl: school.logoStorageId ? await getUnboundStorageUrl(ctx, school.logoStorageId) : null,
      className,
    });
  }
  return entries;
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
    const portalAuth = await resolvePortalMemberships(ctx);
    const studentRows = await getAccessibleStudentsAcrossPortalMemberships(ctx, portalAuth);
    const selectedStudentRow =
      args.studentId === undefined || args.studentId === null
        ? studentRows[0] ?? null
        : studentRows.find((entry) => String(entry.student._id) === String(args.studentId)) ?? null;

    if (
      (args.studentId !== undefined && args.studentId !== null) &&
      !selectedStudentRow
    ) {
      throw new ConvexError("Student not found");
    }

    const fallbackMembership = portalAuth.memberships.find(entry => entry.isDefaultBranch) ?? portalAuth.memberships[0];
    const selectedMembership = selectedStudentRow?.portalMembership ?? fallbackMembership;
    const portalRole = selectedMembership.role;
    const userId = selectedMembership.user._id;
    const schoolId = selectedStudentRow?.student.schoolId ?? selectedMembership.user.schoolId;
    const school = selectedStudentRow?.school ?? (await ctx.db.get(schoolId));
    if (!school) {
      throw new ConvexError("School not found");
    }

    const [sessions, terms, schoolEvents] = await Promise.all([
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

    const selectedStudent = selectedStudentRow
      ? selectedStudentRow.student
      : null;
    const selectedStudentId = selectedStudent ? selectedStudent._id : null;

    const normalizedStudents = await Promise.all(
      studentRows.map(async ({ student, relationship, school: studentSchool, schoolLogoUrl, className }) => {
        const [studentUser, photoUrl] = await Promise.all([
          ctx.db.get(student.userId),
          student.photoStorageId ? getUnboundStorageUrl(ctx, student.photoStorageId) : null,
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

        if (!studentUserRecord || studentUserRecord.schoolId !== student.schoolId || studentUserRecord.isArchived) {
          return null;
        }

        const studentName = getReadableUserName(studentUserRecord as any);
        return {
          studentId: student._id,
          userId: student.userId,
          name: studentName.displayName || "Unnamed Student",
          admissionNumber: student.admissionNumber,
          classId: student.classId,
          className,
          schoolId: student.schoolId,
          schoolName: normalizeHumanName(studentSchool.name),
          schoolLogoUrl,
          relationship,
          photoUrl,
          isActive: selectedStudentId
            ? String(selectedStudentId) === String(student._id)
            : false,
          enrollmentState: student.enrollmentStatus === "active" ? "active" as const : "historical" as const,
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
          className: selectedStudentRow?.className ?? "Current class",
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
        logoUrl: school.logoStorageId ? await getUnboundStorageUrl(ctx, school.logoStorageId) : null,
        theme: {
          primaryColor: "#020617",
          accentColor: "#2563eb",
        },
      },
      viewer: {
        userId,
        name: getReadableUserName(selectedMembership.user).displayName || "Portal user",
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

export const getBillingData = query({
  args: {
    studentId: v.optional(v.union(v.id("students"), v.null())),
  },
  returns: portalBillingDataValidator,
  handler: async (ctx, args) => {
    const portalAuth = await resolvePortalMemberships(ctx);
    const accessibleStudentRows = await getAccessibleStudentsAcrossPortalMemberships(ctx, portalAuth);
    const selectedStudentRow =
      args.studentId === undefined || args.studentId === null
        ? accessibleStudentRows[0] ?? null
        : accessibleStudentRows.find(
            (entry) => String(entry.student._id) === String(args.studentId)
          ) ?? null;

    if (
      args.studentId !== undefined &&
      args.studentId !== null &&
      !selectedStudentRow
    ) {
      throw new ConvexError("Student not found");
    }

    const fallbackMembership = portalAuth.memberships.find(entry => entry.isDefaultBranch) ?? portalAuth.memberships[0];
    const schoolId = selectedStudentRow?.student.schoolId ?? fallbackMembership.user.schoolId;
    const school = selectedStudentRow?.school ?? (await ctx.db.get(schoolId));
    if (!school) {
      throw new ConvexError("School not found");
    }

    const settingsRecord = await ctx.db
      .query("schoolBillingSettings")
      .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
      .unique();

    const householdInvoices = (
      await Promise.all(
        accessibleStudentRows.map(({ student }) =>
          ctx.db
            .query("studentInvoices")
            .withIndex("by_student", (q: any) => q.eq("studentId", student._id))
            .collect()
        )
      )
    )
      .flat()
      .filter((invoice: any) => String(invoice.schoolId) === String(schoolId));

    const selectedStudentId = selectedStudentRow?.student._id ?? null;
    const selectedAccessibleStudentIds = new Set(
      accessibleStudentRows.map((entry) => String(entry.student._id))
    );
    const filteredHouseholdInvoices = householdInvoices.filter((invoice: any) =>
      selectedAccessibleStudentIds.has(String(invoice.studentId))
    );
    const selectedStudentInvoices = selectedStudentId
      ? filteredHouseholdInvoices.filter(
          (invoice: any) => String(invoice.studentId) === String(selectedStudentId)
        )
      : [];

    const invoicePaymentGroups = await Promise.all(
      selectedStudentInvoices.map(async (invoice: any) => {
        const invoicePayments = await ctx.db
          .query("billingPayments")
          .withIndex("by_invoice", (q: any) => q.eq("invoiceId", invoice._id))
          .collect();

        return invoicePayments.map((payment: any) => ({ invoice, payment }));
      })
    );

    const payments = invoicePaymentGroups
      .flat()
      .sort((left: any, right: any) => right.payment.receivedAt - left.payment.receivedAt)
      .map(({ invoice, payment }: any) => ({
        paymentId: payment._id,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        reference: payment.reference,
        gatewayReference: payment.gatewayReference ?? null,
        provider: payment.provider ?? null,
        paymentMethod: payment.paymentMethod,
        amountApplied: payment.amountApplied,
        amountReceived: payment.amountReceived,
        status: payment.status,
        reconciliationStatus: payment.reconciliationStatus,
        receivedAt: payment.receivedAt,
        notes: payment.notes ?? null,
      }));

    const invoices = [...selectedStudentInvoices]
      .sort((left: any, right: any) => right.issuedAt - left.issuedAt)
      .map((invoice: any) => ({
        invoiceId: invoice._id,
        paymentInstructions: invoicePaymentInstructions(invoice),
        studentId: invoice.studentId,
        invoiceNumber: invoice.invoiceNumber,
        feePlanName: invoice.feePlanNameSnapshot,
        currency: invoice.currency,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        dueDate: invoice.dueDate,
        issuedAt: invoice.issuedAt,
        status: invoice.status,
        canPayOnline:
          Boolean(settingsRecord?.allowOnlinePayments) &&
          invoice.balanceDue > 0 &&
          invoice.status !== "paid" &&
          invoice.status !== "waived" &&
          invoice.status !== "cancelled",
        lineItems: invoice.lineItems,
        notes: invoice.notes ?? null,
      }));

    const summarizeInvoices = (entries: any[]) => ({
      invoiceCount: entries.length,
      totalInvoiced: entries.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      totalPaid: entries.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstandingBalance: entries.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    });

    return {
      selectedStudentId,
      school: {
        id: school._id,
        name: school.name,
      },
      settings: {
        allowOnlinePayments: Boolean(settingsRecord?.allowOnlinePayments),
        preferredProvider: settingsRecord?.preferredProvider ?? null,
        defaultCurrency: settingsRecord?.defaultCurrency ?? "NGN",
      },
      householdSummary: {
        studentCount: accessibleStudentRows.length,
        ...summarizeInvoices(filteredHouseholdInvoices),
      },
      studentSummary: summarizeInvoices(selectedStudentInvoices),
      invoices,
      payments,
    };
  },
});

export const resolvePortalInvoicePaymentContext = query({
  args: {
    invoiceId: v.id("studentInvoices"),
  },
  returns: portalInvoicePaymentContextValidator,
  handler: async (ctx, args) => {
    const portalAuth = await resolvePortalMemberships(ctx);

    const [invoice, accessibleStudentRows] = await Promise.all([
      ctx.db.get(args.invoiceId),
      getAccessibleStudentsAcrossPortalMemberships(ctx, portalAuth),
    ]);

    if (!invoice) {
      throw new ConvexError("Invoice not found");
    }

    const accessibleStudent = accessibleStudentRows.find(entry => entry.student._id === invoice.studentId);
    if (!accessibleStudent) throw new ConvexError("Invoice not found");

    const portalUserRecord = accessibleStudent.portalMembership.user;
    const payerEmail =
      typeof portalUserRecord?.email === "string" ? portalUserRecord.email.trim().toLowerCase() : "";
    const payerName = normalizeHumanName(
      getReadableUserName(portalUserRecord ?? { name: "Portal payer" }).displayName ||
        portalUserRecord?.name ||
        "Portal payer"
    );

    if (!payerEmail) {
      throw new ConvexError("A valid email address is required before online payment can start");
    }

    return {
      schoolId: invoice.schoolId,
      invoiceId: invoice._id,
      payerEmail,
      payerName,
    };
  },
});
