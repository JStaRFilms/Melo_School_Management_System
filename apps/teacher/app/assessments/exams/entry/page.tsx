"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ExamEntryWorkspace } from "./components/ExamEntryWorkspace";
import { isConvexConfigured } from "@/lib/convex-runtime";
import {
  getMockSheet,
  mockClasses,
  mockSessions,
  mockSubjectsByClass,
  mockTermsBySession,
} from "@/lib/mock-exam-data";
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

  if (!isConvexConfigured) {
    return <MockExamEntryPage selection={selection} />;
  }

  return <LiveExamEntryPage selection={selection} />;
}

function LiveExamEntryPage({ selection }: { selection: SelectionState }) {
  const isSheetReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.subjectId
  );

  const sessions = useQuery(
    "functions/academic/teacherSelectors:getTeacherSessions" as never
  ) as LegacySelectorOption[] | undefined;
  const terms = useQuery(
    "functions/academic/teacherSelectors:getTermsBySession" as never,
    selection.sessionId
      ? ({ sessionId: selection.sessionId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const classes = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never
  ) as LegacySelectorOption[] | undefined;
  const subjects = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableSubjectsByClass" as never,
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
    }) => (await upsertAssessmentRecordsBulk(args as never)) as UpsertResponse,
    [upsertAssessmentRecordsBulk]
  );

  const normalizedSessions = useMemo(
    () => normalizeSelectorOptions(sessions) ?? [],
    [sessions]
  );
  const normalizedClasses = useMemo(
    () => normalizeSelectorOptions(classes) ?? [],
    [classes]
  );

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
      isLoadingSubjects={Boolean(selection.classId) && subjects === undefined}
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
