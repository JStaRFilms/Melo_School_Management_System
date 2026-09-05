import { getUnboundStorageUrl } from "./assetStorageBoundary";
import { reportCardReviewKey } from "@school/shared/exam-recording";
import { reportCardResultValidator } from "../foundation/reportCardContract";
export { reportCardResultValidator } from "../foundation/reportCardContract";
import { resolveEffectiveGradingBands } from "./gradingBands";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import { mutation, query, type QueryCtx, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { v, ConvexError, type Infer } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
  teacherHasClassAccess,
} from "./auth";
import {
  formatClassDisplayName,
  normalizeHumanName,
} from "@school/shared/name-format";
import {
  deriveAggregatedSubjectResult,
} from "@school/shared/subject-aggregation";
import type { GradingBand } from "@school/shared/exam-recording";
import {
  deriveCumulativeAnnualResult,
  isCumulativeAnnualMode,
  type CumulativeTermKey,
  type CumulativeTermTotals,
  type ReportCardCalculationMode,
} from "@school/shared";
import { getReadableUserName } from "./studentNameCompat";
import { buildExtrasCollectionView } from "./reportCardExtrasModel";
import {
  assertNextTermBeginsFitsAdjacentTerm,
  resolveAdjacentNextTermInSession,
  resolveEffectiveReportCardTermSettings,
} from "./reportCardTermSettings";
import { listActiveClassSubjectAggregations } from "./subjectAggregationHelpers";
import {
  deriveEffectiveSubjectSelectionIds,
  listStudentAggregationOptOuts,
} from "./subjectAggregationSelectionHelpers";

const DEFAULT_CA_MAX = 20;
const DEFAULT_EXAM_MAX = 40;
const MAX_COMMENT_LENGTH = 1000;

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

function normalizeOptionalComment(value: string | null | undefined) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new ConvexError(
      `Comments cannot be longer than ${MAX_COMMENT_LENGTH} characters`
    );
  }
  return trimmed;
}

function pickMostRecentDoc<T extends { updatedAt?: number; createdAt?: number }>(
  docs: T[]
) {
  return docs.reduce<T | null>((latest, doc) => {
    if (latest === null) {
      return doc;
    }

    const latestTimestamp = latest.updatedAt ?? latest.createdAt ?? 0;
    const docTimestamp = doc.updatedAt ?? doc.createdAt ?? 0;
    return docTimestamp > latestTimestamp ? doc : latest;
  }, null);
}

function getTermOrderForSession(
  terms: Array<{ _id: Id<"academicTerms">; startDate: number }>,
  termId: Id<"academicTerms">
) {
  return [...terms]
    .sort((a, b) => a.startDate - b.startDate)
    .findIndex((term) => String(term._id) === String(termId));
}

function resolveHistoricalSnapshot(
  historicalTotals: Array<{
    termId: Id<"academicTerms">;
    classId: Id<"classes">;
    subjectId: Id<"subjects">;
    total: number;
    updatedAt: number;
    createdAt: number;
  }>,
  termId: Id<"academicTerms">,
  subjectId: Id<"subjects">,
  classId: Id<"classes">
) {
  const matching = historicalTotals.filter(
    (doc) =>
      String(doc.termId) === String(termId) &&
      String(doc.subjectId) === String(subjectId) &&
      String(doc.classId) === String(classId)
  );

  const latest = pickMostRecentDoc(matching);
  return latest?.total ?? null;
}

function buildCumulativeResult(args: {
  subject: {
    _id: Id<"subjects">;
    name: string;
    code: string;
  };
  currentRecord: {
    ca1: number;
    ca2: number;
    ca3: number;
    examScaledScore: number;
    total: number;
    gradeLetter: string;
    remark: string;
  } | null;
  firstTermTotal: number | null;
  secondTermTotal: number | null;
  gradingBands: GradingBand[];
  manualAdjustment?: {
    includedTerms: CumulativeTermKey[];
    finalTotalOverride?: number;
  } | null;
}) {
  const currentBase = args.currentRecord
    ? buildRecordedResult(args.subject, args.currentRecord)
    : buildPendingResult(args.subject);

  const totals: CumulativeTermTotals = {
    first: args.firstTermTotal,
    second: args.secondTermTotal,
    current: args.currentRecord?.total ?? null,
  };
  const cumulative = deriveCumulativeAnnualResult({
    totals,
    gradingBands: args.gradingBands,
    ...(args.manualAdjustment
      ? {
          includedTerms: args.manualAdjustment.includedTerms,
          finalTotalOverride:
            args.manualAdjustment.finalTotalOverride ?? null,
        }
      : {}),
  });

  return {
    ...currentBase,
    calculationMode: "cumulative_annual" as const,
    currentTermTotal: args.currentRecord?.total ?? null,
    firstTermTotal: args.firstTermTotal,
    secondTermTotal: args.secondTermTotal,
    annualAverage: cumulative.annualAverage,
    isCumulativeComplete: cumulative.isComplete,
    missingHistoricalTerms: cumulative.missingTerms,
    manualAdjustment: args.manualAdjustment
      ? {
          includedTerms: args.manualAdjustment.includedTerms,
          divisor: cumulative.divisor,
          computedAverage: cumulative.computedAverage,
          finalTotalOverride:
            args.manualAdjustment.finalTotalOverride ?? null,
        }
      : null,
    total: cumulative.annualAverage ?? currentBase.total,
    gradeLetter: cumulative.gradeLetter ?? currentBase.gradeLetter,
    remark: cumulative.remark ?? currentBase.remark,
    isRecorded: cumulative.isComplete ? true : currentBase.isRecorded,
  };
}

const reportCardBatchStudentValidator = v.object({
  studentId: v.id("students"),
  studentName: v.string(),
  admissionNumber: v.string(),
  passportUrl: v.optional(v.union(v.string(), v.null())),
});


function buildPendingResult(subject: {
  _id: Id<"subjects">;
  name: string;
  code: string;
}) {
  return {
    subjectId: subject._id,
    subjectName: normalizeHumanName(subject.name),
    subjectCode: subject.code,
    ca1: 0,
    ca2: 0,
    ca3: 0,
    examScore: 0,
    total: 0,
    gradeLetter: "-",
    remark: "Pending",
    isRecorded: false,
    calculationMode: "standalone" as const,
    currentTermTotal: null,
    firstTermTotal: null,
    secondTermTotal: null,
    annualAverage: null,
    isCumulativeComplete: false,
    missingHistoricalTerms: ["current"] as Array<"first" | "second" | "current">,
    manualAdjustment: null,
  };
}

function buildRecordedResult(subject: {
  _id: Id<"subjects">;
  name: string;
  code: string;
}, record: {
  ca1: number;
  ca2: number;
  ca3: number;
  examScaledScore: number;
  total: number;
  gradeLetter: string;
  remark: string;
}) {
  return {
    subjectId: subject._id,
    subjectName: normalizeHumanName(subject.name),
    subjectCode: subject.code,
    ca1: record.ca1,
    ca2: record.ca2,
    ca3: record.ca3,
    examScore: record.examScaledScore,
    total: record.total,
    gradeLetter: record.gradeLetter,
    remark: record.remark,
    isRecorded: true,
    calculationMode: "standalone" as const,
    currentTermTotal: record.total,
    firstTermTotal: null,
    secondTermTotal: null,
    annualAverage: null,
    isCumulativeComplete: false,
    missingHistoricalTerms: [],
    manualAdjustment: null,
  };
}

async function assertClassReportCardAccess(
  ctx: any,
  args: {
    userId: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
  }
) {
  const [classDoc, session, term] = await Promise.all([
    ctx.db.get(args.classId),
    ctx.db.get(args.sessionId),
    ctx.db.get(args.termId),
  ]);

  if (!classDoc || classDoc.schoolId !== args.schoolId) {
    throw new ConvexError("Class not found");
  }
  if (!session || session.schoolId !== args.schoolId) {
    throw new ConvexError("Session not found");
  }
  if (
    !term ||
    term.schoolId !== args.schoolId ||
    term.sessionId !== args.sessionId
  ) {
    throw new ConvexError("Term not found");
  }

  if (args.role === "teacher") {
    const hasClassAccess = await teacherHasClassAccess(
      ctx,
      args.userId,
      args.schoolId,
      args.classId
    );
    if (!hasClassAccess) {
      throw new ConvexError("Not assigned to this class");
    }
    return;
  }

  await assertAdminForSchool(ctx, args.userId, args.schoolId, args.role);
}

async function getStudentsForClassReportCardBatch(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
  }
) {
  const [sessionDoc, currentStudents, selectionDocs, sessionRecords] = await Promise.all([
    ctx.db.get(args.sessionId),
    ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("classId", args.classId)
      )
      .collect(),
    ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_class_and_session", (q: any) =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId)
      )
      .collect(),
    ctx.db
      .query("assessmentRecords")
      .withIndex("by_sheet", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("sessionId", args.sessionId).eq("termId", args.termId).eq("classId", args.classId)
      )
      .collect(),
  ]);

  const studentIds = new Set<string>();
  if (sessionDoc?.isActive) {
    for (const student of currentStudents) {
      studentIds.add(String(student._id));
    }
  }
  for (const selection of selectionDocs) {
    studentIds.add(String(selection.studentId));
  }
  for (const record of sessionRecords) {
    studentIds.add(String(record.studentId));
  }

  const students = (
    await Promise.all(
      Array.from(studentIds).map(async (studentId) =>
        ctx.db.get(studentId as Id<"students">)
      )
    )
  ).filter(
    (
      student
    ): student is Exclude<typeof student, null> =>
      student !== null &&
      student.schoolId === args.schoolId &&
      !student.isArchived
  );

  const roster = (
    await Promise.all(
      students.map(async (student) => {
        const studentUser = await ctx.db.get(student.userId);
        if (
          !studentUser ||
          studentUser.schoolId !== args.schoolId ||
          studentUser.isArchived
        ) {
          return null;
        }

        const studentName = getReadableUserName(studentUser);
        const passportUrl = student.photoStorageId
          ? await getUnboundStorageUrl(ctx, student.photoStorageId)
          : null;
        return {
          studentId: student._id,
          studentName: studentName.displayName || "Unnamed Student",
          admissionNumber: student.admissionNumber,
          passportUrl,
        };
      })
    )
  ).filter(
    (
      student
    ): student is Exclude<typeof student, null> => student !== null
  );

  return roster.sort((a, b) => {
    const byName = a.studentName.localeCompare(b.studentName);
    if (byName !== 0) return byName;
    return a.admissionNumber.localeCompare(b.admissionNumber);
  });
}

export async function buildStudentReportCard(
  ctx: any,
  args: {
    userId: Id<"users">;
    schoolId: Id<"schools">;
    role: string;
    studentId: Id<"students">;
    sessionId: Id<"academicSessions">;
    termId: Id<"academicTerms">;
    preferredClassId?: Id<"classes">;
    skipRoleCheck?: boolean;
  }
): Promise<Infer<typeof reportCardResultValidator>> {
  const [student, session, term, school] = await Promise.all([
    ctx.db.get(args.studentId),
    ctx.db.get(args.sessionId),
    ctx.db.get(args.termId),
    ctx.db.get(args.schoolId),
  ]);

  if (!student || student.schoolId !== args.schoolId) {
    throw new ConvexError("Student not found");
  }
  if (!session || session.schoolId !== args.schoolId) {
    throw new ConvexError("Session not found");
  }
  if (!term || term.schoolId !== args.schoolId || term.sessionId !== args.sessionId) {
    throw new ConvexError("Term not found");
  }
  if (!school) {
    throw new ConvexError("School not found");
  }

  const allSessionRecords = await ctx.db
    .query("assessmentRecords")
    .withIndex("by_student_and_session", (q: any) =>
      q
        .eq("schoolId", args.schoolId)
        .eq("studentId", args.studentId)
        .eq("sessionId", args.sessionId)
    )
    .collect();
  const termRecords = allSessionRecords.filter(
    (record: any) => String(record.termId) === String(args.termId)
  );
  const sessionSelectionDocs = await ctx.db
    .query("studentSubjectSelections")
    .withIndex("by_student_and_session", (q: any) =>
      q.eq("studentId", args.studentId).eq("sessionId", args.sessionId)
    )
    .collect();
  const selectionClassIds = [
    ...new Set(sessionSelectionDocs.map((selection: any) => String(selection.classId))),
  ];

  const preferredClassId = args.preferredClassId;
  const recordsForPreferredClass = preferredClassId
    ? termRecords.filter((record: any) => String(record.classId) === String(preferredClassId))
    : [];
  const selectionsForPreferredClass = preferredClassId
    ? sessionSelectionDocs.filter((selection: any) => String(selection.classId) === String(preferredClassId))
    : [];
  if (
    preferredClassId &&
    (!session.isActive || String(student.classId) !== String(preferredClassId)) &&
    recordsForPreferredClass.length === 0 &&
    selectionsForPreferredClass.length === 0
  ) {
    throw new ConvexError("Student has no report-card history in this class");
  }

  const latestTermRecord = [...termRecords].sort(
    (a: any, b: any) =>
      (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
  )[0];
  const currentClassTermRecord = termRecords.find(
    (record: any) => String(record.classId) === String(student.classId)
  );
  const reportCardClassId =
    preferredClassId ??
    (currentClassTermRecord?.classId ??
      latestTermRecord?.classId ??
      (selectionClassIds.length === 1
        ? (selectionClassIds[0] as Id<"classes">)
        : undefined) ??
      student.classId);
  const records = preferredClassId ? recordsForPreferredClass : termRecords.filter(
    (record: any) => String(record.classId) === String(reportCardClassId)
  );

  if (!args.skipRoleCheck) {
    if (args.role === "teacher") {
      const hasClassAccess = await teacherHasClassAccess(
        ctx,
        args.userId,
        args.schoolId,
        reportCardClassId
      );
      if (!hasClassAccess) {
        throw new ConvexError("Not assigned to this class");
      }
    } else {
      await assertAdminForSchool(ctx, args.userId, args.schoolId, args.role);
    }
  }

  const issued = await getIssuedReport(
    ctx, args.studentId, args.sessionId, args.termId, reportCardClassId
  );
  if (issued) return {
    ...issued.report,
    schoolLogoUrl: issued.schoolLogoStorageId
      ? await getUnboundStorageUrl(ctx, issued.schoolLogoStorageId)
      : issued.report.schoolLogoUrl,
    student: {
      ...issued.report.student,
      photoUrl: issued.studentPhotoStorageId
        ? await getUnboundStorageUrl(ctx, issued.studentPhotoStorageId)
        : issued.report.student.photoUrl,
    },
  };
  // Old output without an issued policy must not borrow today's thresholds.
  const historicalWithoutPolicy =
    !session.isActive || !term.isActive || term.endDate < Date.now();

  const [
    studentUser,
    classDoc,
    photoUrl,
    schoolLogoUrl,
    classSubjectDocs,
    settings,
    gradingBands,
    reportCardComment,
    extrasView,
    effectiveTermSettings,
    aggregations,
    aggregationOptOuts,
    sessionTerms,
    historicalTermTotals,
    manualAdjustments,
  ] = await Promise.all([
    ctx.db.get(student.userId),
    ctx.db.get(reportCardClassId),
    student.photoStorageId ? getUnboundStorageUrl(ctx, student.photoStorageId) : null,
    school.logoStorageId ? getUnboundStorageUrl(ctx, school.logoStorageId) : null,
    ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q: any) => q.eq("classId", reportCardClassId))
      .collect(),
    ctx.db
      .query("schoolAssessmentSettings")
      .withIndex("by_school_active", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true)
      )
      .first(),
    historicalWithoutPolicy ? Promise.resolve([]) : resolveEffectiveGradingBands(ctx, args.schoolId),
    ctx.db
      .query("reportCardComments")
      .withIndex("by_student_session_term", (q: any) =>
        q
          .eq("studentId", args.studentId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
      )
      .collect()
      .then((docs: any[]) => pickMostRecentDoc(docs)),
    buildExtrasCollectionView(ctx, {
      schoolId: args.schoolId,
      classId: reportCardClassId,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
    }),
    resolveEffectiveReportCardTermSettings(ctx, {
      schoolId: args.schoolId,
      classId: reportCardClassId,
      termId: args.termId,
    }),
    listActiveClassSubjectAggregations(ctx, {
      schoolId: args.schoolId,
      classId: reportCardClassId,
    }),
    listStudentAggregationOptOuts(ctx, {
      studentId: args.studentId,
      classId: reportCardClassId,
      sessionId: args.sessionId,
    }),
    ctx.db
      .query("academicTerms")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect(),
    ctx.db
      .query("historicalTermTotals")
      .withIndex("by_student_and_session", (q: any) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("studentId", args.studentId)
          .eq("sessionId", args.sessionId)
      )
      .collect(),
    ctx.db
      .query("reportCardManualAdjustments")
      .withIndex("by_student_and_report_term", (q: any) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("studentId", args.studentId)
          .eq("sessionId", args.sessionId)
          .eq("termId", args.termId)
      )
      .take(500),
  ]);

  if (!classDoc || classDoc.schoolId !== args.schoolId) {
    throw new ConvexError("Class not found");
  }

  const sessionFormTeacherAssignment = await ctx.db
    .query("classSessionFormTeachers")
    .withIndex("by_class_and_session", (q: any) =>
      q.eq("classId", reportCardClassId).eq("sessionId", args.sessionId)
    )
    .unique();

  const effectiveFormTeacherId =
    sessionFormTeacherAssignment?.formTeacherId ?? classDoc.formTeacherId ?? null;

  const classTeacher =
    effectiveFormTeacherId &&
    String(effectiveFormTeacherId) !== String(student.userId)
      ? await ctx.db.get(effectiveFormTeacherId)
      : null;
  const studentName = getReadableUserName(studentUser);
  const classTeacherName = getReadableUserName(classTeacher);

  const selectionDocsForClass = sessionSelectionDocs.filter(
    (selection: any) => String(selection.classId) === String(reportCardClassId)
  );
  const explicitSubjectIds =
    selectionDocsForClass.length > 0
      ? selectionDocsForClass.map((selection: any) => String(selection.subjectId))
      : classSubjectDocs.map((classSubject: any) => String(classSubject.subjectId));
  const effectiveSubjectIds = deriveEffectiveSubjectSelectionIds({
    explicitSubjectIds,
    aggregations,
    optOutAggregationIds: aggregationOptOuts.map((optOut: any) =>
      String(optOut.aggregationId)
    ),
  });
  // Student subject selections (or the class offering fallback) are the source of
  // truth for report-card rows. Historical assessment records must not re-add a
  // subject after it has been unchecked or removed from the class blueprint.
  const subjectIds = new Set<string>(effectiveSubjectIds);

  if (subjectIds.size === 0) {
    throw new ConvexError(
      "No subjects are configured for this student in the selected session"
    );
  }

  const subjects = (
    await Promise.all(
      Array.from(subjectIds).map((subjectId) =>
        ctx.db.get(subjectId as Id<"subjects">)
      )
    )
  ).filter(
    (
      subject
    ): subject is Exclude<typeof subject, null> =>
      subject !== null && subject.schoolId === args.schoolId
  );

  if (subjects.length === 0) {
    throw new ConvexError("No subjects found for this report card");
  }

  const recordsBySubjectId = new Map<Id<"subjects">, any>(
    records.map((record: any) => [record.subjectId, record] as const)
  );
  const sessionRecordsByTermAndSubject = new Map<string, any>(
    allSessionRecords
      .filter((record: any) => String(record.classId) === String(reportCardClassId))
      .map((record: any) => [
        `${String(record.termId)}:${String(record.subjectId)}`,
        record,
      ])
  );
  const subjectsById = new Map<Id<"subjects">, (typeof subjects)[number]>(
    subjects.map((subject) => [subject._id, subject] as const)
  );
  const activeGradingBands: GradingBand[] = gradingBands
    .sort((a: any, b: any) => a.minScore - b.minScore)
    .map((band: any) => ({
      schoolId: String(band.schoolId),
      minScore: band.minScore,
      maxScore: band.maxScore,
      gradeLetter: band.gradeLetter,
      colorHex: band.colorHex ?? band.color,
      remark: band.remark,
      isActive: band.isActive,
      createdAt: band.createdAt,
      updatedAt: band.updatedAt,
      updatedBy: String(band.updatedBy),
    }));
  const assessmentConfig = {
    ca1Max: settings?.ca1Max ?? DEFAULT_CA_MAX,
    ca2Max: settings?.ca2Max ?? DEFAULT_CA_MAX,
    ca3Max: settings?.ca3Max ?? DEFAULT_CA_MAX,
    examMax: settings?.examContributionMax ?? DEFAULT_EXAM_MAX,
  };
  const currentTermIndex = getTermOrderForSession(sessionTerms, args.termId);
  const resultCalculationMode =
    (effectiveTermSettings.resultCalculationMode ??
      "standalone") as ReportCardCalculationMode;
  const useCumulativeAnnualMode = isCumulativeAnnualMode({
    calculationMode: resultCalculationMode,
    currentTermIndex,
  });
  const orderedSessionTerms = [...sessionTerms].sort(
    (a: any, b: any) => a.startDate - b.startDate
  );
  const firstTermId = orderedSessionTerms[0]?._id ?? null;
  const secondTermId = orderedSessionTerms[1]?._id ?? null;
  const manualAdjustmentBySubjectId = new Map<
    string,
    Doc<"reportCardManualAdjustments">
  >(
    manualAdjustments
      .filter(
        (adjustment: any) =>
          String(adjustment.classId) === String(reportCardClassId)
      )
      .map((adjustment: any) => [String(adjustment.subjectId), adjustment] as const)
  );
  const effectiveAggregations = aggregations.filter((aggregation) =>
    effectiveSubjectIds.has(String(aggregation.umbrellaSubjectId))
  );
  const aggregatedUmbrellaIds = new Set(
    effectiveAggregations.map((aggregation) => String(aggregation.umbrellaSubjectId))
  );
  const aggregatedComponentIds = new Set(
    effectiveAggregations.flatMap((aggregation) =>
      aggregation.components.map((component) =>
        String(component.componentSubjectId)
      )
    )
  );

  const standaloneResults = subjects
    .filter(
      (subject) =>
        !aggregatedUmbrellaIds.has(String(subject._id)) &&
        !aggregatedComponentIds.has(String(subject._id))
    )
    .map((subject) => {
      const record = recordsBySubjectId.get(subject._id) ?? null;

      if (!useCumulativeAnnualMode || !firstTermId || !secondTermId) {
        return record
          ? buildRecordedResult(subject, record)
          : buildPendingResult(subject);
      }

      const firstTermRecord = sessionRecordsByTermAndSubject.get(
        `${String(firstTermId)}:${String(subject._id)}`
      );
      const secondTermRecord = sessionRecordsByTermAndSubject.get(
        `${String(secondTermId)}:${String(subject._id)}`
      );

      const firstTermTotal = firstTermRecord?.total ??
        resolveHistoricalSnapshot(historicalTermTotals, firstTermId, subject._id, reportCardClassId);
      const secondTermTotal = secondTermRecord?.total ??
        resolveHistoricalSnapshot(historicalTermTotals, secondTermId, subject._id, reportCardClassId);

      return buildCumulativeResult({
        subject,
        currentRecord: record,
        firstTermTotal,
        secondTermTotal,
        gradingBands: activeGradingBands,
        manualAdjustment:
          manualAdjustmentBySubjectId.get(String(subject._id)) ?? null,
      });
    });

  const aggregatedResults = effectiveAggregations
    .map((aggregation) => {
      const umbrellaSubject = subjectsById.get(aggregation.umbrellaSubjectId);
      if (!umbrellaSubject) {
        return null;
      }

      const deriveForTerm = (termId: Id<"academicTerms">) =>
        deriveAggregatedSubjectResult({
          strategy: aggregation.strategy,
          assessmentConfig,
          gradingBands: activeGradingBands,
          components: aggregation.components.map((component) => {
            const componentRecord = sessionRecordsByTermAndSubject.get(
              `${String(termId)}:${String(component.componentSubjectId)}`
            );
            return {
              subjectId: String(component.componentSubjectId),
              ca1: componentRecord?.ca1 ?? null,
              ca2: componentRecord?.ca2 ?? null,
              ca3: componentRecord?.ca3 ?? null,
              examScore: componentRecord?.examScaledScore ?? null,
              total: componentRecord?.total ?? null,
              rawMax: component.rawMaxOverride ?? 100,
              contributionMax: component.contributionMax,
            };
          }),
        });

      const derived = deriveForTerm(args.termId);
      if (!useCumulativeAnnualMode || !firstTermId || !secondTermId) {
        return {
          subjectId: umbrellaSubject._id,
          subjectName: normalizeHumanName(umbrellaSubject.name),
          subjectCode: umbrellaSubject.code,
          ca1: derived.ca1,
          ca2: derived.ca2,
          ca3: derived.ca3,
          examScore: derived.examScore,
          total: derived.total,
          gradeLetter: derived.gradeLetter,
          remark: derived.remark,
          isRecorded: derived.isRecorded,
          calculationMode: "standalone" as const,
          currentTermTotal: derived.total,
          firstTermTotal: null,
          secondTermTotal: null,
          annualAverage: null,
          isCumulativeComplete: false,
          missingHistoricalTerms: [],
          manualAdjustment: null,
        };
      }

      const firstTermUmbrellaRecord = sessionRecordsByTermAndSubject.get(
        `${String(firstTermId)}:${String(umbrellaSubject._id)}`
      );
      const secondTermUmbrellaRecord = sessionRecordsByTermAndSubject.get(
        `${String(secondTermId)}:${String(umbrellaSubject._id)}`
      );
      const firstTermDerived = deriveForTerm(firstTermId);
      const secondTermDerived = deriveForTerm(secondTermId);
      const firstTermTotal =
        firstTermUmbrellaRecord?.total ??
        (firstTermDerived.isRecorded ? firstTermDerived.total : null) ??
        resolveHistoricalSnapshot(
          historicalTermTotals,
          firstTermId,
          umbrellaSubject._id,
          reportCardClassId
        );
      const secondTermTotal =
        secondTermUmbrellaRecord?.total ??
        (secondTermDerived.isRecorded ? secondTermDerived.total : null) ??
        resolveHistoricalSnapshot(
          historicalTermTotals,
          secondTermId,
          umbrellaSubject._id,
          reportCardClassId
        );

      return buildCumulativeResult({
        subject: umbrellaSubject,
        currentRecord: derived.isRecorded
          ? {
              ca1: derived.ca1,
              ca2: derived.ca2,
              ca3: derived.ca3,
              examScaledScore: derived.examScore,
              total: derived.total,
              gradeLetter: derived.gradeLetter,
              remark: derived.remark,
            }
          : null,
        firstTermTotal,
        secondTermTotal,
        gradingBands: activeGradingBands,
        manualAdjustment:
          manualAdjustmentBySubjectId.get(String(umbrellaSubject._id)) ?? null,
      });
    })
    .filter(
      (result): result is NonNullable<typeof result> => result !== null
    );

  const results = [...standaloneResults, ...aggregatedResults].sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName)
  );

  const totalScore = results.reduce((sum, result) => sum + result.total, 0);
  const recordedSubjects = results.filter((result) => result.isRecorded).length;

  return {
    gradingPolicy: {
      version: Math.max(0, ...gradingBands.map((band: Doc<"gradingBands">) => band.version ?? 0)),
      source: historicalWithoutPolicy ? "historical_missing" : "current",
      bands: activeGradingBands.map(band => ({
        gradeLetter: band.gradeLetter,
        minScore: band.minScore,
        maxScore: band.maxScore,
        remark: band.remark,
        ...(band.colorHex ? {colorHex: band.colorHex} : {}),
      })),
    },
    schoolName: normalizeHumanName(school.name),
    schoolLogoUrl,
    schoolAddress: school.address ?? null,
    schoolContact: [school.contactPhone, school.contactEmail].filter(Boolean).join(" • ") || null,
    schoolMotto: school.motto ?? null,
    theme: {
      primaryColor: school.theme?.primaryColor || "#0f172a",
      accentColor: school.theme?.accentColor || "#d97706",
    },
    sessionName: normalizeHumanName(session.name),
    termName: normalizeHumanName(term.name),
    classId: reportCardClassId,
    className: buildClassName(classDoc),
    generatedAt: Date.now(),
    assessmentConfig,
    resultCalculationMode,
    student: {
      _id: student._id,
      name: studentName.displayName || "Unnamed Student",
      displayName: studentName.displayName || "Unnamed Student",
      firstName: studentName.firstName,
      lastName: studentName.lastName,
      admissionNumber: student.admissionNumber,
      gender: student.gender ?? null,
      dateOfBirth: student.dateOfBirth ?? null,
      guardianName: student.guardianName ?? null,
      guardianPhone: student.guardianPhone ?? null,
      address: student.address ?? null,
      houseName: student.houseName
        ? normalizeHumanName(student.houseName)
        : null,
      nextTermBegins: effectiveTermSettings.nextTermBegins,
      photoUrl,
    },
    summary: {
      totalSubjects: results.length,
      recordedSubjects,
      pendingSubjects: results.length - recordedSubjects,
      averageScore: results.length > 0 ? totalScore / results.length : null,
      totalScore,
    },
    results,
    extras: extrasView.printableBundles,
    classTeacherName:
      classTeacher && classTeacher.schoolId === args.schoolId
        ? classTeacherName.displayName || null
        : null,
    classTeacherComment: reportCardComment?.classTeacherComment ?? null,
    headTeacherComment: reportCardComment?.headTeacherComment ?? null,
  };
}

export const getStudentReportCard = query({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.optional(v.id("classes")),
  },
  returns: reportCardResultValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "academic.report_cards.preview" });
    return await buildStudentReportCard(ctx, {
      userId,
      schoolId,
      role,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
      preferredClassId: args.classId,
    });
  },
});

export const getStudentsForReportCardBatch = query({
  args: {
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.array(reportCardBatchStudentValidator),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "academic.report_cards.preview" });

    await assertClassReportCardAccess(ctx, {
      userId,
      schoolId,
      role,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    return await getStudentsForClassReportCardBatch(ctx, {
      schoolId,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
    });
  },
});

export const getClassReportCards = query({
  args: {
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.array(reportCardResultValidator),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "academic.report_cards.preview" });

    await assertClassReportCardAccess(ctx, {
      userId,
      schoolId,
      role,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    const roster = await getStudentsForClassReportCardBatch(ctx, {
      schoolId,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    if (roster.length === 0) {
      throw new ConvexError(
        "No students found for the selected class and session"
      );
    }

    return await Promise.all(
      roster.map((student) =>
        buildStudentReportCard(ctx, {
          userId,
          schoolId,
          role,
          studentId: student.studentId,
          sessionId: args.sessionId,
          termId: args.termId,
          preferredClassId: args.classId,
          skipRoleCheck: true,
        })
      )
    );
  },
});

export const saveStudentReportCardComments = mutation({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classTeacherComment: v.union(v.string(), v.null()),
    headTeacherComment: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "academic.assessments.enter",
      });
    const [student, session, term, existingComment, assessmentRecords] =
      await Promise.all([
        ctx.db.get(args.studentId),
        ctx.db.get(args.sessionId),
        ctx.db.get(args.termId),
        ctx.db
          .query("reportCardComments")
          .withIndex("by_student_session_term", (q) =>
            q
              .eq("studentId", args.studentId)
              .eq("sessionId", args.sessionId)
              .eq("termId", args.termId)
          )
          .collect()
          .then((docs: any[]) => pickMostRecentDoc(docs)),
        ctx.db
          .query("assessmentRecords")
          .withIndex("by_student_and_term", (q) =>
            q
              .eq("schoolId", schoolId)
              .eq("studentId", args.studentId)
              .eq("sessionId", args.sessionId)
              .eq("termId", args.termId)
          )
          .collect(),
      ]);

    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Student not found");
    }
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== schoolId || term.sessionId !== args.sessionId) {
      throw new ConvexError("Term not found");
    }

    const reportCardClassId = assessmentRecords[0]?.classId ?? student.classId;

    if (role === "teacher") {
      const hasClassAccess = await teacherHasClassAccess(
        ctx,
        userId,
        schoolId,
        reportCardClassId
      );

      if (!hasClassAccess) {
        throw new ConvexError("Not assigned to this class");
      }

      if (args.headTeacherComment !== undefined) {
        throw new ConvexError("Admin access required");
      }
    } else {
      await assertAdminForSchool(ctx, userId, schoolId, role);
    }

    const classTeacherComment = normalizeOptionalComment(args.classTeacherComment);
    const headTeacherComment =
      args.headTeacherComment === undefined
        ? existingComment?.headTeacherComment ?? undefined
        : normalizeOptionalComment(args.headTeacherComment);
    const now = Date.now();

    if (existingComment) {
      const replacement: Record<string, unknown> = {
        schoolId,
        studentId: args.studentId,
        sessionId: args.sessionId,
        termId: args.termId,
        createdAt: existingComment.createdAt,
        updatedAt: now,
        updatedBy: userId,
      };

      if (classTeacherComment !== undefined) {
        replacement.classTeacherComment = classTeacherComment;
      }
      if (headTeacherComment !== undefined) {
        replacement.headTeacherComment = headTeacherComment;
      }

      await ctx.db.replace(existingComment._id, replacement as any);
      return null;
    }

    const newComment: Record<string, unknown> = {
      schoolId,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    };

    if (classTeacherComment !== undefined) {
      newComment.classTeacherComment = classTeacherComment;
    }
    if (headTeacherComment !== undefined) {
      newComment.headTeacherComment = headTeacherComment;
    }

    await ctx.db.insert("reportCardComments", newComment as any);

    return null;
  },
});

export const saveTermNextTermBegins = mutation({
  args: {
    termId: v.id("academicTerms"),
    nextTermBegins: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "academic.grading_bands.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const term = await ctx.db.get(args.termId);
    if (!term || term.schoolId !== schoolId) {
      throw new ConvexError("Term not found");
    }

    if (
      args.nextTermBegins !== null &&
      args.nextTermBegins <= term.endDate
    ) {
      throw new ConvexError("Next term start date must be after this term ends");
    }

    const adjacentNextTerm = await resolveAdjacentNextTermInSession(
      ctx,
      schoolId,
      term.sessionId,
      args.termId
    );
    assertNextTermBeginsFitsAdjacentTerm(args.nextTermBegins, adjacentNextTerm);

    const replacement: {
      schoolId: typeof term.schoolId;
      sessionId: typeof term.sessionId;
      name: string;
      startDate: number;
      endDate: number;
      nextTermBegins?: number;
      defaultTimesSchoolOpened?: number;
      isActive: boolean;
      createdAt: number;
      updatedAt: number;
    } = {
      schoolId: term.schoolId,
      sessionId: term.sessionId,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      isActive: term.isActive,
      createdAt: term.createdAt,
      updatedAt: Date.now(),
    };

    if (args.nextTermBegins !== null) {
      replacement.nextTermBegins = args.nextTermBegins;
    }
    if (term.defaultTimesSchoolOpened !== undefined) {
      replacement.defaultTimesSchoolOpened = term.defaultTimesSchoolOpened;
    }

    await ctx.db.replace(args.termId, replacement);
    return null;
  },
});

async function getIssuedReport(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<"students">,
  sessionId: Id<"academicSessions">,
  termId: Id<"academicTerms">,
  classId: Id<"classes">,
) {
  return ctx.db
    .query("issuedReportCards")
    .withIndex("by_student_session_term_class", (q) =>
      q
        .eq("studentId", studentId)
        .eq("sessionId", sessionId)
        .eq("termId", termId)
        .eq("classId", classId),
    )
    .unique();
}

export const certifyStudentReportCard = mutation({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    classId: v.id("classes"),
    confirmation: v.string(),
    reviewedKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { schoolId, userId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "academic.report_cards.publish_final" });
    const auth = await requireCapability(
      ctx,
      schoolId,
      "academic.report_cards.publish_final",
    );
    const student = await ctx.db.get(args.studentId);
    if (
      !student ||
      student.schoolId !== schoolId ||
      args.confirmation !== student.admissionNumber
    )
      throw new ConvexError("Confirm the student's admission number");
    const report = await buildStudentReportCard(ctx, {
      ...args,
      schoolId,
      userId,
      role,
      preferredClassId: args.classId,
    });
    if (report.certifiedAt) return report.certifiedAt;
    if (report.gradingPolicy?.source !== "current")
      throw new ConvexError(
        "Historical reports without an issued policy cannot be certified using today's policy",
      );
    if (!report.gradingPolicy.bands.length || report.gradingPolicy.version < 1)
      throw new ConvexError(
        "Save a versioned grading policy before certification",
      );
    if (reportCardReviewKey(report) !== args.reviewedKey)
      throw new ConvexError(
        "Report changed since review. Review the latest preview before certifying.",
      );
    if (
      report.summary.pendingSubjects > 0 ||
      report.results.some(
        (r) =>
          r.calculationMode === "cumulative_annual" &&
          r.isCumulativeComplete === false,
      )
    )
      throw new ConvexError("Complete all scores before certification");
    const now = Date.now();
    await ctx.db.insert("issuedReportCards", {
      schoolId,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
      classId: args.classId,
      issuedAt: now,
      issuedBy: userId,
      schoolLogoStorageId: (await ctx.db.get(schoolId))?.logoStorageId,
      studentPhotoStorageId: student.photoStorageId,
      report: {
        ...report,
        certifiedAt: now,
        gradingPolicy: { ...report.gradingPolicy, source: "snapshot" },
      },
    });
    await recordAuditEventHelper(ctx, {
      schoolId,
      actorKind: "user",
      actorPersonId: auth.personId,
      actorMembershipId: auth.membershipId,
      actorEmailSnapshot: role,
      module: "academic",
      action: "report_card.certify",
      targetType: "students",
      targetId: student._id,
      outcome: "success",
      safeSummary: "Certified immutable report card and grading policy",
      alertTier: "tier1_critical",
    });
    return now;
  },
});
