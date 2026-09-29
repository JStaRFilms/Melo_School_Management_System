"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, type CSSProperties } from "react";
import { deriveSchoolTheme } from "@school/shared/theme";

type Issued = { issuedAt: number; snapshot: { schoolName: string; primaryColor?: string; accentColor?: string; studentName: string; admissionNumber: string; className: string; sessionName: string; termName: string; subjects: { subjectId: string; name: string; order: number; comment: string }[] } };

export function NarrativeClassPrint({ classId, sessionId, termId, onExit }: { classId: string; sessionId: string; termId: string; onExit: () => void }) {
  const batch = useQuery("functions/academic/narrativeReports:getIssuedClassBatch" as never,
    { classId, sessionId, termId } as never) as { reports: Issued[]; skipped: number } | undefined;
  const printed = useRef(false);
  useEffect(() => {
    printed.current = false;
  }, [classId, sessionId, termId]);
  useEffect(() => {
    if (!batch?.reports.length || printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [batch]);
  return <main className="narrative-batch mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
    <style>{`@media print {
      @page { size: A4; margin: 14mm; }
      body { background: white !important; }
      .rc-no-print { display: none !important; }
      .workspace-print-root:has(.narrative-batch) > aside { display: none !important; }
      .workspace-print-root:has(.narrative-batch),
      .workspace-print-root:has(.narrative-batch) > .workspace-print-pane,
      .workspace-print-root:has(.narrative-batch) .workspace-print-scroll,
      .workspace-print-root:has(.narrative-batch) .workspace-print-content {
        display: block !important; position: static !important; height: auto !important;
        max-height: none !important; min-height: 0 !important; overflow: visible !important;
        width: auto !important; max-width: none !important; margin: 0 !important; padding: 0 !important;
      }
      .narrative-batch .batch-controls { display: none !important; }
      .narrative-batch .batch-sheet { break-after: page; page-break-after: always; color: #111827 !important; background: white !important; }
      .narrative-batch .batch-sheet:last-child { break-after: auto; page-break-after: auto; }
      .narrative-batch .batch-sheet * { color: #111827 !important; background: white !important; }
      .narrative-batch .batch-sheet header, .narrative-batch .batch-sheet h2 { break-after: avoid; }
      .narrative-batch .batch-sheet h2 { border-color: #111827 !important; }
      .narrative-batch .batch-sheet section { break-inside: auto; }
      .narrative-batch .batch-sheet p { orphans: 3; widows: 3; }
    }`}</style>
    <div className="batch-controls space-y-3">
      <button type="button" className="rounded border px-4 py-2" onClick={onExit}>Back to reports</button>
      {!batch ? <p role="status">Loading issued reports...</p> : <>
        <p role="status">{batch.reports.length} issued reports ready. {batch.skipped} students skipped because their reports are not issued.</p>
        {batch.reports.length > 0 && <button type="button" className="rounded border px-4 py-2" onClick={() => window.print()}>Print issued class reports</button>}
      </>}
    </div>
    {batch?.reports.map((report, index) => <article key={`${report.snapshot.admissionNumber}-${index}`} className="batch-sheet bg-white p-8 text-slate-900" style={deriveSchoolTheme(report.snapshot.primaryColor, report.snapshot.accentColor) as CSSProperties}>
      <header className="border-b pb-4">
        <p className="mb-3 inline-block rounded px-3 py-1 text-sm font-semibold" style={{ backgroundColor: "var(--school-primary)", color: "var(--school-primary-contrast)" }}>Progress report</p>
        <h1 className="text-2xl font-bold">{report.snapshot.schoolName}</h1>
        <p>{report.snapshot.studentName} | {report.snapshot.admissionNumber}</p>
        <p>{report.snapshot.className} | {report.snapshot.sessionName} | {report.snapshot.termName}</p>
        <p>Issued {new Date(report.issuedAt).toLocaleDateString("en-GB")}</p>
      </header>
      {report.snapshot.subjects.slice().sort((a, b) => a.order - b.order).map(subject => <section key={subject.subjectId} className="border-b py-4">
        <h2 className="border-l-4 pl-3 font-semibold" style={{ borderColor: "var(--school-accent)" }}>{subject.name}</h2>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{subject.comment}</p>
      </section>)}
    </article>)}
  </main>;
}
