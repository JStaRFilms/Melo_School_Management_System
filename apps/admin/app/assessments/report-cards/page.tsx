"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import { ZoomIn, ZoomOut } from "lucide-react";
import { ReportCardAdminPanel } from "./components/ReportCardAdminPanel";
import { ReportCardLauncher } from "./components/ReportCardLauncher";

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
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const touchStartDistanceRef = useRef<number | null>(null);
  const initialTouchScaleRef = useRef<number>(0.75);

  const [previewScale, setPreviewScale] = useState<number>(0.75);

  const calculateFitScale = useCallback(() => {
    if (typeof window === "undefined") return 0.65;
    const A4_WIDTH_PX = 794;
    const A4_HEIGHT_PX = 1123;

    if (!mainContainerRef.current) {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const scaleW = (screenW - 32) / A4_WIDTH_PX;
      const scaleH = (screenH - 120) / A4_HEIGHT_PX;
      return Math.max(0.3, Math.min(1.2, Number(Math.min(scaleW, scaleH).toFixed(2))));
    }

    const containerWidth = mainContainerRef.current.clientWidth;
    const containerHeight = mainContainerRef.current.clientHeight;

    const paddingX = window.innerWidth < 640 ? 16 : 48;
    const paddingY = window.innerWidth < 640 ? 24 : 48;

    const availableWidth = Math.max(240, containerWidth - paddingX);
    const availableHeight = Math.max(300, containerHeight - paddingY);

    const scaleW = availableWidth / A4_WIDTH_PX;
    const scaleH = availableHeight / A4_HEIGHT_PX;

    // True "Fit to Screen": fits the complete sheet inside the viewport
    const fit = Math.min(scaleW, scaleH);
    return Math.max(0.3, Math.min(1.2, Number(fit.toFixed(2))));
  }, []);

  // Auto-fit on mount and screen resize
  useEffect(() => {
    const handleResize = () => {
      setPreviewScale(calculateFitScale());
    };
    const timer = window.setTimeout(() => {
      setPreviewScale(calculateFitScale());
    }, 60);
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateFitScale]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistanceRef.current = dist;
      initialTouchScaleRef.current = previewScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistanceRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / touchStartDistanceRef.current;
      const nextScale = Math.min(
        1.5,
        Math.max(0.3, Number((initialTouchScaleRef.current * ratio).toFixed(2)))
      );
      setPreviewScale(nextScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistanceRef.current = null;
  };

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
  ) as ReportCardSheetData | undefined | null;
  const resolvedClassId = classIdParam ?? (reportCard && typeof reportCard === 'object' ? reportCard.classId : null) ?? null;
  
  const batchStudents = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    sessionId && termId && resolvedClassId
      ? ({ classId: resolvedClassId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardBatchStudent[] | undefined;

  const classReportCards = useQuery(
    "functions/academic/reportCards:getStudentsForClassReportCardBatch" as never,
    isPrintClassMode && sessionId && termId && resolvedClassId
      ? ({ classId: resolvedClassId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardSheetData[] | undefined;

  const handleSelectStudent = (nextStudentId: string) => {
    const params = new URLSearchParams(searchParamsString);
    params.set("studentId", nextStudentId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handlePrintFullClass = () => {
    const params = new URLSearchParams(searchParamsString);
    params.set("printClass", "1");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const exitFullClassPrint = () => {
    const params = new URLSearchParams(searchParamsString);
    params.delete("printClass");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleBatchReady = () => {
    if (hasTriggeredClassPrintRef.current) return;
    hasTriggeredClassPrintRef.current = true;
    window.setTimeout(() => {
      window.print();
    }, 250);
  };

  if (!studentId || !sessionId || !termId) {
    return <ReportCardLauncher />;
  }

  if (reportCard === undefined) {
    return <ReportCardPageFallback message="Loading student report card..." />;
  }

  if (reportCard === null) {
    return (
      <div className="mx-auto px-4 py-8 md:px-6" style={{ maxWidth: "210mm" }}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-amber-900">Report Card Not Found</h2>
          <p className="mt-2 text-sm text-amber-800">
            No published results or enrollment record was found for this student.
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href="/assessments/report-cards"
              className="rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Select another student
            </a>
            <Link
              href={`/assessments/report-cards/backfill?sessionId=${sessionId}&classId=${resolvedClassId}`}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-950"
            >
              Run historical backfill
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const baseReturnTo = searchParams.get("returnTo");
  const fallbackBackHref = `/assessments/report-cards?sessionId=${sessionId}&termId=${termId}&classId=${resolvedClassId ?? ""}`;
  const backHref = baseReturnTo ? decodeURIComponent(baseReturnTo) : fallbackBackHref;

  if (isPrintClassMode) {
    return (
      <>
        {classReportCards === undefined ? (
          <ReportCardPageFallback message="Preparing full class batch print..." />
        ) : classReportCards.length === 0 ? (
          <div className="mx-auto px-4 py-8 md:px-6" style={{ maxWidth: "210mm" }}>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900">No students available to print</h2>
              <p className="mt-2 text-sm text-slate-600">
                This class does not contain students with generated report cards for this term.
              </p>
              <button
                type="button"
                onClick={exitFullClassPrint}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Go back
              </button>
            </div>
          </div>
        ) : (
          <ReportCardBatchPrintStackV2
            reportCards={classReportCards}
            backHref={backHref}
            onReady={handleBatchReady}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-full lg:h-full lg:min-h-0 flex flex-col bg-slate-100/60">
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden lg:min-h-0">
        {/* Sidebar Bucket - Management & Navigation */}
        <aside className="w-full lg:w-[460px] lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white custom-scrollbar flex flex-col lg:order-1 pt-4 sm:pt-6 pb-6 lg:pb-24 shrink-0">
          <div className="space-y-6 lg:space-y-8 px-4 sm:px-5 pb-6 lg:pb-44">
            <div className="space-y-4">
              <ReportCardBatchNavigator
                students={batchStudents ?? []}
                activeStudentId={studentId}
                className={reportCard.className}
                sessionName={reportCard.sessionName}
                termName={reportCard.termName}
                isLoading={Boolean(resolvedClassId) && batchStudents === undefined}
                isPrintingFullClass={isPrintClassMode}
                extrasHref={buildReportCardExtrasHref({ studentId, sessionId, termId, classId: resolvedClassId })}
                onSelectStudent={handleSelectStudent}
                onPrintFullClass={handlePrintFullClass}
              />
            </div>
            
            <div className="pt-6 border-t border-slate-100">
              <ReportCardAdminPanel
                studentId={studentId}
                sessionId={sessionId}
                termId={termId}
                reportCard={reportCard}
              />
            </div>
          </div>
        </aside>

        {/* Main Content Area - Locked Top Header + Separate Canvas Viewport */}
        <main className="flex-1 min-h-[500px] lg:min-h-0 lg:h-full flex flex-col overflow-hidden lg:order-2 bg-slate-100/70">
          {/* Pinned Top Toolbar */}
          <div className="shrink-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-[1400px] mx-auto w-full">
              <div className="flex-1 min-w-0">
                <ReportCardToolbar
                  studentName={reportCard.student.name}
                  backHref={backHref}
                />
              </div>

              {/* In-Canvas Zoom Bar */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl p-1 shadow-2xs text-xs font-bold text-slate-700 self-end sm:self-auto shrink-0 rc-no-print">
                <button
                  type="button"
                  onClick={() => setPreviewScale((prev) => Math.max(0.3, Number((prev - 0.1).toFixed(2))))}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200/80 flex items-center justify-center text-slate-600 transition-colors active:scale-95"
                  title="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="w-12 text-center text-[11px] tabular-nums font-black text-slate-800">
                  {Math.round(previewScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewScale((prev) => Math.min(1.5, Number((prev + 0.1).toFixed(2))))}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200/80 flex items-center justify-center text-slate-600 transition-colors active:scale-95"
                  title="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
                <div className="h-4 w-px bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setPreviewScale(calculateFitScale())}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-200/80 text-[10px] uppercase font-black tracking-wider text-slate-700 transition-colors active:scale-95"
                  title="Fit full page to viewport"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewScale(1.0)}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-200/80 text-[10px] uppercase font-black tracking-wider text-slate-700 transition-colors active:scale-95"
                  title="100% original size"
                >
                  100%
                </button>
              </div>
            </div>
          </div>

          {/* Dedicated Canvas Viewport (Scrollable in all directions when zoomed in) */}
          <div
            ref={mainContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 min-h-0 overflow-auto custom-scrollbar p-4 sm:p-6 lg:p-8 flex items-start justify-center touch-pan-x touch-pan-y"
          >
            <div className="my-auto py-4 flex flex-col items-center max-w-full">
              {hasIncompleteCumulativeResults(reportCard) && (
                <div className="mb-4 w-full max-w-[794px]">
                  <ReportCardPrintBlockedNotice />
                </div>
              )}

              <ReportCardPreview
                reportCard={reportCard}
                backHref={backHref}
                previewScale={previewScale}
                hideToolbar
              />
            </div>
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
