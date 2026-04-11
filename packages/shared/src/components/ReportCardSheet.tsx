"use client";

export type ReportCardSheetData = {
  schoolName: string;
  schoolAddress?: string | null;
  schoolContact?: string | null;
  schoolLogoUrl?: string | null;
  schoolMotto?: string | null;
  sessionName: string;
  termName: string;
  classId: string;
  className: string;
  generatedAt: number;
  assessmentConfig: {
    ca1Max: number;
    ca2Max: number;
    ca3Max: number;
    examMax: number;
  };
  resultCalculationMode?: "standalone" | "cumulative_annual";
  student: {
    _id: string;
    name: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    admissionNumber: string;
    gender: string | null;
    dateOfBirth: number | null;
    guardianName: string | null;
    guardianPhone: string | null;
    address: string | null;
    houseName: string | null;
    nextTermBegins: number | null;
    photoUrl: string | null;
  };
  summary: {
    totalSubjects: number;
    recordedSubjects: number;
    pendingSubjects: number;
    averageScore: number | null;
    totalScore: number;
  };
  results: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    ca1: number | null;
    ca2: number | null;
    ca3: number | null;
    examScore: number | null;
    total: number;
    gradeLetter: string;
    remark: string;
    isRecorded: boolean;
    calculationMode?: "standalone" | "cumulative_annual";
    currentTermTotal?: number | null;
    firstTermTotal?: number | null;
    secondTermTotal?: number | null;
    annualAverage?: number | null;
    isCumulativeComplete?: boolean;
    missingHistoricalTerms?: Array<"first" | "second" | "current">;
  }>;
  extras?: Array<{
    bundleId: string;
    bundleName: string;
    sections: Array<{
      sectionId: string;
      sectionLabel: string;
      items: Array<{
        fieldId: string;
        label: string;
        type: "text" | "number" | "boolean" | "scale";
        printValue: string | null;
      }>;
    }>;
  }>;
  classTeacherName?: string | null;
  classTeacherComment?: string | null;
  headTeacherComment?: string | null;
};

function formatDate(
  value: number | null,
  options?: Intl.DateTimeFormatOptions
) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(value));
}

function formatScore(value: number | null) {
  if (value === null) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

type ReportCardResult = ReportCardSheetData["results"][number];

export function isIncompleteCumulativeResult(result: ReportCardResult) {
  return (
    result.calculationMode === "cumulative_annual" &&
    result.isCumulativeComplete === false
  );
}

export function hasIncompleteCumulativeResults(reportCard: ReportCardSheetData) {
  return (
    reportCard.resultCalculationMode === "cumulative_annual" &&
    reportCard.results.some((result) => isIncompleteCumulativeResult(result))
  );
}

function getResultGradeDisplay(result: ReportCardResult) {
  return isIncompleteCumulativeResult(result) ? "—" : result.gradeLetter;
}

function getResultRemarkDisplay(result: ReportCardResult) {
  return isIncompleteCumulativeResult(result)
    ? "Pending prior-term scores"
    : result.remark;
}

function buildInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#065f46";
    case "B":
      return "#1e40af";
    case "C":
      return "#92400e";
    case "D":
      return "#9a3412";
    case "E":
    case "F":
      return "#991b1b";
    default:
      return "#64748b";
  }
}

/* ─── Inline print styles (injected once) ─── */
const PRINT_STYLE_ID = "report-card-print-styles";
const A4_PAGE_WIDTH_MM = 210;
const A4_PAGE_HEIGHT_MM = 297;
const PRINT_PAGE_MARGIN_MM = 10;
const PX_PER_MM = 96 / 25.4;
const PRINT_TARGET_WIDTH_PX = Math.round(
  (A4_PAGE_WIDTH_MM - PRINT_PAGE_MARGIN_MM * 2) * PX_PER_MM
);
const PRINT_TARGET_HEIGHT_PX = Math.round(
  (A4_PAGE_HEIGHT_MM - PRINT_PAGE_MARGIN_MM * 2) * PX_PER_MM
);

function ensurePrintStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PRINT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      html, body { 
        margin: 0 !important; 
        padding: 0 !important; 
        background: white !important; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      .rc-no-print { display: none !important; }
      .rc-print-root { 
        width: 100% !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        display: block !important; 
      }
      /* Reset wrapper for print */
      .rc-sheet-wrapper { 
        width: 100% !important; 
        height: auto !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        background: white !important; 
        border: none !important;
        box-shadow: none !important;
        display: block !important;
        overflow: visible !important;
      }
      /* Reset sheet for print */
      .rc-sheet { 
        width: 100% !important; 
        max-width: 100% !important; 
        margin: 0 !important; 
        border: none !important; 
        box-shadow: none !important; 
      }
      .rc-sheet * { 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      .rc-sheet,
      .rc-sheet-wrapper {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .rc-stack-item { 
        break-after: page; 
        page-break-after: always; 
        margin: 0 !important; 
      }
      .rc-stack-item:last-child { 
        break-after: auto; 
        page-break-after: auto; 
      }
    }
  `;
  document.head.appendChild(style);
}

/* ─── Component ─── */

import React, { useRef, useEffect, useState } from "react";

export function ReportCardSheet({
  reportCard,
  backHref,
  hideToolbar = false,
}: {
  reportCard: ReportCardSheetData;
  backHref: string;
  hideToolbar?: boolean;
}) {
  if (typeof window !== "undefined") ensurePrintStyles();

  const [scale, setScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      const element = contentRef.current;
      if (!element) return;

      const previousZoom = element.style.zoom;
      element.style.zoom = "1";
      const scrollHeight = element.scrollHeight;
      const scrollWidth = element.scrollWidth;
      element.style.zoom = previousZoom;

      if (!scrollHeight || !scrollWidth) return;

      const heightScale = PRINT_TARGET_HEIGHT_PX / scrollHeight;
      const widthScale = PRINT_TARGET_WIDTH_PX / scrollWidth;
      const nextScale = Math.min(1, heightScale, widthScale);

      setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updateScale();

    const timer = window.setTimeout(updateScale, 120);
    const handleBeforePrint = () => updateScale();
    const handleResize = () => updateScale();

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && contentRef.current) {
      resizeObserver = new ResizeObserver(() => updateScale());
      resizeObserver.observe(contentRef.current);
    }

    const fonts = document.fonts;
    if (fonts?.ready) {
      void fonts.ready.then(updateScale).catch(() => undefined);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [reportCard]);

  const schoolInitials = buildInitials(reportCard.schoolName);
  const ac = reportCard.assessmentConfig;
  const hasBlockingCumulativePrint = hasIncompleteCumulativeResults(reportCard);

  /* ─── Info rows data ─── */
  const leftFields = [
    { label: "Name", value: reportCard.student.name },
    { label: "Reg. No.", value: reportCard.student.admissionNumber },
    { label: "Class", value: reportCard.className },
    { label: "Session", value: reportCard.sessionName },
    { label: "Term", value: reportCard.termName },
  ];

  const rightFields = [
    {
      label: "House",
      value: reportCard.student.houseName ?? "-",
    },
    {
      label: "Next Term Begins",
      value: formatDate(reportCard.student.nextTermBegins, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    },
    {
      label: "Average",
      value:
        reportCard.summary.averageScore === null
          ? "0.00"
          : reportCard.summary.averageScore.toFixed(2),
    },
    {
      label: "Total",
      value: reportCard.summary.totalScore.toFixed(2),
    },
  ];
  const extras = reportCard.extras ?? [];

  return (
    <div className="rc-print-root" style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
      {/* ─── Toolbar (hidden during print) ─── */}
      {hideToolbar ? null : (
      <div
        className="rc-no-print"
        style={{
          maxWidth: "210mm",
          margin: "0 auto",
          padding: "16px 8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#94a3b8",
              margin: 0,
            }}
          >
            Report Card
          </p>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#0f172a",
              margin: "2px 0 0",
              letterSpacing: "-0.02em",
            }}
          >
            {reportCard.student.name}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={backHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 13,
              fontWeight: 600,
              color: "#475569",
              textDecoration: "none",
              background: "white",
            }}
          >
            Back
          </a>
          <button
            type="button"
            disabled={hasBlockingCumulativePrint}
            onClick={() => window.print()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 36,
              padding: "0 20px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              color: "white",
              background: hasBlockingCumulativePrint ? "#94a3b8" : "#0f172a",
              cursor: hasBlockingCumulativePrint ? "not-allowed" : "pointer",
              opacity: hasBlockingCumulativePrint ? 0.9 : 1,
            }}
          >
            {hasBlockingCumulativePrint ? "Print blocked" : "Export / Print"}
          </button>
        </div>
      </div>
      )}

      {hasBlockingCumulativePrint ? (
        <div
          className="rc-no-print"
          style={{
            maxWidth: "210mm",
            margin: "0 auto 12px",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#9f1239",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Printing is blocked until the missing prior-term scores are backfilled and
          the annual average is complete for every cumulative subject.
        </div>
      ) : null}

      {/* ─── Report Card Sheet ─── */}
      <div 
        className="rc-sheet-wrapper"
        style={{
          width: "210mm",
          height: "297mm",
          margin: "0 auto 40px",
          padding: "10mm",
          background: "white",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          overflow: "hidden",
          border: "none",
          position: "relative",
        }}
      >
        <div
          ref={contentRef}
          className="rc-sheet"
          style={{
            width: "100%",
            minHeight: "100%",
            background: "white",
            border: "none",
            borderRadius: 0,
            overflow: "hidden",
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            boxSizing: "border-box",
          }}
        >
        {/* ─── HEADER: Logo | School Info | Student Photo ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 120px",
            borderBottom: "2px solid #1e293b",
            breakInside: "avoid",
          }}
        >
          {/* School Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
              borderRight: "1px solid #cbd5e1",
              background: "#f8fafc",
            }}
          >
            {reportCard.schoolLogoUrl ? (
              <img
                src={reportCard.schoolLogoUrl}
                alt="School Logo"
                style={{
                  width: 68,
                  height: 68,
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  border: "3px solid #1e40af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#1e40af",
                  background: "white",
                  letterSpacing: "0.04em",
                }}
              >
                {schoolInitials || "SCH"}
              </div>
            )}
          </div>

          {/* School Name & Details */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "10px 14px",
              textAlign: "center",
              gap: 3,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {reportCard.schoolName}
            </h2>
            {reportCard.schoolAddress && (
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#475569",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {reportCard.schoolAddress}
              </p>
            )}
            {reportCard.schoolContact && (
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#64748b",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {reportCard.schoolContact}
              </p>
            )}
            {reportCard.schoolMotto && (
              <p
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  fontStyle: "italic",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#94a3b8",
                  margin: "3px 0 0",
                }}
              >
                {reportCard.schoolMotto}
              </p>
            )}
            <div
              style={{
                marginTop: 4,
                padding: "3px 12px",
                background: "#0f172a",
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "white",
                }}
              >
                Student Report Card
              </span>
            </div>
          </div>

          {/* Student Photo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
              borderLeft: "1px solid #cbd5e1",
              background: "#f8fafc",
            }}
          >
            {reportCard.student.photoUrl ? (
              <img
                src={reportCard.student.photoUrl}
                alt={reportCard.student.name}
                style={{
                  width: 82,
                  height: 94,
                  objectFit: "cover",
                  border: "2px solid #1e293b",
                  borderRadius: 2,
                }}
              />
            ) : (
              <div
                style={{
                  width: 82,
                  height: 94,
                  border: "1.5px dashed #94a3b8",
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  background: "white",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-1a6 6 0 0 1 12 0v1" />
                </svg>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  No Photo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── STUDENT INFO GRID ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "2px solid #1e293b",
            breakInside: "avoid",
          }}
        >
          {/* Left column */}
          <div style={{ borderRight: "1px solid #cbd5e1" }}>
            {leftFields.map((field) => (
              <InfoRow key={field.label} label={field.label} value={field.value} />
            ))}
          </div>

          {/* Right column */}
          <div>
            {rightFields.map((field) => (
              <InfoRow key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </div>

        {/* ─── SECTION HEADER ─── */}
        <div
          style={{
            padding: "7px 12px",
            background: "#0f172a",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "white",
            }}
          >
            Examination Details
          </span>
        </div>

        {/* ─── RESULTS TABLE ─── */}
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              tableLayout: "fixed",
              breakInside: "avoid",
            }}
          >
            <thead>
              {reportCard.resultCalculationMode === "cumulative_annual" ? (
                <>
                  <tr style={{ background: "#f8fafc" }}>
                    <Th align="left" width="23%" rowSpan={2}>
                      Subject
                    </Th>
                    <Th width="41%" colSpan={5}>
                      {reportCard.termName.toUpperCase()}
                    </Th>
                    <Th width="9%" rowSpan={2}>1st Term</Th>
                    <Th width="9%" rowSpan={2}>2nd Term</Th>
                    <Th width="7%" rowSpan={2}>Grade</Th>
                    <Th width="11%" align="left" rowSpan={2}>
                      Remark
                    </Th>
                  </tr>
                  <tr style={{ background: "#f1f5f9" }}>
                    <Th width="8%">CA1 ({ac.ca1Max}%)</Th>
                    <Th width="8%">CA2 ({ac.ca2Max}%)</Th>
                    <Th width="8%">CA3 ({ac.ca3Max}%)</Th>
                    <Th width="8%">Exam ({ac.examMax}%)</Th>
                    <Th width="9%">Total (100%)</Th>
                  </tr>
                </>
              ) : (
                <tr style={{ background: "#f1f5f9" }}>
                  <Th align="left" width="28%">
                    Subject
                  </Th>
                  <Th width="9%">CA1 ({ac.ca1Max}%)</Th>
                  <Th width="9%">CA2 ({ac.ca2Max}%)</Th>
                  <Th width="9%">CA3 ({ac.ca3Max}%)</Th>
                  <Th width="10%">Exam ({ac.examMax}%)</Th>
                  <Th width="11%">Total (100%)</Th>
                  <Th width="7%">Grade</Th>
                  <Th width="15%" align="left">
                    Remark
                  </Th>
                </tr>
              )}
            </thead>
              <tbody>
                {reportCard.results.map((result, i) => (
                  <tr
                    key={result.subjectId}
                    style={{
                      background: !result.isRecorded
                        ? "#fffbeb"
                        : i % 2 === 1
                          ? "#fafbfc"
                          : "white",
                    }}
                  >
                    <Td align="left" bold>
                      {result.subjectName}
                      {reportCard.resultCalculationMode === "cumulative_annual" &&
                        (result.calculationMode === "cumulative_annual" &&
                        result.missingHistoricalTerms &&
                        result.missingHistoricalTerms.length > 0 ? (
                          <span style={{ color: "#ef4444", marginLeft: 4, fontSize: 10 }}>*</span>
                        ) : result.calculationMode !== "cumulative_annual" ? (
                          <span
                            style={{
                              color: "#64748b",
                              marginLeft: 6,
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            Standalone
                          </span>
                        ) : null)}
                    </Td>
                    {reportCard.resultCalculationMode === "cumulative_annual" ? (
                      <>
                        <Td mono>{formatScore(result.ca1)}</Td>
                        <Td mono>{formatScore(result.ca2)}</Td>
                        <Td mono>{formatScore(result.ca3)}</Td>
                        <Td mono>{formatScore(result.examScore)}</Td>
                        <Td mono bold>{formatScore(result.currentTermTotal ?? result.total)}</Td>
                        <Td mono>{result.calculationMode === "cumulative_annual" ? formatScore(result.firstTermTotal ?? null) : "-"}</Td>
                        <Td mono>{result.calculationMode === "cumulative_annual" ? formatScore(result.secondTermTotal ?? null) : "-"}</Td>
                      </>
                    ) : (
                      <>
                        <Td mono>{formatScore(result.ca1)}</Td>
                        <Td mono>{formatScore(result.ca2)}</Td>
                        <Td mono>{formatScore(result.ca3)}</Td>
                        <Td mono>{formatScore(result.examScore)}</Td>
                        <Td mono bold>
                          {formatScore(result.total)}
                        </Td>
                      </>
                    )}
                    <Td
                      bold
                      color={
                        isIncompleteCumulativeResult(result)
                          ? "#64748b"
                          : gradeColor(result.gradeLetter)
                      }
                    >
                      {getResultGradeDisplay(result)}
                    </Td>
                    <Td align="left" fontSize={11}>
                      {getResultRemarkDisplay(result)}
                    </Td>
                  </tr>
                ))}
              </tbody>
          </table>
          {reportCard.resultCalculationMode === "cumulative_annual" ? (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: reportCard.results.some((r) => r.missingHistoricalTerms && r.missingHistoricalTerms.length > 0)
                  ? "1px solid #fecaca"
                  : "1px solid #dbeafe",
                background: reportCard.results.some((r) => r.missingHistoricalTerms && r.missingHistoricalTerms.length > 0)
                  ? "#fff1f2"
                  : "#eff6ff",
                fontSize: 10.5,
                color: reportCard.results.some((r) => r.missingHistoricalTerms && r.missingHistoricalTerms.length > 0)
                  ? "#9f1239"
                  : "#1d4ed8",
                fontWeight: 700,
              }}
            >
              {reportCard.results.some((r) => r.missingHistoricalTerms && r.missingHistoricalTerms.length > 0)
                ? "Rows marked * are incomplete. Printing stays blocked until the missing prior-term scores are backfilled and the cumulative grade can be finalized."
                : "In cumulative annual mode, the current term breakdown is shown alongside first-term and second-term totals. Grade and remark follow the cumulative annual calculation."}
            </div>
          ) : null}
        </div>

        {/* ─── COMMENTS SECTION ─── */}
        <div style={{ borderTop: "2px solid #1e293b", display: extras.length > 0 ? "none" : undefined }}>
          <CommentRow
            label="Class Teacher"
            value={reportCard.classTeacherName ?? "-"}
          />
          <CommentRow
            label="Class Teacher's Comment"
            value={reportCard.classTeacherComment ?? "-"}
          />
          <CommentRow
            label="Head Teacher's Comment"
            value={reportCard.headTeacherComment ?? "-"}
            last
          />
        </div>

        {extras.length > 0 ? (
          <>
            <div
              style={{
                padding: "7px 12px",
                background: "#0f172a",
                borderTop: "2px solid #1e293b",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "white",
                }}
              >
                Report Card Extras
              </span>
            </div>
            <div>
              {extras.map((bundle, bundleIndex) => (
                <ExtraBundleBlock
                  key={bundle.bundleId}
                  bundleName={bundle.bundleName}
                  sections={bundle.sections}
                  showBundleHeading={extras.length > 1}
                  lastBundle={bundleIndex === extras.length - 1}
                />
              ))}
            </div>
            <div style={{ borderTop: "2px solid #1e293b" }}>
              <CommentRow
                label="Class Teacher"
                value={reportCard.classTeacherName ?? "-"}
              />
              <CommentRow
                label="Class Teacher's Comment"
                value={reportCard.classTeacherComment ?? "-"}
              />
              <CommentRow
                label="Head Teacher's Comment"
                value={reportCard.headTeacherComment ?? "-"}
                last
              />
            </div>
          </>
        ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        borderBottom: "1px solid #e2e8f0",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#475569",
          borderRight: "1px solid #e2e8f0",
          background: "#fafbfc",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "4px 8px",
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  width,
  align = "center",
  rowSpan,
  colSpan,
}: {
  children: React.ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  rowSpan?: number;
  colSpan?: number;
}) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      style={{
        width: width ?? "auto",
        padding: "5px 6px",
        textAlign: align,
        fontSize: 9.5,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "#475569",
        borderBottom: "2px solid #1e293b",
        borderRight: "1px solid #e2e8f0",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "center",
  bold,
  mono,
  color,
  fontSize: fs,
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  bold?: boolean;
  mono?: boolean;
  color?: string;
  fontSize?: number;
}) {
  return (
    <td
      style={{
        padding: "4px 6px",
        textAlign: align,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
        color: color ?? "#0f172a",
        borderBottom: "1px solid #e2e8f0",
        borderRight: "1px solid #f1f5f9",
        fontSize: fs ?? 11,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function CommentRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "170px 1fr",
        borderBottom: last ? undefined : "1px solid #e2e8f0",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          fontWeight: 700,
          color: "#475569",
          borderRight: "1px solid #e2e8f0",
          background: "#fafbfc",
          whiteSpace: "nowrap",
        }}
      >
        {label}:
      </div>
      <div
        style={{
          padding: "4px 8px",
          fontWeight: 500,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ExtraBundleBlock({
  bundleName,
  sections,
  showBundleHeading,
  lastBundle,
}: {
  bundleName: string;
  sections: Array<{
    sectionId: string;
    sectionLabel: string;
    items: Array<{
      fieldId: string;
      label: string;
      type: "text" | "number" | "boolean" | "scale";
      printValue: string | null;
    }>;
  }>;
  showBundleHeading: boolean;
  lastBundle?: boolean;
}) {
  const leftSections: typeof sections = [];
  const rightSections: typeof sections = [];
  let leftCount = 0;
  let rightCount = 0;

  for (const section of sections) {
    // Estimate "height" by item count + constant for header
    const sectionWeight = section.items.length + 2;
    if (leftCount <= rightCount) {
      leftSections.push(section);
      leftCount += sectionWeight;
    } else {
      rightSections.push(section);
      rightCount += sectionWeight;
    }
  }

  return (
    <div
      style={{
        borderBottom: lastBundle ? undefined : "1px solid #cbd5e1",
        breakInside: "avoid",
      }}
    >
      {showBundleHeading ? (
        <div
          style={{
            padding: "6px 8px",
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#334155",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {bundleName}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          breakInside: "avoid",
        }}
      >
        <div
          style={{
            borderRight: "1px solid #e2e8f0",
          }}
        >
          {leftSections.map((section) => (
            <div key={section.sectionId} style={{ breakInside: "avoid" }}>
              <ExtraSectionCard
                sectionLabel={section.sectionLabel}
                items={section.items}
              />
            </div>
          ))}
        </div>
        <div>
          {rightSections.map((section) => (
            <div key={section.sectionId} style={{ breakInside: "avoid" }}>
              <ExtraSectionCard
                sectionLabel={section.sectionLabel}
                items={section.items}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function ExtraSectionCard({
  sectionLabel,
  items,
}: {
  sectionLabel: string;
  items: Array<{
    fieldId: string;
    label: string;
    type: "text" | "number" | "boolean" | "scale";
    printValue: string | null;
  }>;
}) {
  return (
    <div
      style={{
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          padding: "6px 8px",
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#64748b",
          background: "#fafbfc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {sectionLabel}
      </div>
      {items.map((item, itemIndex) => (
        <ExtraItemRow
          key={item.fieldId}
          label={item.label}
          value={item.printValue ?? "-"}
          last={itemIndex === items.length - 1}
        />
      ))}
    </div>
  );
}
function ExtraItemRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderBottom: last ? undefined : "1px solid #e2e8f0",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          fontWeight: 700,
          color: "#475569",
          borderRight: "1px solid #e2e8f0",
          background: "#fafbfc",
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "4px 8px",
          fontWeight: 500,
          color: "#0f172a",
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
