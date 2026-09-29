"use client";
import type { PortalWorkspaceData } from "@/portal-types";
import { deriveSchoolTheme } from "@school/shared/theme";
import type { CSSProperties } from "react";

export function NarrativeReport({ report }: { report: NonNullable<PortalWorkspaceData["selectedNarrativeReport"]> }) {
  const { snapshot, issuedAt } = report;
  const theme = deriveSchoolTheme(snapshot.primaryColor, snapshot.accentColor);
  return <div className="narrative-paper mx-auto bg-white p-6 text-slate-900 shadow-sm sm:p-10" style={{ ...theme, maxWidth: "210mm" } as CSSProperties}>
    <style>{`@media print {
      @page { size: A4; margin: 14mm; }
      body { background: white !important; }
      .rc-no-print { display: none !important; }
      body * { visibility: hidden; }
      .narrative-paper, .narrative-paper * { visibility: visible; }
      .narrative-paper { position: absolute; inset: 0; width: 100%; max-width: none !important; padding: 0 !important; box-shadow: none !important; color: #111827 !important; font-size: 11pt; }
      .narrative-paper header { break-after: avoid; }
      .narrative-paper, .narrative-paper * { color: #111827 !important; background: white !important; }
      .narrative-paper section { break-inside: auto; }
      .narrative-paper h2 { break-after: avoid; }
      .narrative-paper p { orphans: 3; widows: 3; }
    }`}</style>
    <header className="border-b border-slate-300 pb-5">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--school-primary)" }}>Progress report</p>
      <h1 className="mt-2 text-2xl font-bold">{snapshot.schoolName}</h1>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Student</dt><dd className="font-semibold">{snapshot.studentName}</dd></div>
        <div><dt className="text-slate-500">Admission number</dt><dd>{snapshot.admissionNumber}</dd></div>
        <div><dt className="text-slate-500">Class at issue</dt><dd>{snapshot.className}</dd></div>
        <div><dt className="text-slate-500">Period</dt><dd>{snapshot.sessionName} | {snapshot.termName}</dd></div>
      </dl>
    </header>
    <div className="divide-y divide-slate-200">
      {[...snapshot.subjects].sort((a, b) => a.order - b.order).map(subject => <section key={subject.subjectId} className="py-5">
        <h2 className="font-semibold">{subject.name}</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{subject.comment}</p>
      </section>)}
    </div>
    <footer className="border-t border-slate-300 pt-4 text-xs text-slate-600">Issued {new Date(issuedAt).toLocaleDateString("en-GB")}</footer>
  </div>;
}
