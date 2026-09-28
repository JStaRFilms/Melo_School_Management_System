"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ReportCardBatchNavigator,
  ReportCardBatchPrintStackV2,
  ReportCardPreview,
  ReportCardToolbar,
  ReportCardPrintBlockedNotice,
  ReportScoringPrintWarning,
  buildReportCardExtrasHref,
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

function hasIncompleteCumulativeResults(reportCard: ReportCardSheetData) {
  return (
    reportCard.resultCalculationMode === "cumulative_annual" &&
    reportCard.results.some(
      (result) =>
        result.calculationMode === "cumulative_annual" &&
        result.isCumulativeComplete === false
    )
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
  const printRaf1Ref = useRef<number | null>(null);
  const printRaf2Ref = useRef<number | null>(null);
  const [printWarning, setPrintWarning] = useState<
    { kind: "single" | "batch"; context: string; message: string } | null
  >(null);
  const printedBatchRef = useRef<string | null>(null);

  const reportCard = useQuery(
    "functions/academic/reportCards:getStudentReportCard" as never,
    studentId && sessionId && termId
      ? ({
          studentId,
          sessionId,
          termId,
          ...(classIdParam ? { classId: classIdParam } : {}),
        } as never)
      : ("skip" as never)
  ) as ReportCardSheetData | undefined;
  const resolvedClassId = classIdParam ?? reportCard?.classId ?? null;
  const extrasHref = buildReportCardExtrasHref({
    studentId,
    sessionId,
    termId,
    classId: resolvedClassId,
  });
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
  const blockedClassPrintCount =
    classReportCards?.filter(hasIncompleteCumulativeResults).length ?? 0;
  const isClassPrintBlocked = blockedClassPrintCount > 0;
  const batchWarning = classReportCards?.find(card => card.scoringPolicyWarning)?.scoringPolicyWarning ?? null;
  const batchContext = `${sessionId}:${termId}:${resolvedClassId}:${studentId}`;
  const batchPrintStateRef = useRef({ context: batchContext, ready: false });
  const isBatchReady = isPrintClassMode && !isClassPrintBlocked && Boolean(classReportCards && reportCard?.student._id === studentId);
  useLayoutEffect(() => {
    batchPrintStateRef.current = { context: batchContext, ready: isBatchReady };
  }, [batchContext, isBatchReady]);
  const scheduleBatchPrint = useCallback((expectedContext: string) => {
    if (printRaf1Ref.current !== null) cancelAnimationFrame(printRaf1Ref.current);
    if (printRaf2Ref.current !== null) cancelAnimationFrame(printRaf2Ref.current);
    printRaf1Ref.current = requestAnimationFrame(() => {
      printRaf1Ref.current = null;
      if (batchPrintStateRef.current.context !== expectedContext || !batchPrintStateRef.current.ready) return;
      printRaf2Ref.current = requestAnimationFrame(() => {
        printRaf2Ref.current = null;
        if (batchPrintStateRef.current.context !== expectedContext || !batchPrintStateRef.current.ready) return;
        printedBatchRef.current = expectedContext;
        window.print();
      });
    });
  }, []);
  const handleSinglePrint = () => {
    if (reportCard?.student._id !== studentId) return;
    if (reportCard.scoringPolicyWarning) {
      setPrintWarning({ kind: "single", context: studentId, message: reportCard.scoringPolicyWarning });
    } else window.print();
  };

  const exitFullClassPrint = useCallback(() => {
    const params = new URLSearchParams(searchParamsString);
    params.delete("printClass");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParamsString]);

  const handleSelectStudent = useCallback(
    (nextStudentId: string) => {
      setPrintWarning(null);
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
    [pathname, resolvedClassId, router, searchParamsString, setPrintWarning]
  );

  const handlePrintFullClass = useCallback(() => {
    const params = new URLSearchParams(searchParamsString);
    if (resolvedClassId) {
      params.set("classId", resolvedClassId);
    }
    params.set("printClass", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, resolvedClassId, router, searchParamsString]);

  const handleBatchReady = useCallback(() => {
    if (
      !isPrintClassMode ||
      isClassPrintBlocked ||
      hasTriggeredClassPrintRef.current
    ) {
      return;
    }

    hasTriggeredClassPrintRef.current = true;
    if (batchWarning) {
      setPrintWarning({ kind: "batch", context: batchContext, message: batchWarning });
      return;
    }
    scheduleBatchPrint(batchContext);
  }, [isPrintClassMode, isClassPrintBlocked, batchWarning, batchContext, scheduleBatchPrint, setPrintWarning]);

  // A queued frame must not print a different batch after navigation.
  useEffect(() => {
    hasTriggeredClassPrintRef.current = false;
    printedBatchRef.current = null;
    setPrintWarning(null);
    return () => {
      if (printRaf1Ref.current !== null) cancelAnimationFrame(printRaf1Ref.current);
      if (printRaf2Ref.current !== null) cancelAnimationFrame(printRaf2Ref.current);
      printRaf1Ref.current = null;
      printRaf2Ref.current = null;
    };
  }, [isPrintClassMode, batchContext]);

  // Handle afterprint to exit batch mode
  useEffect(() => {
    if (!isPrintClassMode) return;

    const handleAfterPrint = () => {
      if (printedBatchRef.current !== batchContext) return;
      printedBatchRef.current = null;
      exitFullClassPrint();
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [isPrintClassMode, exitFullClassPrint, batchContext]);

  if (!studentId || !sessionId || !termId) {
    return (
      <div className="mx-auto px-4 py-6 md:px-6" style={{ maxWidth: "210mm" }}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Select a student, session, and term before opening a report card.
        </div>
      </div>
    );
  }

  if (reportCard === undefined) {
    return (
      <div className="mx-auto px-4 py-6 md:px-6" style={{ maxWidth: "210mm" }}>
        <div className="text-slate-500">Loading report card...</div>
      </div>
    );
  }

  if (isPrintClassMode) {
    return (
      <>
        {printWarning?.kind === "batch" && printWarning.context === batchContext && (
          <ReportScoringPrintWarning
            message={printWarning.message}
            onCancel={() => { setPrintWarning(null); exitFullClassPrint(); }}
            onContinue={() => {
              setPrintWarning(null);
              if (batchPrintStateRef.current.context === batchContext && batchPrintStateRef.current.ready) {
                scheduleBatchPrint(batchContext);
              }
            }}
          />
        )}
        <div className="rc-no-print mx-auto px-4 py-6 md:px-6" style={{ maxWidth: "210mm" }}>
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
                  : isClassPrintBlocked
                    ? `Printing is blocked for ${blockedClassPrintCount} student report card${blockedClassPrintCount === 1 ? "" : "s"} with incomplete cumulative annual data.`
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
        {classReportCards === undefined ? null : isClassPrintBlocked ? (
          <div className="rc-no-print mx-auto px-4 pb-6 md:px-6" style={{ maxWidth: "210mm" }}>
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
              Full-class print is blocked until an admin backfills the missing prior-term totals for every cumulative report card in this class.
            </div>
          </div>
        ) : (
          <ReportCardBatchPrintStackV2
            reportCards={classReportCards}
            backHref="/assessments/exams/entry"
            onReady={handleBatchReady}
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
        extrasHref={extrasHref}
        onSelectStudent={handleSelectStudent}
        onPrintFullClass={handlePrintFullClass}
      />
      {printWarning?.kind === "single" && printWarning.context === studentId && (
        <ReportScoringPrintWarning
          message={printWarning.message}
          onCancel={() => setPrintWarning(null)}
          onContinue={() => {
            setPrintWarning(null);
            if (printWarning.context === studentId && reportCard.student._id === studentId) window.print();
          }}
        />
      )}
      {reportCard.scoringPolicyWarning && <div className="rc-no-print rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{reportCard.scoringPolicyWarning}</div>}
      <ReportCardToolbar
        onPrint={handleSinglePrint}
        studentName={reportCard.student.name}
        backHref="/assessments/exams/entry"
      />
      {hasIncompleteCumulativeResults(reportCard) && (
        <ReportCardPrintBlockedNotice />
      )}
      <ReportCardPreview
        reportCard={reportCard}
        backHref="/assessments/exams/entry"
        hideToolbar
      />
    </>
  );
}

function ReportCardPageFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto px-4 py-6 md:px-6" style={{ maxWidth: "210mm" }}>
      <div className="text-slate-500">{message}</div>
    </div>
  );
}
