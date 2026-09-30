import { getUnboundStorageUrl, isStorageOwnershipDenied } from "./academic/assetStorageBoundary";
import { ConvexError, v, type Infer } from "convex/values";
import { invoicePaymentInstructions, paymentInstructionsValidator } from "./foundation/bankInstructions";
import { isOnlineCheckoutOffered } from "./foundation/billingGate";
import type { Doc, Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { query, type QueryCtx } from "../_generated/server";
import { formatClassDisplayName, normalizeHumanName } from "@school/shared/name-format";
import { getPortalStudentAccess, resolvePortalMemberships, resolvePortalStudentContext, type PortalAuth } from "./academic/portalIdentity";
import { reportCardResultValidator } from "./academic/reportCards";
import { getReleasedGradedReport } from "./academic/resultPublication";
import { resolveAuthorizedPortalReportSelection } from "./academic/narrativeReports";
import schema from "../schema";
import { getReadableUserName } from "./academic/studentNameCompat";
import { resolveDomainSetting } from "./academic/groupSettings";

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

const portalNarrativeReportValidator = v.object({
  snapshot: schema.tables.issuedNarrativeReports.validator.fields.snapshot,
  issuedAt: v.number(),
});

const historyContext = {
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  sessionName: v.string(),
  termName: v.string(),
  classId: v.id("classes"),
  className: v.string(),
  generatedAt: v.number(),
  href: v.string(),
  note: v.union(v.string(), v.null()),
};
const portalHistoryItemValidator = v.union(v.object({
  ...historyContext,
  mode: v.literal("graded"),
  issued: v.boolean(),
  totalSubjects: v.number(),
  recordedSubjects: v.number(),
  pendingSubjects: v.number(),
  averageScore: v.union(v.number(), v.null()),
  totalScore: v.number(),
  resultCalculationMode: v.union(
    v.literal("standalone"),
    v.literal("cumulative_annual")
  ),
}), v.object({
  ...historyContext,
  mode: v.literal("narrative"),
  issued: v.boolean(),
}), v.object({
  mode: v.literal("needs_review"),
  issued: v.literal(false),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  sessionName: v.string(),
  termName: v.string(),
  generatedAt: v.number(),
  href: v.string(),
  note: v.string(),
}));

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
  selectedResultState: v.union(v.literal("released"), v.literal("withheld"), v.literal("no_eligible_record")),
  selectedReportMode: v.union(v.null(), v.literal("graded"), v.literal("narrative")),
  selectedReportNeedsReview: v.boolean(),
  selectedNarrativeReport: v.union(v.null(), portalNarrativeReportValidator),
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
    // Selection (explicit id or active-first/default-branch-first) is owned
    // by portalIdentity; the shell only narrows the return shape. Only the
    // selection miss is mapped to the shell's message; membership errors
    // propagate untouched.
    let context;
    try {
      context = await resolvePortalStudentContext(ctx, {
        studentId: args.studentId,
      });
    } catch (error) {
      if (error instanceof ConvexError && error.data === "Student record not found") {
        throw new ConvexError("Student not found");
      }
      throw error;
    }
    return { schoolId: context.schoolId, selectedStudentId: context.student._id };
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

// A release only names a student after its frozen inclusion is written.
// A second inclusion in the same term is ambiguous, even across classes.
async function releasedPortalReport(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  studentId: Id<"students">,
  sessionId: Id<"academicSessions">,
  termId: Id<"academicTerms">,
) {
  const inclusions = await ctx.db.query("classResultPublicationStudents")
    .withIndex("by_school_and_student_and_session_and_term", q => q
      .eq("schoolId", schoolId).eq("studentId", studentId)
      .eq("sessionId", sessionId).eq("termId", termId)).take(2);
  if (inclusions.length !== 1) return null;
  const inclusion = inclusions[0];
  const frozen = await getReleasedGradedReport(ctx, { schoolId, studentId, sessionId, termId, classId: inclusion.classId });
  if (!frozen || frozen._id !== inclusion.issuedReportCardId) return null;
  // A second issued class in this term makes the historical class identity
  // uncertain. This check is student-keyed, not a school-wide release scan.
  const issued = await ctx.db.query("issuedReportCards")
    .withIndex("by_student_session_term", q => q.eq("studentId", studentId).eq("sessionId", sessionId).eq("termId", termId))
    .take(2);
  if (issued.length !== 1 || issued[0]._id !== frozen._id) return null;
  const safeImage = async (id: Id<"_storage"> | undefined) => {
    if (!id) return null;
    try { return await getUnboundStorageUrl(ctx, id); }
    catch (error) { if (isStorageOwnershipDenied(error)) return null; throw error; }
  };
  return { ...frozen.report, schoolLogoUrl: await safeImage(frozen.schoolLogoStorageId),
    student: { ...frozen.report.student, photoUrl: await safeImage(frozen.studentPhotoStorageId) } };
}

// A published class does not by itself prove a student's historical class.
// Return only a score-free availability state after checking exact, indexed
// frozen evidence. Missing or conflicting evidence keeps the privacy default.
async function hasReleasedTupleWithoutEligibleRecord(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  student: Doc<"students">,
  session: Doc<"academicSessions">,
  term: Doc<"academicTerms">,
) {
  if (student.schoolId !== schoolId || student.isArchived ||
      session.schoolId !== schoolId || term.schoolId !== schoolId || term.sessionId !== session._id) return false;
  const [included, excluded] = await Promise.all([
    ctx.db.query("classResultPublicationStudents")
      .withIndex("by_school_and_student_and_session_and_term", q => q.eq("schoolId", schoolId)
        .eq("studentId", student._id).eq("sessionId", session._id).eq("termId", term._id)).take(2),
    ctx.db.query("classResultExclusions")
      .withIndex("by_school_and_student_and_session_and_term", q => q.eq("schoolId", schoolId)
        .eq("studentId", student._id).eq("sessionId", session._id).eq("termId", term._id)).take(2),
  ]);
  if (included.length || excluded.length > 1) return false;
  const exclusion = excluded[0];
  // Only an exclusion frozen before release proves historical membership.
  // Mutable current class is evidence solely for a late active-term entrant.
  if (!exclusion && ((student.enrollmentStatus && student.enrollmentStatus !== "active") ||
      !session.isActive || !term.isActive)) return false;
  const classId = exclusion?.classId ?? student.classId;
  const [klass, releases, issued] = await Promise.all([
    ctx.db.get(classId),
    ctx.db.query("classResultPublications")
      .withIndex("by_school_and_session_and_term_and_class", q => q.eq("schoolId", schoolId)
        .eq("sessionId", session._id).eq("termId", term._id).eq("classId", classId)).take(2),
    ctx.db.query("issuedReportCards")
      .withIndex("by_student_session_term", q => q.eq("studentId", student._id)
        .eq("sessionId", session._id).eq("termId", term._id)).take(2),
  ]);
  if (!klass || klass.schoolId !== schoolId || releases.length !== 1 ||
      issued.length > 1 || issued.some(row => row.schoolId !== schoolId || row.classId !== classId)) return false;
  const release = releases[0];
  if (exclusion) return release.excludedCount > 0 && exclusion.approvedAt <= release.releasedAt;
  return !klass.isArchived && student.createdAt > release.releasedAt;
}

// Only the precise enrollment ambiguity is safe to present as a review state.
// Other failures keep the existing fail-closed behavior and reveal no report.
async function resolvePortalSelectionForWorkspace(ctx: QueryCtx, args: {
  studentId: Id<"students">; sessionId: Id<"academicSessions">; termId: Id<"academicTerms">;
}) {
  try {
    return { selection: await resolveAuthorizedPortalReportSelection(ctx, args), needsReview: false };
  } catch (error) {
    return { selection: null, needsReview: error instanceof ConvexError && error.data === "Enrollment history requires review" };
  }
}

export const getWorkspaceData = query({
  args: {
    studentId: v.optional(v.union(v.id("students"), v.null())),
    sessionId: v.optional(v.union(v.id("academicSessions"), v.null())),
    termId: v.optional(v.union(v.id("academicTerms"), v.null())),
    historyLimit: v.optional(v.number()),
    now: v.optional(v.number()),
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

    // Explicit IDs use point reads. School-wide term counts do not gate a
    // student's issued card or its older history.
    const eventTime = args.now;
    if (eventTime !== undefined && (!Number.isFinite(eventTime) || eventTime < 0))
      throw new ConvexError("Invalid current time");
    const [requestedTerm, requestedSession, activeSessions, notificationSetting] = await Promise.all([
      args.termId ? ctx.db.get(args.termId) : Promise.resolve(null),
      args.sessionId ? ctx.db.get(args.sessionId) : Promise.resolve(null),
      ctx.db.query("academicSessions").withIndex("by_school_active", q => q.eq("schoolId", schoolId).eq("isActive", true)).take(2),
      resolveDomainSetting(ctx, schoolId, "notification_preferences"),
    ]);
    if ((args.termId && (!requestedTerm || requestedTerm.schoolId !== schoolId)) ||
        (args.sessionId && (!requestedSession || requestedSession.schoolId !== schoolId)) ||
        (requestedTerm && requestedSession && requestedTerm.sessionId !== requestedSession._id)) {
      throw new ConvexError("Invalid session or term");
    }
    const recentSessions = activeSessions.length ? [] : await ctx.db.query("academicSessions")
      .withIndex("by_school", q => q.eq("schoolId", schoolId)).order("desc").take(32);
    const activeSession = activeSessions.find(session => !session.isArchived) ??
      sortNewestFirst(recentSessions.filter(session => !session.isArchived))[0] ?? null;
    const selectedSession = requestedTerm
      ? await ctx.db.get(requestedTerm.sessionId)
      : requestedSession ?? activeSession;
    if (selectedSession && selectedSession.schoolId !== schoolId) throw new ConvexError("Invalid session or term");
    const sessionTerms = selectedSession && !requestedTerm
      ? await ctx.db.query("academicTerms").withIndex("by_session", q => q.eq("sessionId", selectedSession._id)).take(64)
      : [];
    const activeTerms = await ctx.db.query("academicTerms")
      .withIndex("by_school_active", q => q.eq("schoolId", schoolId).eq("isActive", true)).take(64);
    const pickTerm = (sessionId: Id<"academicSessions"> | undefined, fallback: typeof sessionTerms) =>
      activeTerms.find(term => term.sessionId === sessionId) ??
      sortNewestFirst(fallback)[0] ?? null;
    const selectedTerm = requestedTerm ?? pickTerm(selectedSession?._id, sessionTerms);
    const activeSessionTerms = activeSession && (requestedTerm || activeSession._id !== selectedSession?._id)
      ? await ctx.db.query("academicTerms").withIndex("by_session", q => q.eq("sessionId", activeSession._id)).take(64)
      : sessionTerms;
    const activeTerm = pickTerm(activeSession?._id, activeSessionTerms);
    const selectedSessionId = selectedSession?._id ?? null;
    const selectedTermId = selectedTerm?._id ?? null;
    const notificationPreferences =
      notificationSetting.value ?? {
        showReportUpdates: true,
        showTeacherComments: true,
        showUpcomingEvents: true,
      };

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

        if (
          !studentUserRecord ||
          studentUserRecord.schoolId !== student.schoolId ||
          (studentUserRecord.isArchived && student.enrollmentStatus === "active")
        ) {
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

    // The reporting family is selected before reading a graded payload. A
    // narrative period without an issued snapshot cannot borrow a graded card.
    const selectedResolution = selectedStudent && selectedSessionId && selectedTermId
      ? await resolvePortalSelectionForWorkspace(ctx, {
          studentId: selectedStudent._id, sessionId: selectedSessionId, termId: selectedTermId,
        })
      : { selection: null, needsReview: false };
    const selectedSelection = selectedResolution.selection;
    const selectedReportMode = selectedSelection?.mode ?? null;
    const selectedNarrativeReport = selectedSelection?.mode === "narrative" && selectedSelection.issued
      ? { snapshot: selectedSelection.issued.snapshot, issuedAt: selectedSelection.issued.issuedAt }
      : null;
    const selectedReportCard = selectedStudent && selectedSessionId && selectedTermId && selectedReportMode === "graded"
      ? await releasedPortalReport(ctx, schoolId, selectedStudent._id, selectedSessionId, selectedTermId)
      : null;
    const noEligibleRecord = selectedReportMode === "graded" && !selectedReportCard && selectedStudent && selectedSession && selectedTerm
      ? await hasReleasedTupleWithoutEligibleRecord(ctx, schoolId, selectedStudent, selectedSession, selectedTerm)
      : false;
    const selectedResultState = selectedReportCard || selectedNarrativeReport ? "released" as const
      : noEligibleRecord || !selectedStudent || !selectedSessionId || !selectedTermId
        ? "no_eligible_record" as const : "withheld" as const;

    const historyLimit = Number.isFinite(args.historyLimit) ? Math.max(1, Math.min(Math.floor(args.historyLimit!), 12)) : 4;
    // Scan a bounded window of issued narrative snapshots and released graded
    // inclusions. Neither live scores nor unreleased graded issues enter history.
    const history: Array<Infer<typeof portalHistoryItemValidator>> = [];
    if (selectedStudent) {
      const [inclusions, narrativeIssues] = await Promise.all([
        ctx.db.query("classResultPublicationStudents")
          .withIndex("by_school_and_student_and_released_at", q => q
            .eq("schoolId", schoolId).eq("studentId", selectedStudent._id))
          .order("desc").take(48),
        ctx.db.query("issuedNarrativeReports")
          .withIndex("by_studentId_and_sessionId_and_termId", q => q.eq("studentId", selectedStudent._id))
          .order("desc").take(48),
      ]);
      const tuples = new Map<string, { sessionId: Id<"academicSessions">; termId: Id<"academicTerms">; at: number }>();
      for (const row of inclusions) tuples.set(`${row.sessionId}:${row.termId}`, { sessionId: row.sessionId, termId: row.termId, at: row.releasedAt });
      for (const row of narrativeIssues) if (row.schoolId === schoolId) {
        const key = `${row.sessionId}:${row.termId}`;
        if (!tuples.has(key)) tuples.set(key, { sessionId: row.sessionId, termId: row.termId, at: row.issuedAt });
      }
      for (const tuple of [...tuples.values()].sort((a, b) => b.at - a.at)) {
        if (history.length >= historyLimit) break;
        const resolution = await resolvePortalSelectionForWorkspace(ctx, {
          studentId: selectedStudent._id, sessionId: tuple.sessionId, termId: tuple.termId,
        });
        const selection = resolution.selection;
        if (!selection || resolution.needsReview) continue;
        const href = buildPortalHref("/report-cards", {
          studentId: String(selectedStudent._id), sessionId: String(tuple.sessionId), termId: String(tuple.termId),
        });
        if (selection.mode === "narrative") {
          if (!selection.issued || selection.issued.schoolId !== schoolId) continue;
          const snapshot = selection.issued.snapshot;
          history.push({ mode: "narrative", issued: true, sessionId: tuple.sessionId, termId: tuple.termId,
            sessionName: snapshot.sessionName, termName: snapshot.termName, classId: selection.classId,
            className: snapshot.className, generatedAt: selection.issued.issuedAt, href, note: null });
          continue;
        }
        const reportCard = selectedSessionId === tuple.sessionId && selectedTermId === tuple.termId
          ? selectedReportCard
          : await releasedPortalReport(ctx, schoolId, selectedStudent._id, tuple.sessionId, tuple.termId);
        if (!reportCard || reportCard.classId !== selection.classId) continue;
        history.push({ mode: "graded", issued: true, sessionId: tuple.sessionId, termId: tuple.termId,
          sessionName: reportCard.sessionName, termName: reportCard.termName,
          classId: reportCard.classId, className: reportCard.className, generatedAt: reportCard.generatedAt,
          totalSubjects: reportCard.summary.totalSubjects, recordedSubjects: reportCard.summary.recordedSubjects,
          pendingSubjects: reportCard.summary.pendingSubjects, averageScore: reportCard.summary.averageScore,
          totalScore: reportCard.summary.totalScore, resultCalculationMode: reportCard.resultCalculationMode,
          href, note: null });
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
      if (
        notificationPreferences.showReportUpdates &&
        selectedReportCard.student.nextTermBegins
      ) {
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

      if (
        notificationPreferences.showTeacherComments &&
        (selectedReportCard.classTeacherComment || selectedReportCard.headTeacherComment)
      ) {
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

    const upcomingEvents: Doc<"schoolEvents">[] = [];
    // Without a client clock, legacy bundles omit time-based notices. Iterate
    // in start-date order so archived rows cannot consume the three live slots.
    // Stop after 512 indexed rows to bound the workspace read transaction.
    if (notificationPreferences.showUpcomingEvents && eventTime !== undefined) {
      let scanned = 0;
      const futureEvents = ctx.db.query("schoolEvents")
        .withIndex("by_school_and_start", q => q.eq("schoolId", schoolId).gte("startDate", eventTime))
        .order("asc");
      for await (const event of futureEvents) {
        scanned++;
        if (!event.isArchived) upcomingEvents.push(event);
        if (upcomingEvents.length === 3 || scanned === 512) break;
      }
    }

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
        href: null,
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
      selectedResultState,
      selectedReportMode,
      selectedReportNeedsReview: selectedResolution.needsReview,
      selectedNarrativeReport,
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
        canPayOnline: isOnlineCheckoutOffered({
          allowOnlinePayments: Boolean(settingsRecord?.allowOnlinePayments),
          invoice: { balanceDue: invoice.balanceDue, status: invoice.status },
        }),
        lineItems: invoice.lineItems,
        notes: invoice.notes ?? null,
      }));

    const summarizeInvoices = (entries: any[]) => ({
      invoiceCount: entries.length,
      totalInvoiced: entries.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      totalPaid: entries.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstandingBalance: entries
        .filter((invoice) => invoice.status !== "cancelled")
        .reduce((sum, invoice) => sum + invoice.balanceDue, 0),
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
