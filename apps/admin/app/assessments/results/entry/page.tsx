"use client";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { isConvexConfigured } from "@/convex-runtime";
import {
buildErrorSummaries,
countErrors,
hasAnyErrors,
validateField,
} from "@/exam-helpers";
import { humanNameFinal } from "@/human-name";
import {
getMockSheet,
mockClasses,
mockSessions,
mockSubjectsByClass,
mockTermsBySession,
} from "@/mock-data";
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
import type { ExamInputMode } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useMutation,useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback,useEffect,useMemo,useState } from "react";
import { AdminRosterGrid } from "./components/AdminRosterGrid";
import { AdminSaveActionBar } from "./components/AdminSaveActionBar";
import { AdminSelectionBar } from "./components/AdminSelectionBar";
import { AdminValidationBanner } from "./components/AdminValidationBanner";

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

const ADMIN_RESULTS_ENTRY_SAVE_BLOCKED_TOAST_ID =
  "admin-results-entry-save-blocked";
const ADMIN_RESULTS_ENTRY_PARTIAL_SAVE_TOAST_ID =
  "admin-results-entry-partial-save";

function createHandledSaveError(message: string) {
  return Object.assign(new Error(message), { toastHandled: true as const });
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
  const isSelectedSubjectAvailable =
    !selection.subjectId ||
    subjects === undefined ||
    subjects.some((subject) => subject.id === selection.subjectId);
  const isSheetReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.subjectId &&
      isSelectedSubjectAvailable
  );
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
      if (sheetData && !sheetData.editingState.canEdit) {
        return;
      }

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

        const rest = { ...studentErrors };
        delete rest[field];
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
      appToast.warning("Review required before saving", {
        id: ADMIN_RESULTS_ENTRY_SAVE_BLOCKED_TOAST_ID,
        description: "Complete the selectors, then try saving again.",
      });
      throw createHandledSaveError("Complete the selectors before saving.");
    }

    if (!sheetData.editingState.canEdit) {
      appToast.warning("Review required before saving", {
        id: ADMIN_RESULTS_ENTRY_SAVE_BLOCKED_TOAST_ID,
        description: sheetData.editingState.message,
      });
      throw createHandledSaveError(sheetData.editingState.message);
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
      const errorCount = countErrors(allErrors);
      setValidationErrors(allErrors);
      setShowErrorBanner(true);
      setExtraErrorSummaries([]);
      appToast.warning("Review required before saving", {
        id: ADMIN_RESULTS_ENTRY_SAVE_BLOCKED_TOAST_ID,
        description: `${errorCount} field${errorCount === 1 ? "" : "s"} need attention. Review the highlighted rows and try again.`,
      });
      throw createHandledSaveError(
        `${errorCount} validation error${errorCount === 1 ? "" : "s"} found`
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
      appToast.warning("Review required before saving", {
        id: ADMIN_RESULTS_ENTRY_SAVE_BLOCKED_TOAST_ID,
        description: "Complete at least one full row, then try saving again.",
      });
      throw createHandledSaveError("No complete rows to save yet.");
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
        appToast.warning("Partial save completed", {
          id: ADMIN_RESULTS_ENTRY_PARTIAL_SAVE_TOAST_ID,
          description: `Saved ${savedCount} record${savedCount === 1 ? "" : "s"}. ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} still need attention.`,
        });
        throw createHandledSaveError(
          `Saved ${savedCount} record${savedCount === 1 ? "" : "s"}, but ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} still need attention.`
        );
      }

      appToast.warning("Save blocked by validation", {
        id: ADMIN_RESULTS_ENTRY_SAVE_BLOCKED_TOAST_ID,
        description: `${result.errors.length} row${result.errors.length === 1 ? "" : "s"} still need attention. Review the highlighted rows and try again.`,
      });
      throw createHandledSaveError("Save blocked by row-level validation errors.");
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

  const roster = useMemo(() => sheetData?.roster ?? [], [sheetData?.roster]);
  const examInputMode: ExamInputMode =
    sheetData?.settings?.examInputMode ?? "raw40";
  const editingState = sheetData?.editingState;
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
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
        }
      `}</style>

      <div className="flex flex-col lg:flex-row-reverse flex-1 min-h-0">
        {/* Sidebar Bucket: Control Center */}
        <aside className="w-full lg:w-[320px] lg:h-full lg:overflow-y-auto border-l border-slate-200 bg-slate-50/50 shrink-0 z-20">
          <div className="p-6 space-y-6">
            <div className="pb-4">
               <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1 leading-none">Assessment Engine</h4>
               <h2 className="text-lg font-black tracking-tight text-slate-950">Entry Selector</h2>
            </div>

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
          </div>
        </aside>

        {/* Main Bucket: Score Sheet */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar relative bg-white">
          <div className="max-w-[1280px] mx-auto px-6 py-8 md:px-12 md:py-10 space-y-6 pb-32">
            <AdminHeader
              title={selectedSubjectName}
              label="Bulk Protocol Recording"
              description={`${selectedClassName} \u2022 ${selectedTermName} \u2022 ${selectedSessionName}`}
              className="!gap-2"
            />

            {modeNotice && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-5 py-3">
                 <p className="text-[9px] font-black uppercase tracking-widest text-amber-900/50 mb-0.5">DEV_ENVIRONMENT_NOTICE</p>
                 <p className="text-sm font-bold text-amber-900/80">{modeNotice}</p>
              </div>
            )}

            {editingState && editingState.hasPolicy && (
               <div className={`rounded-lg border px-5 py-3 flex items-center justify-between ${
                editingState.canEdit ? "border-slate-100 bg-slate-50/50" : "border-amber-100 bg-amber-50/50"
              }`}>
                <div className="flex items-center gap-4">
                   <div className={`w-2 h-2 rounded-full ${editingState.canEdit ? "bg-emerald-500" : "bg-amber-500"}`} />
                   <p className={`text-[13px] font-bold ${editingState.canEdit ? "text-slate-600" : "text-amber-950"}`}>
                     {editingState.message}
                   </p>
                </div>
              </div>
            )}

            {showErrorBanner && errorSummaries.length > 0 && (
              <AdminValidationBanner
                errorSummaries={errorSummaries}
                onDismiss={() => setShowErrorBanner(false)}
              />
            )}

            {isLoadingSheet ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-950 rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Score Sheet...</p>
              </div>
            ) : !isSheetReady ? (
              <div className="flex flex-col items-center justify-center py-32 rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 flex items-center justify-center mb-6">
                   <ChevronLeft className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-950">Configuration Requested</h3>
                <p className="mt-2 text-sm font-bold text-slate-400 max-w-[280px]">
                  Please use the selector on the right to load a specific academic roster.
                </p>
              </div>
            ) : roster.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-xl font-black tracking-tighter">No Active Enrollment</p>
                <p className="text-sm font-bold text-slate-400 mt-2 max-w-sm mx-auto">
                  This class currently has no students registered for this session and term.
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
                isEditable={editingState?.canEdit ?? true}
                onScoreChange={handleScoreChange}
              />
            )}
          </div>

          {isSheetReady && roster.length > 0 && (
            <div className="sticky bottom-0 left-0 right-0 p-3 sm:p-6 bg-white/90 backdrop-blur-md border-t border-slate-200 z-50 shadow-[0_-8px_32px_rgba(0,0,0,0.05)]">
              <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                <AdminSaveActionBar
                  hasUnsavedChanges={hasUnsavedChanges}
                  hasValidationErrors={hasAnyErrors(validationErrors)}
                  errorCount={countErrors(validationErrors)}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  dirtyCount={draftScores.size}
                  isEditingLocked={!(editingState?.canEdit ?? true)}
                  lockMessage={editingState?.message}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
