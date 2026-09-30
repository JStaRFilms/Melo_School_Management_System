"use client";
import { useMutation, useQuery } from "convex/react";
import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { deriveSchoolTheme } from "@school/shared/theme";

type Preview = { status: "draft" | "issued"; issuedAt: number | null; reviewedKey: string | null; snapshot: { schoolName: string; primaryColor?: string; accentColor?: string; studentName: string; admissionNumber: string; className: string; sessionName: string; termName: string; subjects: { subjectId: string; name: string; comment: string }[] } };
export function NarrativeReview({ studentId, classId, sessionId, termId }: { studentId: string; classId: string; sessionId: string; termId: string }) {
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const args = { studentId, classId, sessionId, termId };
  const preview = useQuery("functions/academic/narrativeReports:getStaffPreview" as never, args as never) as Preview | undefined;
  const publish = useMutation("functions/academic/narrativeReports:publish" as never);
  const missing = preview?.snapshot.subjects.filter(s => !s.comment.trim()) ?? [];
  return <main className="narrative-review mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-8 print:max-w-none print:p-0">
    <style>{`@media print { @page { size: A4; margin: 14mm; } body { background: white !important; } .rc-no-print { display: none !important; } .workspace-print-root:has(.narrative-review) > aside { display: none !important; } .workspace-print-root:has(.narrative-review), .workspace-print-root:has(.narrative-review) > .workspace-print-pane, .workspace-print-root:has(.narrative-review) .workspace-print-scroll, .workspace-print-root:has(.narrative-review) .workspace-print-content { display: block !important; position: static !important; height: auto !important; max-height: none !important; min-height: 0 !important; overflow: visible !important; width: auto !important; max-width: none !important; margin: 0 !important; padding: 0 !important; } main, main * { color: #111827 !important; background: white !important; } main section { break-inside: auto; } main h2 { break-after: avoid; border-color: #111827 !important; } main section p { orphans: 3; widows: 3; } }`}</style>
    <Link href={`/assessments/report-cards?sessionId=${sessionId}&termId=${termId}&classId=${classId}`} className="print:hidden underline">Back to student selection</Link>
    {!preview ? <p role="status">Loading report review...</p> : <>
      <div className="narrative-review-paper rounded-xl border bg-white p-6 print:rounded-none print:border-0 print:p-0 print:text-black" style={deriveSchoolTheme(preview.snapshot.primaryColor, preview.snapshot.accentColor) as CSSProperties}>
        <header className="border-b pb-4"><p className="mb-3 inline-block rounded px-3 py-1 text-sm font-semibold" style={{ backgroundColor: "var(--school-primary)", color: "var(--school-primary-contrast)" }}>Progress report</p><h1 className="text-2xl font-bold">{preview.snapshot.schoolName}</h1><p>{preview.snapshot.studentName} - {preview.snapshot.admissionNumber}</p><p>{preview.snapshot.className} - {preview.snapshot.sessionName} - {preview.snapshot.termName}</p><p className="mt-2 font-semibold">{preview.status === "draft" ? "Draft, not published - not visible to families" : `Published ${new Date(preview.issuedAt!).toLocaleString()}`}</p></header>
        <div className="space-y-5 pt-5">{preview.snapshot.subjects.map(subject => <section key={subject.subjectId}><h2 className="border-l-4 pl-3 font-bold" style={{ borderColor: "var(--school-accent)" }}>{subject.name}</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{subject.comment.trim() || "No comment yet"}</p></section>)}</div>
      </div>
      {preview.status === "draft" ? <div className="space-y-3 print:hidden">
        {!preview.snapshot.subjects.length ? <p role="alert">Assign subjects to this class before publishing.</p> : missing.length ? <p role="alert">Missing comments: {missing.map(s => s.name).join(", ")}. Enter each subject comment before publishing.</p> : <p>All subject comments are ready for review.</p>}
        <Link className="block underline" href={`/assessments/results/entry?sessionId=${sessionId}&termId=${termId}&classId=${classId}`}>Open subject comments entry</Link>
        <button type="button" className="min-h-11 rounded border px-4" onClick={() => { setReviewKey(preview.reviewedKey); setMessage("Preview reviewed. You may publish this student now."); }}>Review current preview</button>{" "}
        <button type="button" disabled={publishing || !reviewKey || reviewKey !== preview.reviewedKey || Boolean(missing.length) || !preview.snapshot.subjects.length} className="min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-50" onClick={async () => {
          if (!window.confirm(`Publish ${preview.snapshot.studentName}'s report for ${preview.snapshot.termName}? Families can then view the fixed copy.`)) return;
          setPublishing(true); setMessage("");
          try { await publish({ ...args, reviewedKey: reviewKey } as never); setReviewKey(null); setMessage("Report published."); }
          catch (error) { setReviewKey(null); setMessage(`${error instanceof Error ? error.message : "Publish failed."} Refresh and review the preview again.`); }
          finally { setPublishing(false); }
        }}>{publishing ? "Publishing..." : "Publish this student"}</button><p role="status" aria-live="polite">{message}</p>
      </div> : <button type="button" className="print:hidden min-h-11 rounded border px-4" onClick={() => window.print()}>Print issued report</button>}
    </>}
  </main>;
}
