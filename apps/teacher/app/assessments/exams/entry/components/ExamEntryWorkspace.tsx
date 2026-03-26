"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@/lib/types";
import { SelectionBar } from "./SelectionBar";
import { RosterGrid } from "./RosterGrid";
import { SaveActionBar } from "./SaveActionBar";
import { ValidationErrorBanner } from "./ValidationErrorBanner";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { EmptyRoster } from "./EmptyRoster";
import {
  buildErrorSummaries,
  countErrors,
  hasAnyErrors,
  validateField,
} from "@/lib/exam-helpers";
import { humanNameFinalStrict } from "@/lib/human-name";

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

interface ExamEntryWorkspaceProps {
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

export function ExamEntryWorkspace({
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
}: ExamEntryWorkspaceProps) {
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
      setExtraErrorSummaries([]);
      setShowErrorBanner(true);
      throw new Error(
        `${countErrors(allErrors)} validation error${countErrors(allErrors) === 1 ? "" : "s"} found`
      );
    }

    const records: SaveArgs["records"] = [];

    for (const [studentId, scores] of draftScores.entries()) {
      const rosterEntry = sheetData.roster.find((item) => item.studentId === studentId);
      const ca1 = scores.ca1 ?? rosterEntry?.assessmentRecord?.ca1 ?? null;
      const ca2 = scores.ca2 ?? rosterEntry?.assessmentRecord?.ca2 ?? null;
      const ca3 = scores.ca3 ?? rosterEntry?.assessmentRecord?.ca3 ?? null;
      const examRawScore =
        scores.examRawScore ?? rosterEntry?.assessmentRecord?.examRawScore ?? null;

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

    const erroredStudentIds = new Set(result.errors.map((error) => error.studentId));
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
      setExtraErrorSummaries(
        result.errors.map((error) => ({
          studentName:
    humanNameFinalStrict(
              sheetData.roster.find((student) => student.studentId === error.studentId)
                ?.studentName ?? "Unknown student"
            ),
          message: error.message,
        }))
      );
      setShowErrorBanner(true);

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
  }, [draftScores, isSheetReady, onSaveRecords, selection, sheetData]);

  const handleCancel = useCallback(() => {
    setDraftScores(new Map());
    setValidationErrors(new Map());
    setHasUnsavedChanges(false);
    setShowErrorBanner(false);
    setExtraErrorSummaries([]);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBeforeSelectionChange = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(
      "You have unsaved changes. Discard them and load a different exam sheet?"
    );
  }, [hasUnsavedChanges]);

  const roster = sheetData?.roster ?? [];
  const examInputMode: ExamInputMode =
    sheetData?.settings?.examInputMode ?? "raw40";
  const errorSummaries = useMemo(
    () => [
      ...buildErrorSummaries(validationErrors, roster),
      ...extraErrorSummaries,
    ],
    [extraErrorSummaries, roster, validationErrors]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-obsidian-950">
          Exam Score Entry
        </h1>
        <p className="text-obsidian-500 text-sm font-medium">
          Enter continuous assessment and exam scores for your assigned classes.
        </p>
      </div>

      {modeNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {modeNotice}
        </div>
      ) : null}

      <SelectionBar
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
        <ValidationErrorBanner
          errorSummaries={errorSummaries}
          onDismiss={() => setShowErrorBanner(false)}
        />
      ) : null}

      {isLoadingSheet ? (
        <LoadingSkeleton />
      ) : !isSheetReady ? (
        <EmptyRoster />
      ) : roster.length === 0 ? (
        <EmptyRoster
          message="No Students Found"
          subtext="This class has no students enrolled. Please select a different class."
        />
      ) : (
        <RosterGrid
          roster={roster}
          examInputMode={examInputMode}
          gradingBands={sheetData?.gradingBands ?? []}
          draftScores={draftScores}
          validationErrors={validationErrors}
          sessionId={selection.sessionId ?? ""}
          termId={selection.termId ?? ""}
          classId={selection.classId ?? ""}
          onScoreChange={handleScoreChange}
        />
      )}

      {isSheetReady && roster.length > 0 ? (
        <SaveActionBar
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
