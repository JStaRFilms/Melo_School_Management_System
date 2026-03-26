"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import type { ExamInputMode } from "@school/shared";
import type {
  DraftScores,
  ExamEntrySheetResponse,
  Id,
  ScoreField,
  SelectionState,
  SelectorOption,
  UpsertResponse,
  ValidationErrors,
} from "@/types";
import { AdminSelectionBar } from "./components/AdminSelectionBar";
import { AdminRosterGrid } from "./components/AdminRosterGrid";
import { AdminSaveActionBar } from "./components/AdminSaveActionBar";
import { AdminValidationBanner } from "./components/AdminValidationBanner";
import {
  buildErrorSummaries,
  countErrors,
  hasAnyErrors,
  validateField,
} from "@/exam-helpers";
import {
  getMockSheet,
  mockClasses,
  mockSessions,
  mockSubjectsByClass,
  mockTermsBySession,
} from "@/mock-data";
import { isConvexConfigured } from "@/convex-runtime";
import { humanNameFinal } from "@/human-name";

interface SaveArgs {
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  classId: Id<"classes">;
  subjectId: Id<"subjects">;
  records: Array<{
    studentId: Id<"students">;
    ca1: number;
    ca2: number;
    ca3: number;
    examRawScore: number;
  }>;
}

export default function AdminScoreEntryPage() {
  const searchParams = useSearchParams();
  const selection = useMemo(
    () => ({
      sessionId:
        (searchParams.get("sessionId") as Id<"academicSessions">) ?? null,
      termId: (searchParams.get("termId") as Id<"academicTerms">) ?? null,
      classId: (searchParams.get("classId") as Id<"classes">) ?? null,
      subjectId: (searchParams.get("subjectId") as Id<"subjects">) ?? null,
    }),
    [searchParams]
  );

  if (!isConvexConfigured()) {
    return <MockAdminScoreEntryPage selection={selection} />;
  }

  return <LiveAdminScoreEntryPage selection={selection} />;
}

function LiveAdminScoreEntryPage({
  selection,
}: {
  selection: SelectionState;
}) {
  const isSheetReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.subjectId
  );

  const sessions = useQuery(
    "functions/academic/adminSelectors:getAdminSessions" as never
  ) as SelectorOption[] | undefined;
  const terms = useQuery(
    "functions/academic/adminSelectors:getTermsBySession" as never,
    selection.sessionId
      ? ({ sessionId: selection.sessionId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const classes = useQuery(
    "functions/academic/adminSelectors:getAllClasses" as never
  ) as SelectorOption[] | undefined;
  const subjects = useQuery(
    "functions/academic/adminSelectors:getSubjectsByClass" as never,
    selection.classId
      ? ({ classId: selection.classId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const sheetData = useQuery(
    "functions/academic/assessmentRecords:getExamEntrySheet" as never,
    isSheetReady
      ? ({
          sessionId: selection.sessionId,
          termId: selection.termId,
          classId: selection.classId,
          subjectId: selection.subjectId,
        } as never)
      : ("skip" as never)
  ) as ExamEntrySheetResponse | undefined;
  const upsertAssessmentRecordsBulk = useMutation(
    "functions/academic/assessmentRecords:upsertAssessmentRecordsBulk" as never
  );

  const handleSaveRecords = useCallback(
    async (args: {
      sessionId: Id<"academicSessions">;
      termId: Id<"academicTerms">;
      classId: Id<"classes">;
      subjectId: Id<"subjects">;
      records: Array<{
        studentId: Id<"students">;
        ca1: number;
        ca2: number;
        ca3: number;
        examRawScore: number;
      }>;
    }) =>
      (await upsertAssessmentRecordsBulk(args as never)) as UpsertResponse,
    [upsertAssessmentRecordsBulk]
  );

  return (
    <AdminScoreEntryContent
      selection={selection}
      sessions={sessions ?? []}
      terms={terms ?? []}
      classes={classes ?? []}
      subjects={subjects ?? []}
      sheetData={sheetData}
      isLoadingSheet={isSheetReady && sheetData === undefined}
      isLoadingSessions={sessions === undefined}
      isLoadingTerms={Boolean(selection.sessionId) && terms === undefined}
      isLoadingClasses={classes === undefined}
      isLoadingSubjects={Boolean(selection.classId) && subjects === undefined}
      onSaveRecords={handleSaveRecords}
    />
  );
}

function MockAdminScoreEntryPage({
  selection,
}: {
  selection: SelectionState;
}) {
  const terms = selection.sessionId
    ? mockTermsBySession[selection.sessionId] ?? []
    : [];
  const subjects = selection.classId
    ? mockSubjectsByClass[selection.classId] ?? []
    : [];
  const sheetData = useMemo(() => {
    if (
      !selection.sessionId ||
      !selection.termId ||
      !selection.classId ||
      !selection.subjectId
    ) {
      return undefined;
    }

    return getMockSheet(
      selection.sessionId,
      selection.termId,
      selection.classId,
      selection.subjectId
    );
  }, [
    selection.classId,
    selection.sessionId,
    selection.subjectId,
    selection.termId,
  ]);

  const handleSaveRecords = useCallback(
    async (args: {
      records: Array<{
        studentId: Id<"students">;
        ca1: number;
        ca2: number;
        ca3: number;
        examRawScore: number;
      }>;
    }) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        updated: 0,
        created: args.records.length,
        errors: [],
      } satisfies UpsertResponse;
    },
    []
  );

  return (
    <AdminScoreEntryContent
      selection={selection}
      sessions={mockSessions}
      terms={terms}
      classes={mockClasses}
      subjects={subjects}
      sheetData={sheetData}
      isLoadingSheet={false}
      modeNotice="Preview mode is active because NEXT_PUBLIC_CONVEX_URL is not configured yet. You can still test the selector flow, /40 vs /60 rendering, validation, and save interactions locally."
      onSaveRecords={handleSaveRecords}
    />
  );
}

interface AdminScoreEntryContentProps {
  selection: SelectionState;
  sessions: SelectorOption[];
  terms: SelectorOption[];
  classes: SelectorOption[];
  subjects: SelectorOption[];
  sheetData?: ExamEntrySheetResponse;
  isLoadingSheet: boolean;
  isLoadingSessions?: boolean;
  isLoadingTerms?: boolean;
  isLoadingClasses?: boolean;
  isLoadingSubjects?: boolean;
  modeNotice?: string;
  onSaveRecords: (args: SaveArgs) => Promise<UpsertResponse>;
}

function AdminScoreEntryContent({
  selection,
  sessions,
  terms,
  classes,
  subjects,
  sheetData,
  isLoadingSheet,
  isLoadingSessions = false,
  isLoadingTerms = false,
  isLoadingClasses = false,
  isLoadingSubjects = false,
  modeNotice,
  onSaveRecords,
}: AdminScoreEntryContentProps) {
  const isSheetReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.subjectId
  );

  const [draftScores, setDraftScores] = useState<DraftScores>(new Map());
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [extraErrorSummaries, setExtraErrorSummaries] = useState<
    Array<{ studentName: string; message: string }>
  >([]);

  useEffect(() => {
    setDraftScores(new Map());
    setValidationErrors(new Map());
    setHasUnsavedChanges(false);
    setShowErrorBanner(false);
    setExtraErrorSummaries([]);
  }, [
    selection.sessionId,
    selection.termId,
    selection.classId,
    selection.subjectId,
  ]);

  const handleScoreChange = useCallback(
    (studentId: Id<"students">, field: ScoreField, value: number | null) => {
      setDraftScores((prev) => {
        const next = new Map(prev);
        const existing = next.get(studentId) ?? {};
        next.set(studentId, { ...existing, [field]: value });
        return next;
      });

      setHasUnsavedChanges(true);
      setShowErrorBanner(false);
      setExtraErrorSummaries([]);

      const examInputMode: ExamInputMode =
        sheetData?.settings?.examInputMode ?? "raw40";
      const error = validateField(field, value, examInputMode);

      setValidationErrors((prev) => {
        const next = new Map(prev);
        const studentErrors = next.get(studentId) ?? {};

        if (error) {
          next.set(studentId, { ...studentErrors, [field]: error });
          return next;
        }

        const { [field]: _removed, ...rest } = studentErrors;
        if (Object.keys(rest).length > 0) {
          next.set(studentId, rest);
        } else {
          next.delete(studentId);
        }

        return next;
      });
    },
    [sheetData]
  );

  const handleSave = useCallback(async () => {
    if (!isSheetReady || !sheetData) {
      throw new Error("Complete the selectors before saving.");
    }

    const examInputMode: ExamInputMode =
      sheetData.settings?.examInputMode ?? "raw40";
    const allErrors: ValidationErrors = new Map();

    for (const [studentId, scores] of draftScores.entries()) {
      const studentErrors: Partial<Record<ScoreField, string>> = {};

      for (const field of [
        "ca1",
        "ca2",
        "ca3",
        "examRawScore",
      ] as ScoreField[]) {
        const value = scores[field];
        if (value === null || value === undefined) {
          continue;
        }

        const error = validateField(field, value, examInputMode);
        if (error) {
          studentErrors[field] = error;
        }
      }

      if (Object.keys(studentErrors).length > 0) {
        allErrors.set(studentId, studentErrors);
      }
    }

    if (allErrors.size > 0) {
      setValidationErrors(allErrors);
      setShowErrorBanner(true);
      setExtraErrorSummaries([]);
      throw new Error(
        `${countErrors(allErrors)} validation error${countErrors(allErrors) === 1 ? "" : "s"} found`
      );
    }

    const records: SaveArgs["records"] = [];

    for (const [studentId, scores] of draftScores.entries()) {
      const rosterEntry = sheetData.roster.find(
        (item) => item.studentId === studentId
      );
      const ca1 = scores.ca1 ?? rosterEntry?.assessmentRecord?.ca1 ?? null;
      const ca2 = scores.ca2 ?? rosterEntry?.assessmentRecord?.ca2 ?? null;
      const ca3 = scores.ca3 ?? rosterEntry?.assessmentRecord?.ca3 ?? null;
      const examRawScore =
        scores.examRawScore ??
        rosterEntry?.assessmentRecord?.examRawScore ??
        null;

      if (
        ca1 !== null &&
        ca2 !== null &&
        ca3 !== null &&
        examRawScore !== null
      ) {
        records.push({ studentId, ca1, ca2, ca3, examRawScore });
      }
    }

    if (records.length === 0) {
      throw new Error("No complete rows to save yet.");
    }

    const result = await onSaveRecords({
      sessionId: selection.sessionId!,
      termId: selection.termId!,
      classId: selection.classId!,
      subjectId: selection.subjectId!,
      records,
    });

    const erroredStudentIds = new Set(
      result.errors.map((error) => error.studentId)
    );
    const nextDraftScores = new Map(draftScores);

    for (const { studentId } of records) {
      if (!erroredStudentIds.has(studentId)) {
        nextDraftScores.delete(studentId);
      }
    }

    if (result.errors.length > 0) {
      const nextValidationErrors: ValidationErrors = new Map();

      for (const error of result.errors) {
        if (error.field === "record") {
          continue;
        }

        const studentErrors = nextValidationErrors.get(error.studentId) ?? {};
        nextValidationErrors.set(error.studentId, {
          ...studentErrors,
          [error.field]: error.message,
        });
      }

      setDraftScores(nextDraftScores);
      setValidationErrors(nextValidationErrors);
      setHasUnsavedChanges(nextDraftScores.size > 0);
      setShowErrorBanner(true);
      setExtraErrorSummaries(
        result.errors.map((error) => ({
          studentName:
            sheetData.roster.find(
              (student) => student.studentId === error.studentId
            )?.studentName ?? "Unknown student",
          message: error.message,
        }))
      );

      const savedCount = result.updated + result.created;
      if (savedCount > 0) {
        throw new Error(
          `Saved ${savedCount} record${savedCount === 1 ? "" : "s"}, but ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} still need attention.`
        );
      }

      throw new Error("Save blocked by row-level validation errors.");
    }

    setDraftScores(new Map());
    setValidationErrors(new Map());
    setHasUnsavedChanges(false);
    setShowErrorBanner(false);
    setExtraErrorSummaries([]);
    return result;
  }, [
    draftScores,
    isSheetReady,
    onSaveRecords,
    selection,
    sheetData,
  ]);

  const handleCancel = useCallback(() => {
    setDraftScores(new Map());
    setValidationErrors(new Map());
    setHasUnsavedChanges(false);
    setShowErrorBanner(false);
    setExtraErrorSummaries([]);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBeforeSelectionChange = useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      "You have unsaved changes. Discard them and load a different exam sheet?"
    );
  }, [hasUnsavedChanges]);

  const roster = sheetData?.roster ?? [];
  const examInputMode: ExamInputMode =
    sheetData?.settings?.examInputMode ?? "raw40";
    const selectedSubjectName = humanNameFinal(
    subjects.find((subject) => subject.id === selection.subjectId)?.name ??
      "Score Entry"
  );
    const selectedClassName = humanNameFinal(
    classes.find((classOption) => classOption.id === selection.classId)?.name ??
      "Select Class"
  );
  const selectedTermName =
    humanNameFinal(
      terms.find((term) => term.id === selection.termId)?.name ?? "Select Term"
    );
    const selectedSessionName = humanNameFinal(
    sessions.find((session) => session.id === selection.sessionId)?.name ??
      "Select Session"
  );
  const sheetLabel = `${selectedSubjectName} \u2022 ${selectedClassName}`;
  const errorSummaries = useMemo(
    () => [
      ...buildErrorSummaries(validationErrors, roster),
      ...extraErrorSummaries,
    ],
    [extraErrorSummaries, roster, validationErrors]
  );

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 md:px-6 space-y-6 pb-24">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 -mx-4 px-4 py-3.5 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 flex items-center justify-center text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="font-bold text-[10px] tracking-tight text-slate-900 leading-none uppercase">
              {selectedSubjectName}
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {selectedClassName} &bull; {selectedTermName} &bull; {selectedSessionName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center font-bold text-[10px] text-slate-600 border border-slate-200 uppercase">
            AD
          </div>
        </div>
      </header>

      {modeNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {modeNotice}
        </div>
      ) : null}

      <AdminSelectionBar
        sessions={sessions}
        terms={terms}
        classes={classes}
        subjects={subjects}
        selection={selection}
        isLoadingSessions={isLoadingSessions}
        isLoadingTerms={isLoadingTerms}
        isLoadingClasses={isLoadingClasses}
        isLoadingSubjects={isLoadingSubjects}
        onBeforeSelectionChange={handleBeforeSelectionChange}
      />

      {showErrorBanner && errorSummaries.length > 0 ? (
        <AdminValidationBanner
          errorSummaries={errorSummaries}
          onDismiss={() => setShowErrorBanner(false)}
        />
      ) : null}

      {isLoadingSheet ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
        </div>
      ) : !isSheetReady ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm font-medium">
            Select a session, term, class, and subject to begin.
          </p>
        </div>
      ) : roster.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-900 font-bold">No Students Found</p>
          <p className="text-slate-400 text-sm font-medium">
            This class has no students enrolled. Please select a different
            class.
          </p>
        </div>
      ) : (
            <AdminRosterGrid
              roster={roster}
              examInputMode={examInputMode}
              gradingBands={sheetData?.gradingBands ?? []}
              draftScores={draftScores}
              validationErrors={validationErrors}
              sheetLabel={sheetLabel}
              sessionId={selection.sessionId ?? ""}
              termId={selection.termId ?? ""}
              classId={selection.classId ?? ""}
              onScoreChange={handleScoreChange}
            />
      )}

      {isSheetReady && roster.length > 0 ? (
        <AdminSaveActionBar
          hasUnsavedChanges={hasUnsavedChanges}
          hasValidationErrors={hasAnyErrors(validationErrors)}
          errorCount={countErrors(validationErrors)}
          onSave={handleSave}
          onCancel={handleCancel}
          dirtyCount={draftScores.size}
        />
      ) : null}
    </div>
  );
}
