"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ReportCardBatchNavigator,
  ReportCardPrintStack,
  ReportCardSheet,
  type ReportCardBatchStudent,
  type ReportCardSheetData,
} from "@school/shared";

export default function TeacherReportCardPage() {
  return (
    <Suspense fallback={<ReportCardPageFallback message="Loading report card..." />}>
      <TeacherReportCardPageContent />
    </Suspense>
  );
}

function TeacherReportCardPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");
  const classIdParam = searchParams.get("classId");
  const isPrintClassMode = searchParams.get("printClass") === "1";
  const searchParamsString = searchParams.toString();
  const hasTriggeredClassPrintRef = useRef(false);

  const reportCard = useQuery(
    "functions/academic/reportCards:getStudentReportCard" as never,
    studentId && sessionId && termId
      ? ({ studentId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardSheetData | undefined;
  const resolvedClassId = classIdParam ?? reportCard?.classId ?? null;
  const batchStudents = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    sessionId && termId && resolvedClassId
      ? ({ classId: resolvedClassId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardBatchStudent[] | undefined;
  const classReportCards = useQuery(
    "functions/academic/reportCards:getClassReportCards" as never,
    isPrintClassMode && sessionId && termId && resolvedClassId
      ? ({ classId: resolvedClassId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardSheetData[] | undefined;

  const exitFullClassPrint = useCallback(() => {
    const params = new URLSearchParams(searchParamsString);
    params.delete("printClass");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParamsString]);

  const handleSelectStudent = useCallback(
    (nextStudentId: string) => {
      const params = new URLSearchParams(searchParamsString);
      params.set("studentId", nextStudentId);
      if (resolvedClassId) {
        params.set("classId", resolvedClassId);
      }
      params.delete("printClass");
      router.push(`${pathname}?${params.toString()}`);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [pathname, resolvedClassId, router, searchParamsString]
  );

  const handlePrintFullClass = useCallback(() => {
    const params = new URLSearchParams(searchParamsString);
    if (resolvedClassId) {
      params.set("classId", resolvedClassId);
    }
    params.set("printClass", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, resolvedClassId, router, searchParamsString]);

  useEffect(() => {
    hasTriggeredClassPrintRef.current = false;
  }, [isPrintClassMode, resolvedClassId, sessionId, termId]);

  useEffect(() => {
    if (
      !isPrintClassMode ||
      classReportCards === undefined ||
      classReportCards.length === 0 ||
      hasTriggeredClassPrintRef.current
    ) {
      return;
    }

    hasTriggeredClassPrintRef.current = true;
    const timer = window.setTimeout(() => {
      window.print();
    }, 80);

    const handleAfterPrint = () => {
      exitFullClassPrint();
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [classReportCards, exitFullClassPrint, isPrintClassMode]);

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

  if (isPrintClassMode) {
    return (
      <>
        <div className="rc-no-print mx-auto max-w-5xl px-4 py-6 md:px-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Full Class Print
              </p>
              <h1 className="mt-1 text-lg font-extrabold text-slate-900">
                {reportCard.className}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {classReportCards === undefined
                  ? "Preparing every student report card for print..."
                  : `Opening print for ${classReportCards.length} student${classReportCards.length === 1 ? "" : "s"}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={exitFullClassPrint}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
        {classReportCards === undefined ? null : (
          <ReportCardPrintStack
            reportCards={classReportCards}
            backHref="/assessments/exams/entry"
          />
        )}
      </>
    );
  }

  return (
    <>
      <ReportCardBatchNavigator
        students={batchStudents ?? []}
        activeStudentId={studentId}
        className={reportCard.className}
        sessionName={reportCard.sessionName}
        termName={reportCard.termName}
        isLoading={Boolean(resolvedClassId) && batchStudents === undefined}
        isPrintingFullClass={isPrintClassMode}
        onSelectStudent={handleSelectStudent}
        onPrintFullClass={handlePrintFullClass}
      />
      <ReportCardSheet
        reportCard={reportCard}
        backHref="/assessments/exams/entry"
      />
    </>
  );
}

function ReportCardPageFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="text-slate-500">{message}</div>
    </div>
  );
}
