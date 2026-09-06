export interface AuditRow {
  id: string;
  eventId: string;
  timestamp: number;
  schoolId: string;
  groupId: string | null;
  actor: string;
  actorKind: string;
  module: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: string;
  summary: string;
  before: string | null;
  after: string | null;
  correlationId: string;
  retentionClass: string;
}

const columns: { label: string; value: (row: AuditRow) => string }[] = [
  { label: "Event", value: (r) => r.eventId },
  {
    label: "Timestamp (UTC)",
    value: (r) => new Date(r.timestamp).toISOString(),
  },
  { label: "Branch", value: (r) => r.schoolId },
  { label: "Group snapshot", value: (r) => r.groupId ?? "Not recorded" },
  { label: "Actor", value: (r) => r.actor },
  { label: "Actor kind", value: (r) => r.actorKind },
  { label: "Module", value: (r) => r.module },
  { label: "Action", value: (r) => r.action },
  { label: "Target type", value: (r) => r.targetType },
  { label: "Target", value: (r) => r.targetId },
  { label: "Outcome", value: (r) => r.outcome },
  { label: "Summary", value: (r) => r.summary },
  { label: "Before", value: (r) => r.before ?? "Not recorded" },
  { label: "After", value: (r) => r.after ?? "Not recorded" },
  { label: "Correlation", value: (r) => r.correlationId },
  { label: "Retention", value: (r) => r.retentionClass },
];

export function auditCsv(rows: AuditRow[]) {
  const cell = (text: string) => {
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [
    columns.map((c) => cell(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(",")),
  ].join("\r\n");
}

/** Both formats use the same completed, scoped/redacted page stream; never export a partial search. */
export async function exportAudit({
  format,
  label,
  fetchPage,
  record,
}: {
  format: "csv" | "pdf";
  label: string;
  fetchPage: (
    cursor: string | null,
  ) => Promise<{ page: AuditRow[]; isDone: boolean; continueCursor: string }>;
  record: (
    stage: "attempt" | "client_prepared" | "client_failed",
    rowCount?: number,
  ) => Promise<{ permitted: boolean }>;
}) {
  const printWindow = format === "pdf" ? window.open("", "_blank") : null;
  try {
    const attempt = await record("attempt");
    if (!attempt.permitted) throw new Error("Audit export permission denied.");
    if (format === "pdf" && !printWindow)
      throw new Error(
        "Allow popups to open the printable audit document, then retry.",
      );
    const rows: AuditRow[] = [];
    let cursor: string | null = null;
    let complete = false;
    for (let batch = 0; batch < 200; batch++) {
      const result = await fetchPage(cursor);
      rows.push(...result.page);
      if (rows.length > 5000)
        throw new Error(
          "Export exceeds 5,000 matching events. Narrow the filters; no partial file was exported.",
        );
      if (result.isDone) {
        complete = true;
        break;
      }
      cursor = result.continueCursor;
    }
    if (!complete)
      throw new Error(
        "Search exceeds 200 source pages. Narrow the date/branch filters; no partial file was exported.",
      );
    // Recheck export authority immediately before preparing a downloadable/printable document.
    const outcome = await record("client_prepared", rows.length);
    if (!outcome.permitted)
      throw new Error("Export permission changed. No document was prepared.");
    if (format === "csv") {
      const url = URL.createObjectURL(
        new Blob(["\ufeff", auditCsv(rows)], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-events.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (printWindow) {
      printWindow.opener = null;
      const doc = printWindow.document;
      doc.title = "Audit history — printable export";
      const style = doc.createElement("style");
      style.textContent =
        "body{font:12px system-ui,sans-serif;color:#111;margin:24px}h1{font-size:20px}article{break-inside:avoid;border-top:1px solid #777;padding:12px 0}dl{display:grid;grid-template-columns:140px 1fr;gap:5px}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}@media print{button{display:none}body{margin:0}@page{margin:16mm}}";
      doc.head.append(style);
      const heading = doc.createElement("h1");
      heading.textContent = label;
      doc.body.append(heading);
      const note = doc.createElement("p");
      note.textContent = `${rows.length} scoped, redacted events. Generated ${new Date().toISOString()}. Use your browser's Save as PDF. PDF saving is not verified by Melo.`;
      doc.body.append(note);
      const button = doc.createElement("button");
      button.textContent = "Print / Save as PDF";
      button.onclick = () => printWindow.print();
      doc.body.append(button);
      for (const row of rows) {
        const article = doc.createElement("article");
        const list = doc.createElement("dl");
        for (const column of columns) {
          const term = doc.createElement("dt");
          term.textContent = column.label;
          const value = doc.createElement("dd");
          value.textContent = column.value(row);
          list.append(term, value);
        }
        article.append(list);
        doc.body.append(article);
      }
      printWindow.focus();
    }
    return rows.length;
  } catch (error) {
    printWindow?.close();
    try {
      await record("client_failed");
    } catch {
      /* The original failure remains visible; revoked authority may prevent a follow-up journal write. */
    }
    throw error;
  }
}
