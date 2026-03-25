"use client";

export type ReportCardSheetData = {
  schoolName: string;
  schoolAddress?: string | null;
  schoolContact?: string | null;
  schoolLogoUrl?: string | null;
  schoolMotto?: string | null;
  sessionName: string;
  termName: string;
  className: string;
  generatedAt: number;
  assessmentConfig: {
    ca1Max: number;
    ca2Max: number;
    ca3Max: number;
    examMax: number;
  };
  student: {
    _id: string;
    name: string;
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
    ca1: number;
    ca2: number;
    ca3: number;
    examScore: number;
    total: number;
    gradeLetter: string;
    remark: string;
    isRecorded: boolean;
  }>;
  classTeacherName?: string | null;
  classTeacherComment?: string | null;
  headTeacherComment?: string | null;
};

function formatDate(
  value: number | null,
  options?: Intl.DateTimeFormatOptions
) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(value));
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

/* ───── Inline print styles (injected once) ───── */
const PRINT_STYLE_ID = "report-card-print-styles";

function ensurePrintStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PRINT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 8mm 10mm 8mm;
      }
      html, body { width: 210mm !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .rc-no-print { display: none !important; }
      .rc-print-root { width: 194mm !important; max-width: 194mm !important; margin: 0 auto !important; padding: 0 !important; }
      .rc-sheet { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; box-shadow: none !important; border-width: 1px !important; }
      .rc-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(style);
}

/* ────────────────── Component ────────────────── */

export function ReportCardSheet({
  reportCard,
  backHref,
}: {
  reportCard: ReportCardSheetData;
  backHref: string;
}) {
  if (typeof window !== "undefined") ensurePrintStyles();

  const schoolInitials = buildInitials(reportCard.schoolName);
  const ac = reportCard.assessmentConfig;

  /* ── Info rows data ── */
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
      value: reportCard.student.houseName ?? "—",
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

  return (
    <div className="rc-print-root" style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
      {/* ── Toolbar (hidden during print) ── */}
      <div
        className="rc-no-print"
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "16px 16px 12px",
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
              fontSize: 20,
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
            ← Back
          </a>
          <button
            type="button"
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
              background: "#0f172a",
              cursor: "pointer",
            }}
          >
            Export / Print
          </button>
        </div>
      </div>

      {/* ── Report Card Sheet ── */}
      <div
        className="rc-sheet"
        style={{
          maxWidth: 900,
          margin: "0 auto 40px",
          background: "white",
          border: "2px solid #1e293b",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* ── HEADER: Logo | School Info | Student Photo ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 120px",
            borderBottom: "2px solid #1e293b",
          }}
        >
          {/* School Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
              borderRight: "1px solid #cbd5e1",
              background: "#f8fafc",
            }}
          >
            {reportCard.schoolLogoUrl ? (
              <img
                src={reportCard.schoolLogoUrl}
                alt="School Logo"
                style={{
                  width: 76,
                  height: 76,
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  border: "3px solid #1e40af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
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
              padding: "12px 16px",
              textAlign: "center",
              gap: 3,
            }}
          >
            <h2
              style={{
                fontSize: 18,
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
                  fontSize: 9,
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
                padding: "3px 14px",
                background: "#0f172a",
                borderRadius: 3,
              }}
            >
              <span
                style={{
                  fontSize: 9,
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
              padding: 12,
              borderLeft: "1px solid #cbd5e1",
              background: "#f8fafc",
            }}
          >
            {reportCard.student.photoUrl ? (
              <img
                src={reportCard.student.photoUrl}
                alt={reportCard.student.name}
                style={{
                  width: 88,
                  height: 100,
                  objectFit: "cover",
                  border: "2px solid #1e293b",
                  borderRadius: 2,
                }}
              />
            ) : (
              <div
                style={{
                  width: 88,
                  height: 100,
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

        {/* ── STUDENT INFO GRID ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "2px solid #1e293b",
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

        {/* ── SECTION HEADER ── */}
        <div
          style={{
            padding: "8px 14px",
            background: "#0f172a",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "white",
            }}
          >
            Examination Details
          </span>
        </div>

        {/* ── RESULTS TABLE ── */}
        <div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              tableLayout: "fixed",
            }}
          >
            <thead>
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
                <Th width="12%" align="left">
                  Remark
                </Th>
              </tr>
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
                  </Td>
                  <Td mono>{formatScore(result.ca1)}</Td>
                  <Td mono>{formatScore(result.ca2)}</Td>
                  <Td mono>{formatScore(result.ca3)}</Td>
                  <Td mono>{formatScore(result.examScore)}</Td>
                  <Td mono bold>
                    {formatScore(result.total)}
                  </Td>
                  <Td bold color={gradeColor(result.gradeLetter)}>
                    {result.gradeLetter}
                  </Td>
                  <Td align="left" fontSize={11}>
                    {result.remark}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── COMMENTS SECTION ── */}
        <div style={{ borderTop: "2px solid #1e293b" }}>
          <CommentRow
            label="Class Teacher"
            value={reportCard.classTeacherName ?? "—"}
          />
          <CommentRow
            label="Class Teacher's Comment"
            value={reportCard.classTeacherComment ?? "—"}
          />
          <CommentRow
            label="Head Teacher's Comment"
            value={reportCard.headTeacherComment ?? "—"}
            last
          />
        </div>
      </div>
    </div>
  );
}

/* ──────── Sub-components ──────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        borderBottom: "1px solid #e2e8f0",
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <div
        style={{
          padding: "5px 10px",
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
          padding: "5px 10px",
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
}: {
  children: React.ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      style={{
        width: width ?? "auto",
        padding: "7px 8px",
        textAlign: align,
        fontSize: 10,
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
        padding: "5px 8px",
        textAlign: align,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
        color: color ?? "#0f172a",
        borderBottom: "1px solid #e2e8f0",
        borderRight: "1px solid #f1f5f9",
        fontSize: fs ?? 12,
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
        gridTemplateColumns: "180px 1fr",
        borderBottom: last ? undefined : "1px solid #e2e8f0",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          padding: "6px 10px",
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
          padding: "6px 10px",
          fontWeight: 500,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}
