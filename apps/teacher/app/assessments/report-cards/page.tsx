"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ReportCardSheet,
  type ReportCardSheetData,
} from "@school/shared";

export default function TeacherReportCardPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");

  const reportCard = useQuery(
    "functions/academic/reportCards:getStudentReportCard" as never,
    studentId && sessionId && termId
      ? ({ studentId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardSheetData | undefined;

  if (!studentId || !sessionId || !termId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Select a student, session, and term before opening a report card.
        </div>
      </div>
    );
  }

  if (reportCard === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <div className="text-slate-500">Loading report card...</div>
      </div>
    );
  }

  return (
    <ReportCardSheet
      reportCard={reportCard}
      backHref="/assessments/exams/entry"
    />
  );
}
