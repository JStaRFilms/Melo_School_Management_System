"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { buildReportCardHref } from "@school/shared";
import { ExtrasSelectionBar } from "./components/ExtrasSelectionBar";
import { ExtrasWorkspace } from "./components/ExtrasWorkspace";
import type { ExtrasEntry, ExtrasSelection, SelectorOption } from "./components/types";

export default function AdminReportCardExtrasPage() {
  const searchParams = useSearchParams();
  const selection = useMemo<ExtrasSelection>(() => ({ sessionId: searchParams.get("sessionId"), termId: searchParams.get("termId"), classId: searchParams.get("classId"), studentId: searchParams.get("studentId") }), [searchParams]);

  const rawSessions = useQuery(
    "functions/academic/adminSelectors:getAdminSessions" as never
  ) as SelectorOption[] | undefined;
  const rawTerms = useQuery("functions/academic/adminSelectors:getTermsBySession" as never, selection.sessionId ? ({ sessionId: selection.sessionId } as never) : ("skip" as never)) as SelectorOption[] | undefined;
  const rawClasses = useQuery("functions/academic/adminSelectors:getAllClasses" as never) as SelectorOption[] | undefined;
  const sessions = rawSessions ?? [];
  const terms = rawTerms ?? [];
  const classes = rawClasses ?? [];

  const classIsValid = !selection.classId || classes.some((option) => option.id === selection.classId);
  const rawStudents = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    selection.sessionId && selection.termId && selection.classId && classIsValid
      ? ({ sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId } as never)
      : ("skip" as never)
  ) as Array<{ studentId: string; studentName: string; admissionNumber: string }> | undefined;
  const students = rawStudents?.map((student) => ({ id: student.studentId, name: `${student.studentName} (${student.admissionNumber})` })) ?? [];
  const studentIsValid = !selection.studentId || students.some((option) => option.id === selection.studentId);

  const entry = useQuery("functions/academic/reportCardExtras:getStudentReportCardExtrasEntry" as never, selection.sessionId && selection.termId && selection.classId && selection.studentId && classIsValid && studentIsValid ? ({ sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId, studentId: selection.studentId } as never) : ("skip" as never)) as ExtrasEntry | undefined;
  const saveEntry = useMutation("functions/academic/reportCardExtras:saveStudentReportCardExtrasEntry" as never);

  const reportCardHref = buildReportCardHref({
    studentId: selection.studentId,
    sessionId: selection.sessionId,
    termId: selection.termId,
    classId: selection.classId,
  });
  const hasSelection = Boolean(selection.sessionId && selection.termId && selection.classId && selection.studentId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <ExtrasSelectionBar
        selection={selection}
        sessions={sessions}
        terms={terms}
        classes={classes}
        students={students}
        isLoadingSessions={rawSessions === undefined}
        isLoadingTerms={Boolean(selection.sessionId) && rawTerms === undefined}
        isLoadingClasses={rawClasses === undefined}
        isLoadingStudents={Boolean(selection.classId && selection.sessionId && selection.termId) && rawStudents === undefined}
      />
      <ExtrasWorkspace
        entry={entry}
        isLoading={hasSelection && entry === undefined && students.length > 0}
        hasSelection={hasSelection}
        hasStudents={students.length > 0}
        reportCardHref={reportCardHref}
        onSave={(bundleValues) =>
          saveEntry({ ...(selection as Required<ExtrasSelection>), bundleValues } as never)
        }
      />
    </div>
  );
}
