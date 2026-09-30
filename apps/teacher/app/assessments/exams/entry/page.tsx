"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ExamEntryWorkspace } from "./components/ExamEntryWorkspace";
import { LiveNarrativeEntry } from "./components/LiveNarrativeEntry";
import { isConvexConfigured } from "@/lib/convex-runtime";
import {
  getMockSheet,
  mockClasses,
  mockSessions,
  mockSubjectsByClass,
  mockTermsBySession,
} from "@/lib/mock-exam-data";
import { useAuth } from "@/lib/AuthProvider";
import type {
  ExamEntrySheetResponse,
  Id,
  SelectionState,
  SelectorOption,
  UpsertResponse,
} from "@/lib/types";

interface LegacySelectorOption {
  _id: string;
  name: string;
}

function normalizeSelectorOptions(
  options: SelectorOption[] | LegacySelectorOption[] | undefined
): SelectorOption[] | undefined {
  return options?.map((option) => ({
    id: "id" in option ? option.id : option._id,
    name: option.name,
  }));
}

export default function ExamEntryPage() {
  const { workspaceAccess } = useAuth();
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
    return <MockExamEntryPage selection={selection} />;
  }

  const schoolId = workspaceAccess?.state === "ready" ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  if (!schoolId) return <p role="status">Checking branch context…</p>;
  return <LiveExamEntryPage key={schoolId} schoolId={schoolId} selection={selection} />;
}

function LiveExamEntryPage({ schoolId, selection }: { schoolId: Id<"schools">; selection: SelectionState }) {
  const sessions = useQuery(
    "functions/academic/teacherSelectors:getTeacherSessions" as never,
    { schoolId } as never,
  ) as LegacySelectorOption[] | undefined;
  const terms = useQuery(
    "functions/academic/teacherSelectors:getTermsBySession" as never,
    selection.sessionId
      ? ({ schoolId, sessionId: selection.sessionId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const classes = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never,
    { schoolId } as never,
  ) as LegacySelectorOption[] | undefined;
  const isSelectedClassAssigned = Boolean(
    selection.classId && classes?.some((classOption) => classOption._id === selection.classId)
  );
  const subjects = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableSubjectsByClass" as never,
    isSelectedClassAssigned
      ? ({ schoolId, classId: selection.classId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const entryMode = useQuery("functions/academic/narrativeReports:getEntryClassMode" as never,
    selection.classId && selection.sessionId ? { schoolId, classId: selection.classId, sessionId: selection.sessionId } as never : "skip") as { mode: "graded" | "narrative"; canEnterNarrative: boolean } | undefined;
  const isSelectedSubjectAvailable = Boolean(
    selection.subjectId && subjects?.some((subject) => subject.id === selection.subjectId)
  );
  const subjectUnavailable = Boolean(
    selection.subjectId && ((classes && !isSelectedClassAssigned) || (subjects && !isSelectedSubjectAvailable))
  );
  const isSheetReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.subjectId &&
      isSelectedClassAssigned && isSelectedSubjectAvailable && entryMode?.mode === "graded"
  );
  const sheetData = useQuery(
    "functions/academic/assessmentRecords:getExamEntrySheet" as never,
    isSheetReady
      ? ({
          schoolId,
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
    }) => (await upsertAssessmentRecordsBulk({ schoolId, ...args } as never)) as UpsertResponse,
    [schoolId, upsertAssessmentRecordsBulk]
  );

  const normalizedSessions = useMemo(
    () => normalizeSelectorOptions(sessions) ?? [],
    [sessions]
  );
  const normalizedClasses = useMemo(
    () => normalizeSelectorOptions(classes) ?? [],
    [classes]
  );

  if (selection.classId && selection.sessionId && entryMode === undefined) return <p role="status">Checking reporting mode...</p>;
  if (entryMode?.mode === "narrative") return entryMode.canEnterNarrative
    ? <LiveNarrativeEntry selection={selection} schoolId={schoolId} />
    : <p role="alert" className="p-6">Subject comments are unavailable for your account or this class. Ask a school admin to check your report preview permission and class assignment.</p>;
  return (
    <ExamEntryWorkspace
      selection={selection}
      sessions={normalizedSessions}
      terms={terms ?? []}
      classes={normalizedClasses}
      subjects={subjects ?? []}
      sheetData={sheetData}
      isLoadingSheet={isSheetReady && sheetData === undefined}
      isLoadingSessions={sessions === undefined}
      isLoadingTerms={Boolean(selection.sessionId) && terms === undefined}
      isLoadingClasses={classes === undefined}
      isLoadingSubjects={isSelectedClassAssigned && subjects === undefined}
      subjectUnavailable={subjectUnavailable}
      onSaveRecords={handleSaveRecords}
    />
  );
}

function MockExamEntryPage({ selection }: { selection: SelectionState }) {
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
  }, [selection.classId, selection.sessionId, selection.subjectId, selection.termId]);

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
    <ExamEntryWorkspace
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
