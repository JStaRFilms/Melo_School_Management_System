"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ReportCardBatchNavigator,
  ReportCardBatchPrintStackV2,
  ReportCardPreview,
  ReportCardToolbar,
  ReportCardPrintBlockedNotice,
  buildReportCardExtrasHref,
  type ReportCardBatchStudent,
  type ReportCardSheetData,
} from "@school/shared";
import { ReportCardAdminPanel } from "./components/ReportCardAdminPanel";

export default function AdminReportCardPage() {
  return (
    <Suspense fallback={<ReportCardPageFallback message="Loading report card..." />}>
      <AdminReportCardPageContent />
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

function AdminReportCardPageContent() {
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

  const handleBatchReady = useCallback(() => {
    if (
      !isPrintClassMode ||
      isClassPrintBlocked ||
      hasTriggeredClassPrintRef.current
    ) {
      return;
    }

    hasTriggeredClassPrintRef.current = true;
    // requestAnimationFrame ensures layout has fully settled
    requestAnimationFrame(() => {
      window.print();
    });
  }, [isPrintClassMode, isClassPrintBlocked]);

  // Reset the print trigger guard when context changes
  useEffect(() => {
    hasTriggeredClassPrintRef.current = false;
  }, [isPrintClassMode, resolvedClassId, sessionId, termId]);

  // Handle afterprint to exit batch mode
  useEffect(() => {
    if (!isPrintClassMode) return;

    const handleAfterPrint = () => {
      exitFullClassPrint();
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [isPrintClassMode, exitFullClassPrint]);

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
              <p>Full-class print is blocked until the missing prior-term totals are backfilled for every cumulative report card in this class.</p>
              <Link
                href={`/assessments/report-cards/backfill?sessionId=${sessionId}&classId=${resolvedClassId}`}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-rose-950 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-rose-800"
              >
                Open historical backfill
              </Link>
            </div>
          </div>
        ) : (
          <ReportCardBatchPrintStackV2
            reportCards={classReportCards}
            backHref="/assessments/results/entry"
            onReady={handleBatchReady}
          />
        )}
      </>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Sidebar Bucket - Management & Navigation */}
        <aside className="lg:w-[460px] lg:h-full lg:overflow-y-auto border-r border-slate-200/60 bg-white custom-scrollbar flex flex-col lg:order-1 pt-6 pb-10">
          <div className="space-y-8">
            <div className="space-y-4 px-5">
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
            </div>

            <div className="pt-6 border-t border-slate-100 px-5">
              <ReportCardAdminPanel
                studentId={studentId}
                sessionId={sessionId}
                termId={termId}
                reportCard={reportCard}
              />
            </div>
          </div>
        </aside>

        {/* Main Content Bucket - The Report Card Sheet */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-2.5 sm:p-4 lg:p-12 lg:order-2">
          <div className="mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <ReportCardToolbar
              studentName={reportCard.student.name}
              backHref="/assessments/results/entry"
            />
            {hasIncompleteCumulativeResults(reportCard) && (
              <ReportCardPrintBlockedNotice />
            )}
            <ReportCardPreview
              reportCard={reportCard}
              backHref="/assessments/results/entry"
              hideToolbar
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function ReportCardPageFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto px-4 py-6 md:px-6" style={{ maxWidth: "210mm" }}>
      <div className="text-slate-500">{message}</div>
    </div>
  );
}
