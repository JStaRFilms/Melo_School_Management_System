"use client";

interface ReportCardToolbarProps {
  studentName: string;
  backHref: string;
  onPrint?: () => void;
  isPrintBlocked?: boolean;
}

export function ReportCardToolbar({
  studentName,
  backHref,
  onPrint,
  isPrintBlocked = false,
}: ReportCardToolbarProps) {
  return (
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
          {studentName}
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
          disabled={isPrintBlocked}
          onClick={onPrint ?? (() => window.print())}
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
            background: isPrintBlocked ? "#94a3b8" : "#0f172a",
            cursor: isPrintBlocked ? "not-allowed" : "pointer",
            opacity: isPrintBlocked ? 0.9 : 1,
          }}
        >
          {isPrintBlocked ? "Print blocked" : "Export / Print"}
        </button>
      </div>
    </div>
  );
}

interface ReportCardPrintBlockedNoticeProps {
  message?: string;
}

export function ReportCardPrintBlockedNotice({
  message = "Printing is blocked until the missing prior-term scores are backfilled and the annual average is complete for every cumulative subject.",
}: ReportCardPrintBlockedNoticeProps) {
  return (
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
      {message}
    </div>
  );
}